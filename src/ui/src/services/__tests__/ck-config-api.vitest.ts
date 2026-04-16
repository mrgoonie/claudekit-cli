import { beforeEach, describe, expect, it, vi } from "vitest";
import { isTauri } from "../../hooks/use-tauri";
import * as tauri from "../../lib/tauri-commands";
import { fetchCkConfigScope, saveCkConfig, updateCkConfigField } from "../ck-config-api";

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

	it("falls back to an empty config when stored desktop config is invalid", async () => {
		vi.mocked(tauri.readConfig).mockResolvedValue({
			statuslineLayout: {
				theme: {
					accent: "#ff00ff",
				},
			},
		});

		const response = await fetchCkConfigScope("global");

		expect(response.config).toEqual({});
		expect(response.globalPath).toBe("/Users/test/.claude/.ck.json");
	});

	it("rejects invalid desktop field updates before writing", async () => {
		vi.mocked(tauri.readConfig).mockResolvedValue({});

		await expect(
			updateCkConfigField("statuslineLayout.theme.accent", "#ff00ff", "global"),
		).rejects.toThrow();
		expect(tauri.writeConfig).not.toHaveBeenCalled();
	});
});
