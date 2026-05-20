import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanListItem } from "../../types/plan-dashboard-types";
import PlansPage from "../PlansPage";

const usePlansDashboardMock = vi.fn();
const localStorageMock = {
	getItem: vi.fn(() => null),
	setItem: vi.fn(),
	clear: vi.fn(),
};
type PlanListItemOverrides = Omit<Partial<PlanListItem>, "summary"> & {
	summary?: Partial<PlanListItem["summary"]>;
};

vi.mock("../../hooks/use-plans-dashboard", () => ({
	usePlansDashboard: (...args: unknown[]) => usePlansDashboardMock(...args),
}));

vi.mock("../../i18n", () => ({
	useI18n: () => ({
		t: (key: string) =>
			(
				({
					toolsSection: "Tools",
					plansTitle: "Plans Dashboard",
					plansGlobalTitle: "All Projects",
					plansSubtitle: "Track every project plan in one place.",
					plansEmpty: "No plans found",
					plansSearch: "Search plans...",
					plansProjectFilter: "Filter by project",
					plansAllProjects: "All projects",
					plansCompletedCount: "{count} completed",
					plansProjectPlans: "{count} plans",
					plansProjectLoadIssues: "Some projects could not be scanned",
					plansViewGrid: "Grid",
					plansViewKanban: "Kanban",
					plansSortDateDesc: "Newest",
					plansSortDateAsc: "Oldest",
					plansSortNameAsc: "Name A-Z",
					plansSortNameDesc: "Name Z-A",
					plansSortProgress: "Progress",
					plansFilterAll: "All statuses",
					plansStatusPending: "Pending",
					plansStatusInProgress: "In Progress",
					plansStatusInReview: "In Review",
					plansStatusDone: "Done",
					plansStatusCancelled: "Cancelled",
					plansPhaseCountCompact: "PH-{count}",
					kanbanProgress: "Progress",
					plansPriority: "Priority",
					plansUpdated: "Updated",
					loading: "Loading...",
				}) as Record<string, string>
			)[key] ?? key,
	}),
}));

function createPlan(overrides: PlanListItemOverrides): PlanListItem {
	const { summary: summaryOverrides, ...planOverrides } = overrides;
	return {
		file: "260414-default/plan.md",
		name: "260414-default",
		slug: "260414-default",
		projectId: "project-alpha",
		projectName: "Alpha",
		plansDir: "/tmp/alpha/plans",
		summary: {
			planDir: "260414-default",
			planFile: "260414-default/plan.md",
			title: "Default Plan",
			description: "Default description",
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
			...summaryOverrides,
		},
		...planOverrides,
	};
}

function renderPage(initialEntry = "/plans") {
	return render(
		<MemoryRouter initialEntries={[initialEntry]}>
			<PlansPage />
		</MemoryRouter>,
	);
}

describe("PlansPage", () => {
	beforeEach(() => {
		Object.defineProperty(window, "localStorage", {
			value: localStorageMock,
			configurable: true,
		});
		usePlansDashboardMock.mockReset();
		localStorageMock.getItem.mockReturnValue(null);
		localStorageMock.setItem.mockReset();
		localStorageMock.clear.mockReset();
	});

	it("renders grouped global plans with completed section and project filter", () => {
		usePlansDashboardMock.mockReturnValue({
			plans: [
				createPlan({
					slug: "260414-alpha-active",
					name: "260414-alpha-active",
					summary: { title: "Alpha Active", status: "in-progress", progressPct: 50 },
				}),
				createPlan({
					slug: "260414-alpha-done",
					name: "260414-alpha-done",
					summary: { title: "Alpha Done", status: "done", progressPct: 100 },
				}),
				createPlan({
					slug: "260414-beta-pending",
					name: "260414-beta-pending",
					projectId: "project-beta",
					projectName: "Beta",
					plansDir: "/tmp/beta/plans",
					summary: { title: "Beta Pending", status: "pending" },
				}),
			],
			projectOptions: [
				{ id: "project-alpha", name: "Alpha" },
				{ id: "project-beta", name: "Beta" },
			],
			projectErrors: [],
			loading: false,
			error: null,
			reload: vi.fn(),
		});

		renderPage();

		expect(screen.getByRole("heading", { name: "All Projects" })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Alpha", level: 2 })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Beta", level: 2 })).toBeInTheDocument();
		expect(screen.getByText("1 completed")).toBeInTheDocument();
		expect(screen.getByRole("combobox", { name: "Filter by project" })).toBeInTheDocument();
	});

	it("filters grouped plans across projects from the search input", async () => {
		usePlansDashboardMock.mockReturnValue({
			plans: [
				createPlan({
					slug: "260414-alpha-active",
					name: "260414-alpha-active",
					summary: { title: "Alpha Active", status: "in-progress" },
				}),
				createPlan({
					slug: "260414-beta-pending",
					name: "260414-beta-pending",
					projectId: "project-beta",
					projectName: "Beta",
					plansDir: "/tmp/beta/plans",
					summary: { title: "Beta Pending", status: "pending" },
				}),
			],
			projectOptions: [
				{ id: "project-alpha", name: "Alpha" },
				{ id: "project-beta", name: "Beta" },
			],
			projectErrors: [],
			loading: false,
			error: null,
			reload: vi.fn(),
		});

		renderPage();
		await userEvent.type(screen.getByPlaceholderText("Search plans..."), "beta");

		expect(screen.queryByRole("heading", { name: "Alpha", level: 2 })).not.toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Beta", level: 2 })).toBeInTheDocument();
	});

	it("shows the empty state when no plans exist", () => {
		usePlansDashboardMock.mockReturnValue({
			plans: [],
			projectOptions: [],
			projectErrors: [],
			loading: false,
			error: null,
			reload: vi.fn(),
		});

		renderPage();

		expect(screen.getByText("No plans found")).toBeInTheDocument();
	});

	it("shows partial project scan failures without hiding healthy projects", () => {
		usePlansDashboardMock.mockReturnValue({
			plans: [
				createPlan({
					slug: "260414-alpha-active",
					name: "260414-alpha-active",
					summary: { title: "Alpha Active", status: "in-progress" },
				}),
			],
			projectOptions: [{ id: "project-alpha", name: "Alpha" }],
			projectErrors: [{ id: "project-broken", name: "Broken", error: "Scan timed out" }],
			loading: false,
			error: null,
			reload: vi.fn(),
		});

		renderPage();

		expect(screen.getByText("Some projects could not be scanned")).toBeInTheDocument();
		expect(screen.getByText("Broken")).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Alpha", level: 2 })).toBeInTheDocument();
	});

	it("honors view=kanban from the URL over the default grid mode", () => {
		usePlansDashboardMock.mockReturnValue({
			plans: [
				createPlan({
					slug: "260414-alpha-active",
					name: "260414-alpha-active",
					summary: { title: "Alpha Active", status: "in-progress" },
				}),
			],
			projectOptions: [{ id: "project-alpha", name: "Alpha" }],
			projectErrors: [],
			loading: false,
			error: null,
			reload: vi.fn(),
		});

		renderPage("/plans?view=kanban");

		expect(screen.getByRole("heading", { name: "Pending", level: 2 })).toBeInTheDocument();
		expect(screen.queryByRole("heading", { name: "Alpha", level: 2 })).not.toBeInTheDocument();
	});
});
