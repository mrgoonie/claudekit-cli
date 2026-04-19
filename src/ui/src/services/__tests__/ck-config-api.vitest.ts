import { fetchProject } from "@/services/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isTauri } from "../../hooks/use-tauri";
import * as tauri from "../../lib/tauri-commands";
import {
	fetchCkConfigSchema,
	fetchCkConfigScope,
	saveCkConfig,
	updateCkConfigField,
} from "../ck-config-api";

vi.mock("@/services/api", () => ({
	fetchProject: vi.fn(),
}));

vi.mock("../../lib/tauri-commands", () => ({
	getGlobalConfigDir: vi.fn(),
	readConfig: vi.fn(),
	writeConfig: vi.fn(),
}));

vi.mock("../../hooks/use-tauri", () => ({
	isTauri: vi.fn(),
}));

describe("ck-config-api desktop mode", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.mocked(isTauri).mockReturnValue(true);
		vi.mocked(tauri.getGlobalConfigDir).mockResolvedValue("/Users/test/.claude");
	});

	it("normalizes and merges global config before writing in desktop mode", async () => {
		vi.mocked(tauri.readConfig).mockResolvedValue({ privacyBlock: false });

		await saveCkConfig({
			scope: "global",
			config: {
				gemini: {
					model: "gemini-3.0-flash",
				},
			},
		});

		expect(tauri.writeConfig).toHaveBeenCalledWith(
			"/Users/test",
			expect.objectContaining({
				privacyBlock: false,
				gemini: { model: "gemini-3-flash-preview" },
			}),
		);
	});

	it("returns raw config as fallback when stored desktop config is invalid", async () => {
		const rawConfig = {
			statuslineLayout: {
				theme: {
					accent: "#ff00ff",
				},
			},
		};
		vi.mocked(tauri.readConfig).mockResolvedValue(rawConfig);

		const response = await fetchCkConfigScope("global");

		expect(response.config).toEqual(rawConfig);
		expect(response.globalPath).toBe("/Users/test/.claude/.ck.json");
	});

	it("resolves project scope paths with a path join safe for desktop mode", async () => {
		vi.mocked(fetchProject).mockResolvedValue({
			id: "project-alpha",
			name: "Alpha",
			path: "C:/repo",
			health: "healthy",
			kitType: "engineer",
			model: "gpt-5",
			activeHooks: 0,
			mcpServers: 0,
			skills: [],
		} as never);
		vi.mocked(tauri.readConfig).mockResolvedValue({});

		const response = await fetchCkConfigScope("project", "project-alpha");

		expect(tauri.readConfig).toHaveBeenCalledWith("C:/repo");
		expect(response.projectPath).toBe("C:/repo/.claude/.ck.json");
	});

	it("returns the bundled schema in desktop mode", async () => {
		const schema = await fetchCkConfigSchema();

		expect(schema).toHaveProperty("properties");
		expect(schema).toHaveProperty("$id");
	});

	it("rejects invalid desktop field updates before writing", async () => {
		vi.mocked(tauri.readConfig).mockResolvedValue({});

		await expect(
			updateCkConfigField("statuslineLayout.theme.accent", "#ff00ff", "global"),
		).rejects.toThrow();
		expect(tauri.writeConfig).not.toHaveBeenCalled();
	});

	it("updates a valid desktop field even when unrelated stored config is invalid", async () => {
		vi.mocked(tauri.readConfig).mockResolvedValue({
			statuslineLayout: {
				theme: {
					accent: "#ff00ff",
				},
			},
		});

		await updateCkConfigField("privacyBlock", false, "global");

		expect(tauri.writeConfig).toHaveBeenCalledWith("/Users/test", {
			statuslineLayout: {
				theme: {
					accent: "#ff00ff",
				},
			},
			privacyBlock: false,
		});
	});
});
