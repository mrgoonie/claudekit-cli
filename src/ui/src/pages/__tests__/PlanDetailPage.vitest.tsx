import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
const navigateMock = vi.fn();
const translate = (key: string) =>
	(
		({
			plansBackToPlans: "Back to Plans",
			plansLoadingPlan: "Loading plan...",
			plansLoadPlanFailed: "Failed to load plan ({status})",
			plansLoadPlanFallback: "Failed to load plan",
			error: "Error",
			refresh: "Refresh",
			plansNotFound: "Plan not found",
			actionFailed: "Action failed",
			plansQuickInfoTitle: "Plan Overview",
			plansQuickInfoDescription: "Quick info",
			plansCurrentStatus: "Current Status",
			plansStatusPending: "Pending",
			plansStatusInProgress: "In Progress",
			plansStatusInReview: "In Review",
			plansStatusDone: "Done",
			plansStatusCancelled: "Cancelled",
			plansStatusUnknown: "Unknown",
		}) as Record<string, string>
	)[key] ?? key;

vi.mock("react-router-dom", async () => {
	const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
	return {
		...actual,
		useNavigate: () => navigateMock,
		useParams: () => ({ planSlug: "demo-plan" }),
		useSearchParams: () => [
			new URLSearchParams("dir=%2Ftmp%2Fproject%2Fplans&projectId=project-alpha&origin=global"),
			vi.fn(),
		],
	};
});

vi.mock("../../hooks/use-plan-actions", () => ({
	usePlanActions: () => ({
		trigger: vi.fn(),
		pendingId: null,
		loading: false,
		error: null,
	}),
}));

vi.mock("../../components/plans/HeatmapPanel", () => ({
	default: () => <div>Heatmap</div>,
}));

vi.mock("../../components/plans/PhaseList", () => ({
	default: () => <div>Phase List</div>,
}));

vi.mock("../../components/plans/PlanHeader", () => ({
	default: () => <div>Plan Header</div>,
}));

vi.mock("../../components/plans/PlanTimeline", () => ({
	default: () => <div>Timeline</div>,
}));

vi.mock("../../i18n", () => ({
	useI18n: () => ({
		t: translate,
	}),
}));

import PlanDetailPage from "../PlanDetailPage";

describe("PlanDetailPage", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", fetchMock);
		fetchMock.mockReset();
		navigateMock.mockReset();
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({
				plan: {
					planDir: "/tmp/project/plans/demo-plan",
					planFile: "/tmp/project/plans/demo-plan/plan.md",
					title: "Demo Plan",
					status: "pending",
					priority: "P1",
					tags: [],
					blockedBy: [],
					blocks: [],
					totalPhases: 1,
					completed: 0,
					inProgress: 0,
					pending: 1,
					progressPct: 0,
					phases: [],
				},
				timeline: {
					rangeStart: "2026-04-01",
					rangeEnd: "2026-04-02",
					today: "2026-04-01",
					todayPct: 50,
					layerCount: 1,
					phases: [],
					summary: {
						totalEffortHours: 0,
						avgDurationDays: 0,
						completionRate: 0,
					},
				},
			}),
		});
	});

	it("returns to the global plans dashboard when opened from aggregate mode", async () => {
		render(<PlanDetailPage />);

		await waitFor(() => expect(screen.queryByText("Loading plan...")).not.toBeInTheDocument(), {
			timeout: 5000,
		});
		const backButton = screen.getByRole("button", { name: "Back to Plans" });
		fireEvent.click(backButton);

		expect(navigateMock).toHaveBeenCalledWith("/plans");
	});
});
