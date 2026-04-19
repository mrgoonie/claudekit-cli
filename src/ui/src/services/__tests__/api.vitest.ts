import { isTauri } from "@/hooks/use-tauri";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as tauri from "../../lib/tauri-commands";
import * as api from "../api";

// Mock tauri-commands and use-tauri hook
vi.mock("../../lib/tauri-commands", () => ({
	listProjects: vi.fn(),
	scanSkills: vi.fn(),
	listProjectSessions: vi.fn(),
	getGlobalConfigPath: vi.fn(),
	getGlobalConfigDir: vi.fn(),
	getHomeDir: vi.fn(),
	readSettings: vi.fn(),
	settingsFileExists: vi.fn(),
	getHealth: vi.fn(),
	touchProject: vi.fn(),
}));

vi.mock("@/hooks/use-tauri", () => ({
	isTauri: vi.fn(),
}));

describe("api service dual-mode routing", () => {
	const fetchMock = vi.fn();

	beforeEach(() => {
		vi.resetAllMocks();
		vi.stubGlobal("fetch", fetchMock);
	});

	it("routes fetchProjects to tauri.listProjects when isTauri() is true", async () => {
		vi.mocked(isTauri).mockReturnValue(true);
		vi.mocked(tauri.listProjects).mockResolvedValue([
			{ name: "Test Project", path: "/tmp/test", hasClaudeConfig: true, hasCkConfig: true },
		]);
		vi.mocked(tauri.readSettings).mockResolvedValue({});

		const projects = await api.fetchProjects();

		expect(tauri.listProjects).toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
		expect(projects).toHaveLength(1);
		expect(projects[0].name).toBe("Test Project");
	});

	it("routes fetchProjects to fetch('/api/projects') when isTauri() is false", async () => {
		vi.mocked(isTauri).mockReturnValue(false);
		// requireBackend health check
		fetchMock.mockResolvedValueOnce({ ok: true });
		// projects fetch
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => [
				{ id: "p1", name: "Web Project", path: "/web/p1", health: "healthy", model: "gpt-4" },
			],
		});

		const projects = await api.fetchProjects();

		expect(tauri.listProjects).not.toHaveBeenCalled();
		expect(projects).toHaveLength(1);
		expect(projects[0].name).toBe("Web Project");
	});

	it("routes fetchSkills to tauri.scanSkills when isTauri() is true", async () => {
		vi.mocked(isTauri).mockReturnValue(true);
		vi.mocked(tauri.scanSkills).mockResolvedValue([
			{ name: "Skill 1", description: "Desc 1", source: "local", installed: true },
		]);

		const skills = await api.fetchSkills();

		expect(tauri.scanSkills).toHaveBeenCalled();
		expect(skills).toHaveLength(1);
		expect(skills[0].name).toBe("Skill 1");
	});

	it("routes fetchSessions to tauri.listProjectSessions when isTauri() is true", async () => {
		vi.mocked(isTauri).mockReturnValue(true);
		vi.mocked(tauri.listProjectSessions).mockResolvedValue([
			{ id: "s1", timestamp: "2024-04-15", duration: "10m", summary: "Test Session" },
		]);

		const sessions = await api.fetchSessions("p1");

		expect(tauri.listProjectSessions).toHaveBeenCalledWith("p1", undefined);
		expect(sessions).toHaveLength(1);
		expect(sessions[0].summary).toBe("Test Session");
	});

	it("propagates Tauri errors when allowFallback is false (default)", async () => {
		vi.mocked(isTauri).mockReturnValue(true);
		const error = new Error("Rust panic");
		vi.mocked(tauri.listProjects).mockRejectedValue(error);

		await expect(api.fetchProjects()).rejects.toThrow("Rust panic");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("falls back to web when allowFallback is true and Tauri fails", async () => {
		vi.mocked(isTauri).mockReturnValue(true);

		// requireBackend skips fetch when isTauri() is true, so only PATCH mock needed
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				id: "p1",
				name: "Web Fallback",
				path: "/web/p1",
				health: "healthy",
				model: "gpt-4",
			}),
		});

		const result = await api.updateProject("p1", { alias: "New" });

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/projects/p1",
			expect.objectContaining({ method: "PATCH" }),
		);
		expect(result.name).toBe("Web Fallback");
	});

	it("throws error in removeProject when project not found in Tauri mode", async () => {
		vi.mocked(isTauri).mockReturnValue(true);
		vi.mocked(tauri.listProjects).mockResolvedValue([]);

		await expect(api.removeProject("non-existent")).rejects.toThrow(
			"Project not found: non-existent",
		);
	});

	it("checkHealth calls tauri.getHealth() in Tauri mode", async () => {
		vi.mocked(isTauri).mockReturnValue(true);
		vi.mocked(tauri.getHealth).mockResolvedValue({
			status: "ok",
			timestamp: "2024-04-15",
			uptime: 100,
			settingsExists: true,
			claudeJsonExists: true,
			projectsRegistryExists: true,
		});

		const result = await api.checkHealth();
		expect(result).toBe(true);
		expect(tauri.getHealth).toHaveBeenCalled();
	});

	it("touchProject invalidates the cached project lookup in Tauri mode", async () => {
		vi.mocked(isTauri).mockReturnValue(true);
		const projectPath = "/tmp/test";
		const projectId = api.tauriProjectId(projectPath);
		vi.mocked(tauri.listProjects).mockResolvedValue([
			{ name: "Test Project", path: projectPath, hasClaudeConfig: true, hasCkConfig: true },
		]);
		vi.mocked(tauri.readSettings).mockResolvedValue({});
		vi.mocked(tauri.touchProject).mockResolvedValue();

		await api.fetchProject(projectId);
		expect(tauri.listProjects).toHaveBeenCalledTimes(1);

		await api.fetchProject(projectId);
		expect(tauri.listProjects).toHaveBeenCalledTimes(1);

		await api.touchProject(projectPath);
		await api.fetchProject(projectId);

		expect(tauri.touchProject).toHaveBeenCalledWith(projectPath);
		expect(tauri.listProjects).toHaveBeenCalledTimes(2);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("propagates tauri settings errors from fetchSettingsFile", async () => {
		vi.mocked(isTauri).mockReturnValue(true);
		vi.mocked(tauri.getHomeDir).mockResolvedValue("/Users/test");
		vi.mocked(tauri.settingsFileExists).mockResolvedValue(true);
		vi.mocked(tauri.readSettings).mockRejectedValue(new Error("E_DENIED: capability check failed"));

		await expect(api.fetchSettingsFile()).rejects.toThrow(/E_DENIED/);
	});

	it("keeps missing settings.json distinct from an empty object in Tauri mode", async () => {
		vi.mocked(isTauri).mockReturnValue(true);
		vi.mocked(tauri.getHomeDir).mockResolvedValue("/Users/test");
		vi.mocked(tauri.settingsFileExists).mockResolvedValue(false);
		vi.mocked(tauri.readSettings).mockResolvedValue({});

		await expect(api.fetchSettingsFile()).resolves.toEqual({
			path: "/Users/test/.claude/settings.json",
			exists: false,
			settings: {},
		});
	});
});
