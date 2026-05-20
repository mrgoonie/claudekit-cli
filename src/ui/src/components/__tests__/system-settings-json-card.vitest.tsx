import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import * as api from "../../services/api";
import SystemSettingsJsonCard from "../system-settings-json-card";

const mockTranslations: Record<string, string> = {
	settingsJsonHeading: "Settings JSON",
	discard: "Discard",
	saveChanges: "Save Changes",
	saving: "Saving",
	saved: "Saved",
	saveFailed: "Save failed",
	settingsJsonMissing: "No settings file found",
	settingsJsonLoadFailed: "Failed to load ~/.claude/settings.json.",
	settingsLoadFailedDetail: "Error detail:",
	settingsBackupSaved: "Backup saved",
};

vi.mock("../../services/api", () => ({
	fetchSettingsFile: vi.fn(),
	saveSettingsFile: vi.fn(),
}));

vi.mock("../../i18n", () => ({
	useI18n: () => ({
		t: (key: string) => mockTranslations[key] ?? key,
	}),
}));

vi.mock("../config-editor", () => ({
	ConfigEditorJsonPanel: () => <div data-testid="config-editor" />,
}));

describe("SystemSettingsJsonCard error surface", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	test("renders specific error detail when fetch fails", async () => {
		vi.mocked(api.fetchSettingsFile).mockRejectedValue(
			new Error("E_DENIED: getGlobalConfigDir failed"),
		);

		render(<SystemSettingsJsonCard />);

		await waitFor(() => {
			expect(screen.getByText(/E_DENIED/)).toBeInTheDocument();
		});
	});
});
