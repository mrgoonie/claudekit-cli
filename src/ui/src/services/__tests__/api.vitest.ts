import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api";

describe("api service web-mode routing", () => {
	const fetchMock = vi.fn();

	beforeEach(() => {
		vi.resetAllMocks();
		vi.stubGlobal("fetch", fetchMock);
	});

	it("routes fetchProjects to fetch('/api/projects') when backend is available", async () => {
		// requireBackend health check
		fetchMock.mockResolvedValueOnce({ ok: true });
		// projects fetch (no second arg object for simple GETs)
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => [
				{
					id: "p1",
					name: "Web Project",
					path: "/web/p1",
					health: "healthy",
					model: "gpt-4",
					kitType: "engineer",
					activeHooks: 0,
					mcpServers: 0,
					skills: [],
					hasLocalConfig: true,
					version: null,
				},
			],
		});

		const projects = await api.fetchProjects();

		expect(projects).toHaveLength(1);
		expect(projects[0].name).toBe("Web Project");
		expect(fetchMock).toHaveBeenCalledWith("/api/projects");
	});

	it("throws ServerUnavailableError when backend health check fails", async () => {
		fetchMock.mockRejectedValueOnce(new Error("connection refused"));

		await expect(api.fetchProjects()).rejects.toThrow("Backend server is not running");
	});

	it("routes updateProject to PATCH /api/projects/:id", async () => {
		// requireBackend health check
		fetchMock.mockResolvedValueOnce({ ok: true });
		// PATCH response
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				id: "p1",
				name: "Updated Project",
				path: "/web/p1",
				health: "healthy",
				model: "gpt-4",
				kitType: "engineer",
				activeHooks: 0,
				mcpServers: 0,
				skills: [],
				hasLocalConfig: true,
				version: null,
			}),
		});

		const result = await api.updateProject("p1", { alias: "Updated Project" });

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/projects/p1",
			expect.objectContaining({ method: "PATCH" }),
		);
		expect(result.name).toBe("Updated Project");
	});

	it("routes fetchSessions to GET /api/sessions/:projectId", async () => {
		// requireBackend health check
		fetchMock.mockResolvedValueOnce({ ok: true });
		// sessions fetch
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => [{ id: "s1", timestamp: "2024-04-15", duration: "10m", summary: "Test" }],
		});

		const sessions = await api.fetchSessions("p1");

		expect(sessions).toHaveLength(1);
		expect(sessions[0].summary).toBe("Test");
		expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/sessions/p1"));
	});

	it("checkHealth returns true when backend responds ok", async () => {
		fetchMock.mockResolvedValueOnce({ ok: true });

		const result = await api.checkHealth();

		expect(result).toBe(true);
	});

	it("checkHealth returns false when backend responds with error status", async () => {
		fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

		const result = await api.checkHealth();

		expect(result).toBe(false);
	});

	it("fetchSettingsFile returns settings from GET /api/settings/raw", async () => {
		// requireBackend health check
		fetchMock.mockResolvedValueOnce({ ok: true });
		// settings fetch
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				path: "/Users/test/.claude/settings.json",
				exists: true,
				settings: { theme: "dark" },
			}),
		});

		const result = await api.fetchSettingsFile();

		expect(result.exists).toBe(true);
		expect(result.settings).toEqual({ theme: "dark" });
	});
});
