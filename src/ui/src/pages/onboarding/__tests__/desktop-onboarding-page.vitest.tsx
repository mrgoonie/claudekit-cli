import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as tauri from "../../../lib/tauri-commands";
import { addProject } from "../../../services/api";
import { setDesktopOnboardingCompleted } from "../../../services/desktop-onboarding-state";
import DesktopOnboardingPage from "../desktop-onboarding-page";

const navigateMock = vi.fn();
const onboardingTranslations: Record<string, string> = {
	desktopOnboardingEyebrow: "First Run",
	desktopOnboardingTitle: "Welcome to ClaudeKit Control Center",
	desktopOnboardingDescription: "Welcome description",
	desktopOnboardingWelcomeBody: "Welcome body",
	desktopOnboardingStart: "Find My Projects",
	desktopOnboardingScanning: "Scanning common development folders...",
	desktopOnboardingScanningHint: "Scan hint",
	desktopOnboardingSelectTitle: "Choose projects to add",
	desktopOnboardingSelectDescription: "Pick projects",
	desktopOnboardingNoProjects: "No projects found",
	desktopOnboardingSelectedCount: "{count} selected",
	desktopOnboardingContinue: "Continue",
	desktopOnboardingSkip: "Skip for now",
	desktopOnboardingSaving: "Saving...",
	desktopOnboardingDoneTitle: "You're ready to go",
	desktopOnboardingDoneDescription: "Saved",
	desktopOnboardingOpenDashboard: "Open Dashboard",
	desktopOnboardingKitDetected: "ClaudeKit detected",
	desktopOnboardingAddFailed: "Failed to add the selected projects",
};

vi.mock("react-router-dom", async () => {
	const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
	return {
		...actual,
		useNavigate: () => navigateMock,
	};
});

vi.mock("../../../lib/tauri-commands", () => ({
	getGlobalConfigDir: vi.fn(),
	scanForProjects: vi.fn(),
}));

vi.mock("../../../services/api", () => ({
	addProject: vi.fn(),
}));

vi.mock("../../../services/desktop-onboarding-state", () => ({
	setDesktopOnboardingCompleted: vi.fn(),
}));

vi.mock("../../../i18n", () => ({
	useI18n: () => ({
		t: (key: string) => onboardingTranslations[key] ?? key,
	}),
}));

describe("DesktopOnboardingPage", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.mocked(tauri.getGlobalConfigDir).mockResolvedValue("/Users/test/.claude");
		vi.mocked(tauri.scanForProjects)
			.mockResolvedValueOnce([
				{
					name: "alpha",
					path: "/Users/test/projects/alpha",
					hasClaudeConfig: true,
					hasCkConfig: true,
				},
			])
			.mockResolvedValueOnce([
				{
					name: "alpha",
					path: "/Users/test/projects/alpha",
					hasClaudeConfig: true,
					hasCkConfig: true,
				},
				{
					name: "beta",
					path: "/Users/test/code/beta",
					hasClaudeConfig: true,
					hasCkConfig: false,
				},
			])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);
		vi.mocked(addProject)
			.mockResolvedValueOnce({
				id: "project-alpha",
			} as never)
			.mockResolvedValueOnce({
				id: "project-beta",
			} as never);
	});

	it("scans common roots, lets the user pick projects, and persists completion", async () => {
		render(
			<MemoryRouter>
				<DesktopOnboardingPage />
			</MemoryRouter>,
		);

		await userEvent.click(screen.getByRole("button", { name: "Find My Projects" }));

		await waitFor(() =>
			expect(screen.getByRole("heading", { name: "Choose projects to add" })).toBeInTheDocument(),
		);

		expect(tauri.scanForProjects).toHaveBeenCalledTimes(4);
		expect(tauri.scanForProjects).toHaveBeenNthCalledWith(1, "/Users/test", 3);
		expect(tauri.scanForProjects).toHaveBeenNthCalledWith(2, "/Users/test/projects", 3);
		expect(tauri.scanForProjects).toHaveBeenNthCalledWith(3, "/Users/test/code", 3);
		expect(tauri.scanForProjects).toHaveBeenNthCalledWith(4, "/Users/test/dev", 3);
		expect(screen.getAllByRole("checkbox")).toHaveLength(2);

		await userEvent.click(screen.getByLabelText(/\/Users\/test\/code\/beta/i));
		await userEvent.click(screen.getByRole("button", { name: "Continue" }));

		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Open Dashboard" })).toBeInTheDocument(),
		);

		expect(addProject).toHaveBeenCalledTimes(1);
		expect(addProject).toHaveBeenCalledWith({ path: "/Users/test/projects/alpha" });
		expect(setDesktopOnboardingCompleted).toHaveBeenCalledWith(true);

		await userEvent.click(screen.getByRole("button", { name: "Open Dashboard" }));
		expect(navigateMock).toHaveBeenCalledWith("/project/project-alpha", { replace: true });
	});
});
