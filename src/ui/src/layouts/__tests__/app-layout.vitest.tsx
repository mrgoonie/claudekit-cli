import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn();
const routeState = {
	pathname: "/project/project-alpha",
	projectId: "project-alpha" as string | undefined,
};

vi.mock("react-router-dom", () => ({
	Outlet: () => <div>outlet</div>,
	useLocation: () => ({ pathname: routeState.pathname }),
	useNavigate: () => navigateMock,
	useParams: () => ({ projectId: routeState.projectId }),
}));

vi.mock("../../components/SearchPalette", () => ({
	default: () => null,
}));

vi.mock("../../components/Sidebar", () => ({
	default: () => null,
}));

vi.mock("../../components/ResizeHandle", () => ({
	default: () => null,
}));

vi.mock("../../hooks", () => ({
	useProjects: () => ({
		projects: [
			{
				id: routeState.projectId ?? "project-alpha",
				name: "Alpha",
				path: "/tmp/alpha",
				health: "healthy",
				kitType: "engineer",
				model: "gpt-5",
				activeHooks: 0,
				mcpServers: 0,
				skills: [],
			},
		],
		loading: false,
		error: null,
		addProject: vi.fn(),
		reload: vi.fn(),
	}),
}));

vi.mock("../../hooks/useResizable", () => ({
	useResizable: () => ({
		size: 288,
		isDragging: false,
		startDrag: vi.fn(),
		setSize: vi.fn(),
	}),
}));

vi.mock("../../i18n", () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

describe("AppLayout web mode", () => {
	beforeEach(() => {
		vi.resetModules();
		navigateMock.mockReset();
		routeState.pathname = "/project/project-alpha";
		routeState.projectId = "project-alpha";
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			value: {
				getItem: vi.fn().mockReturnValue(null),
				setItem: vi.fn(),
				removeItem: vi.fn(),
				clear: vi.fn(),
			},
		});
	});

	it("renders the outlet slot", async () => {
		const { default: AppLayout } = await import("../AppLayout");

		render(<AppLayout />);

		expect(screen.getByText("outlet")).toBeInTheDocument();
	});

	it("does not navigate on mount in web mode", async () => {
		const { default: AppLayout } = await import("../AppLayout");

		render(<AppLayout />);

		expect(navigateMock).not.toHaveBeenCalled();
	});
});
