import { render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import KanbanPage from "../KanbanPage";

vi.mock("../../i18n", () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

function LocationProbe() {
	const location = useLocation();
	return (
		<div data-testid="location">
			{location.pathname}
			{location.search}
		</div>
	);
}

describe("KanbanPage", () => {
	it("redirects legacy kanban links into Plans kanban mode", async () => {
		const router = createMemoryRouter(
			[
				{ path: "/kanban", element: <KanbanPage /> },
				{ path: "/plans", element: <LocationProbe /> },
			],
			{
				initialEntries: [
					"/kanban?file=%2Ftmp%2Falpha%2Fplans%2F260414-demo%2Fplan.md&projectId=project-alpha",
				],
			},
		);

		render(<RouterProvider router={router} />);

		const location = await screen.findByTestId("location");
		expect(location).toHaveTextContent("/plans?");
		expect(location).toHaveTextContent("dir=%2Ftmp%2Falpha%2Fplans");
		expect(location).toHaveTextContent("projectId=project-alpha");
		expect(location).toHaveTextContent("view=kanban");
	});

	it("falls back to the plans dashboard when the legacy kanban link has no file", async () => {
		const router = createMemoryRouter(
			[
				{ path: "/kanban", element: <KanbanPage /> },
				{ path: "/plans", element: <LocationProbe /> },
			],
			{ initialEntries: ["/kanban"] },
		);

		render(<RouterProvider router={router} />);

		expect(await screen.findByTestId("location")).toHaveTextContent("/plans");
	});
});
