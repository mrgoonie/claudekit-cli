import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlansDashboard } from "../use-plans-dashboard";

describe("usePlansDashboard", () => {
	const fetchMock = vi.fn();

	beforeEach(() => {
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		fetchMock.mockReset();
	});

	it("calls the multi-project endpoint and flattens project metadata", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({
				totalPlans: 2,
				projects: [
					{
						id: "project-alpha",
						name: "Alpha",
						path: "/tmp/alpha",
						plansDir: "/tmp/alpha/plans",
						plans: [
							{
								file: "260414-alpha-active/plan.md",
								name: "260414-alpha-active",
								slug: "260414-alpha-active",
								summary: {
									progressPct: 50,
									status: "in-progress",
									tags: [],
									blockedBy: [],
									blocks: [],
									phases: [],
									totalPhases: 2,
									completed: 1,
									inProgress: 1,
									pending: 0,
									planDir: "260414-alpha-active",
									planFile: "260414-alpha-active/plan.md",
								},
							},
						],
					},
					{
						id: "project-beta",
						name: "Beta",
						path: "/tmp/beta",
						plansDir: "/tmp/beta/plans",
						plans: [
							{
								file: "260414-beta-pending/plan.md",
								name: "260414-beta-pending",
								slug: "260414-beta-pending",
								summary: {
									progressPct: 0,
									status: "pending",
									tags: [],
									blockedBy: [],
									blocks: [],
									phases: [],
									totalPhases: 1,
									completed: 0,
									inProgress: 0,
									pending: 1,
									planDir: "260414-beta-pending",
									planFile: "260414-beta-pending/plan.md",
								},
							},
						],
					},
				],
			}),
		});

		const { result } = renderHook(() => usePlansDashboard("plans", null));

		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(fetchMock).toHaveBeenCalledWith("/api/plan/list-all");
		expect(result.current.plans).toHaveLength(2);
		expect(result.current.projectOptions).toEqual([
			{ id: "project-alpha", name: "Alpha" },
			{ id: "project-beta", name: "Beta" },
		]);
		expect(result.current.projectErrors).toEqual([]);
		expect(result.current.plans[0]).toMatchObject({
			projectId: "project-alpha",
			projectName: "Alpha",
			plansDir: "/tmp/alpha/plans",
		});
	});

	it("preserves project-level errors from aggregate responses", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({
				totalPlans: 1,
				projects: [
					{
						id: "project-alpha",
						name: "Alpha",
						path: "/tmp/alpha",
						plansDir: "/tmp/alpha/plans",
						plans: [
							{
								file: "260414-alpha-active/plan.md",
								name: "260414-alpha-active",
								slug: "260414-alpha-active",
								summary: {
									progressPct: 50,
									status: "in-progress",
									tags: [],
									blockedBy: [],
									blocks: [],
									phases: [],
									totalPhases: 2,
									completed: 1,
									inProgress: 1,
									pending: 0,
									planDir: "260414-alpha-active",
									planFile: "260414-alpha-active/plan.md",
								},
							},
						],
					},
					{
						id: "project-broken",
						name: "Broken",
						path: "/tmp/broken",
						plansDir: "/tmp/broken/plans",
						error: "Scan timed out",
						plans: [],
					},
				],
			}),
		});

		const { result } = renderHook(() => usePlansDashboard("plans", null));

		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(result.current.projectErrors).toEqual([
			{ id: "project-broken", name: "Broken", error: "Scan timed out" },
		]);
	});

	it("uses the single-project endpoint when projectId is present", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({ dir: "plans", total: 0, limit: 500, offset: 0, plans: [] }),
		});

		const { result } = renderHook(() => usePlansDashboard("plans", "project-alpha"));

		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/plan/list?dir=plans&limit=500&offset=0&projectId=project-alpha",
		);
		expect(result.current.plans).toEqual([]);
		expect(result.current.projectOptions).toEqual([]);
		expect(result.current.projectErrors).toEqual([]);
	});
});
