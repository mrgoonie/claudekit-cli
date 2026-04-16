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
	desktopOnboardingScanPartialWarning:
		"{count} scan target(s) could not be read. Showing the projects that were discovered successfully.",
	desktopOnboardingSelectedCount: "{count} selected",
	desktopOnboardingContinue: "Continue",
	desktopOnboardingSkip: "Skip for now",
	desktopOnboardingSaving: "Saving...",
	desktopOnboardingDoneTitle: "You're ready to go",
	desktopOnboardingDoneDescription: "Saved",
	desktopOnboardingOpenDashboard: "Open Dashboard",
	desktopOnboardingKitDetected: "ClaudeKit detected",
	desktopOnboardingAddFailed: "Failed to add the selected projects",
	desktopOnboardingPartialAddWarning:
		"{failed} of {total} selected projects could not be added. You can register them manually later.",
};

vi.mock("../../../lib/tauri-commands", () => ({
	getHomeDir: vi.fn(),
	scanForProjects: vi.fn(),
}));

vi.mock("../../../services/api", () => ({
	addProject: vi.fn(),
}));

vi.mock("../../../services/desktop-onboarding-state", () => ({
	setDesktopOnboardingCompleted: vi.fn(),
}));

const outletContext = {
	project: null,
	isConnected: true,
	theme: "dark" as const,
	onToggleTheme: vi.fn(),
	reloadProjects: vi.fn().mockResolvedValue(undefined),
	dismissDesktopOnboarding: vi.fn(),
};

vi.mock("../../../i18n", () => ({
	useI18n: () => ({
		t: (key: string) => onboardingTranslations[key] ?? key,
	}),
}));

vi.mock("react-router-dom", async () => {
	const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
	return {
		...actual,
		useNavigate: () => navigateMock,
		useOutletContext: () => outletContext,
	};
});

describe("DesktopOnboardingPage", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		navigateMock.mockReset();
		outletContext.reloadProjects.mockResolvedValue(undefined);
		outletContext.reloadProjects.mockClear();
		outletContext.dismissDesktopOnboarding.mockClear();
		vi.mocked(tauri.getHomeDir).mockResolvedValue("/Users/test");
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
		expect(tauri.scanForProjects).toHaveBeenNthCalledWith(1, "/Users/test", 1);
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
		expect(outletContext.reloadProjects).toHaveBeenCalledTimes(1);
		expect(outletContext.dismissDesktopOnboarding).toHaveBeenCalledTimes(1);
		expect(setDesktopOnboardingCompleted).toHaveBeenCalledWith(true);

		await userEvent.click(screen.getByRole("button", { name: "Open Dashboard" }));
		expect(navigateMock).toHaveBeenCalledWith("/project/project-alpha", { replace: true });
	});

	it("lets the user skip onboarding without adding projects", async () => {
		render(
			<MemoryRouter>
				<DesktopOnboardingPage />
			</MemoryRouter>,
		);

		await userEvent.click(screen.getByRole("button", { name: "Skip for now" }));

		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Open Dashboard" })).toBeInTheDocument(),
		);

		expect(addProject).not.toHaveBeenCalled();
		expect(outletContext.reloadProjects).not.toHaveBeenCalled();
		expect(outletContext.dismissDesktopOnboarding).toHaveBeenCalledTimes(1);
		expect(setDesktopOnboardingCompleted).toHaveBeenCalledWith(true);
	});

	it("does not warn when optional scan roots are simply missing", async () => {
		vi.mocked(tauri.scanForProjects).mockReset();
		vi.mocked(tauri.scanForProjects)
			.mockResolvedValueOnce([])
			.mockRejectedValueOnce(
				new Error("Scan root is not a directory or does not exist: /Users/test/projects"),
			)
			.mockRejectedValueOnce(
				new Error("Scan root is not a directory or does not exist: /Users/test/code"),
			)
			.mockRejectedValueOnce(
				new Error("Scan root is not a directory or does not exist: /Users/test/dev"),
			);

		render(
			<MemoryRouter>
				<DesktopOnboardingPage />
			</MemoryRouter>,
		);

		await userEvent.click(screen.getByRole("button", { name: "Find My Projects" }));

		await waitFor(() => expect(screen.getByText("No projects found")).toBeInTheDocument());

		expect(
			screen.queryByText(
				"1 scan target(s) could not be read. Showing the projects that were discovered successfully.",
			),
		).not.toBeInTheDocument();
	});

	it("keeps Continue disabled when nothing is selected", async () => {
		render(
			<MemoryRouter>
				<DesktopOnboardingPage />
			</MemoryRouter>,
		);

		await userEvent.click(screen.getByRole("button", { name: "Find My Projects" }));
		await waitFor(() =>
			expect(screen.getByRole("heading", { name: "Choose projects to add" })).toBeInTheDocument(),
		);

		await userEvent.click(screen.getByLabelText(/\/Users\/test\/projects\/alpha/i));
		await userEvent.click(screen.getByLabelText(/\/Users\/test\/code\/beta/i));

		expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
	});

	it("shows a warning when some scan targets fail and still allows skipping", async () => {
		vi.mocked(tauri.scanForProjects).mockReset();
		vi.mocked(tauri.scanForProjects)
			.mockRejectedValueOnce(new Error("bad root"))
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);

		render(
			<MemoryRouter>
				<DesktopOnboardingPage />
			</MemoryRouter>,
		);

		await userEvent.click(screen.getByRole("button", { name: "Find My Projects" }));

		await waitFor(() =>
			expect(
				screen.getByText(
					"1 scan target(s) could not be read. Showing the projects that were discovered successfully.",
				),
			).toBeInTheDocument(),
		);
		expect(screen.getByRole("button", { name: "Skip for now" })).toBeInTheDocument();
	});
});
