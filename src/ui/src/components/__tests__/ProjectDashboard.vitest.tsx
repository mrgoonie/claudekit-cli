import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { isTauri } from "../../hooks/use-tauri";
import { HealthStatus, KitType, type Project } from "../../types";
import ProjectDashboard from "../ProjectDashboard";

const fetchActionOptionsMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
	const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
	return {
		...actual,
		useNavigate: () => navigateMock,
	};
});

vi.mock("../../hooks", () => ({
	useSessions: () => ({ sessions: [], loading: false }),
}));

vi.mock("../../hooks/use-tauri", () => ({
	isTauri: vi.fn(),
}));

vi.mock("../../i18n", () => ({
	useI18n: () => ({
		t: (key: string) =>
			(
				({
					sessions: "sessions",
					noSessions: "No sessions",
					actionFailed: "Action failed",
					actionOptionsLoadFailed: "Could not load editor/terminal options",
					tryAgain: "Try again",
					terminal: "Terminal",
					terminalSub: "Open bash at path",
					editor: "Editor",
					editorSub: "Open in VS Code",
					launch: "Launch",
					launchSub: "Start Claude Code",
					config: "Config",
					configSub: "Manage project settings",
					openAppOnly: "Open app only",
					openAtPath: "Open at path",
					useGlobalFallback: "Use global fallback",
					planSettingsTitle: "Plan Settings",
					planScopeGlobal: "global",
					planScopeProject: "project",
					plansDirectory: "Plans Directory",
					validationMode: "Validation Mode",
					planScopeLabel: "Scope",
					activePlansLabel: "Active Plans",
					activePlansTitle: "Active Plans",
					noActivePlansFound: "No active plans found",
					openPlan: "Open Plan",
					openKanban: "Open Kanban",
					blockedByLabel: "Blocked by",
					progressLabel: "Progress",
					editProjectConfig: "Edit Project Config",
					plansNav: "Plans",
					projectPreferenceSaveFailed: "Failed to save preference",
					desktopModeActionsMessage:
						"Project quick actions stay in the CLI or web dashboard in desktop mode.",
					desktopModePlansMessage: "Plan dashboards still run in the web workflow in desktop mode.",
					desktopModeQuickActionsHint:
						"Desktop mode keeps project quick actions in the CLI for now. Use ck config, ck migrate, or your terminal/editor directly for server-backed actions.",
					detected: "Detected",
					notDetected: "Not detected",
				}) as Record<string, string>
			)[key] ?? key,
	}),
}));

vi.mock("../../services/api", () => ({
	fetchActionOptions: (...args: unknown[]) => fetchActionOptionsMock(...args),
	openAction: vi.fn(),
	updateProject: vi.fn(),
}));

vi.mock("../config-editor", () => ({
	DevelopmentBadge: () => <span>beta</span>,
}));

function createProject(): Project {
	return {
		id: "project-alpha",
		name: "Alpha",
		path: "/tmp/alpha",
		health: HealthStatus.HEALTHY,
		kitType: KitType.ENGINEER,
		model: "gpt-5",
		activeHooks: 0,
		mcpServers: 0,
		skills: [],
		planSettings: {
			scope: "project",
			plansDir: "/tmp/alpha/plans",
			validationMode: "prompt",
			activePlanCount: 1,
		},
		activePlans: [
			{
				planDir: "/tmp/alpha/plans/260414-demo",
				planFile: "/tmp/alpha/plans/260414-demo/plan.md",
				title: "Demo Plan",
				status: "in-progress",
				tags: [],
				blockedBy: [],
				blocks: [],
				totalPhases: 4,
				completed: 2,
				inProgress: 1,
				pending: 1,
				progressPct: 50,
			},
		],
	};
}

describe("ProjectDashboard", () => {
	it("routes Kanban shortcuts into the Plans page view state", async () => {
		vi.mocked(isTauri).mockReturnValue(false);
		navigateMock.mockReset();
		fetchActionOptionsMock.mockResolvedValue({
			platform: "darwin",
			terminals: [],
			editors: [],
			defaults: {
				terminalApp: "terminal",
				terminalSource: "system",
				editorApp: "code",
				editorSource: "system",
			},
			preferences: {
				project: {},
				global: {},
			},
		});

		render(
			<MemoryRouter>
				<ProjectDashboard project={createProject()} />
			</MemoryRouter>,
		);

		await waitFor(() => expect(fetchActionOptionsMock).toHaveBeenCalled());
		await userEvent.click(screen.getByRole("button", { name: "Open Kanban" }));

		expect(navigateMock).toHaveBeenCalledWith(
			"/plans?dir=%2Ftmp%2Falpha%2Fplans&projectId=project-alpha&view=kanban",
		);
	});

	it("disables desktop-only dead ends instead of retrying backend flows", () => {
		vi.mocked(isTauri).mockReturnValue(true);
		navigateMock.mockReset();
		fetchActionOptionsMock.mockReset();

		render(
			<MemoryRouter>
				<ProjectDashboard project={createProject()} />
			</MemoryRouter>,
		);

		expect(fetchActionOptionsMock).not.toHaveBeenCalled();
		expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();

		for (const button of screen.getAllByRole("button", { name: /Open Kanban/ })) {
			expect(button).toBeDisabled();
		}
		for (const button of screen.getAllByRole("button", { name: /Open Plan/ })) {
			expect(button).toBeDisabled();
		}
		expect(screen.getByText(/Plan dashboards still run in the web workflow/i)).toBeInTheDocument();
	});
});
