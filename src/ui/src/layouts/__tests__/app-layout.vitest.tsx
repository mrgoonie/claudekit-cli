import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn();
const listenMock = vi.fn();
const touchProjectMock = vi.fn();
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

vi.mock("../../hooks/use-desktop-onboarding-gate", () => ({
	useDesktopOnboardingGate: () => ({
		checking: false,
		shouldShowOnboarding: false,
		dismissOnboarding: vi.fn(),
	}),
}));

vi.mock("../../hooks/use-tauri", () => ({
	isTauri: () => true,
}));

vi.mock("../../hooks/use-updater", () => ({
	useUpdater: () => ({ updateAvailable: false }),
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

vi.mock("../../services/api", async () => {
	const actual = await vi.importActual<typeof import("../../services/api")>("../../services/api");
	return {
		...actual,
		touchProject: (...args: unknown[]) => touchProjectMock(...args),
	};
});

vi.mock("@tauri-apps/api/event", () => ({
	listen: (...args: unknown[]) => listenMock(...args),
}));

describe("AppLayout tray integration", () => {
	beforeEach(() => {
		vi.resetModules();
		navigateMock.mockReset();
		touchProjectMock.mockReset();
		listenMock.mockReset();
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

	it("touches the current desktop project on mount", async () => {
		listenMock.mockResolvedValue(vi.fn());
		touchProjectMock.mockResolvedValue(undefined);
		const { tauriProjectId } = await import("../../services/api");
		routeState.projectId = tauriProjectId("/tmp/alpha");
		routeState.pathname = `/project/${routeState.projectId}`;
		const { default: AppLayout } = await import("../AppLayout");

		render(<AppLayout />);

		await waitFor(() => expect(touchProjectMock).toHaveBeenCalledWith("/tmp/alpha"));
	});

	it("touches the same project again when re-entering its route", async () => {
		listenMock.mockResolvedValue(vi.fn());
		touchProjectMock.mockResolvedValue(undefined);
		const { tauriProjectId } = await import("../../services/api");
		routeState.projectId = tauriProjectId("/tmp/alpha");
		routeState.pathname = `/project/${routeState.projectId}`;
		const { default: AppLayout } = await import("../AppLayout");

		const { rerender } = render(<AppLayout />);
		await waitFor(() => expect(touchProjectMock).toHaveBeenCalled());
		const initialCalls = touchProjectMock.mock.calls.length;

		touchProjectMock.mockClear();
		routeState.pathname = "/dashboard";
		routeState.projectId = undefined;
		rerender(<AppLayout />);

		routeState.projectId = tauriProjectId("/tmp/alpha");
		routeState.pathname = `/project/${routeState.projectId}`;
		rerender(<AppLayout />);

		await waitFor(() => expect(touchProjectMock).toHaveBeenCalledWith("/tmp/alpha"));
		expect(initialCalls).toBeGreaterThan(0);
	});

	it("navigates to tray-selected routes from tray-open events", async () => {
		let trayHandler:
			| ((event: { payload: { destination: string; projectId?: string | null } }) => void)
			| undefined;
		const unlistenMock = vi.fn();
		listenMock.mockImplementation((_event, handler) => {
			trayHandler = handler;
			return Promise.resolve(unlistenMock);
		});
		touchProjectMock.mockResolvedValue(undefined);
		const { tauriProjectId } = await import("../../services/api");
		routeState.projectId = tauriProjectId("/tmp/alpha");
		routeState.pathname = `/project/${routeState.projectId}`;
		const { default: AppLayout } = await import("../AppLayout");

		const { unmount } = render(<AppLayout />);

		await waitFor(() => expect(listenMock).toHaveBeenCalledWith("tray-open", expect.any(Function)));

		const betaProjectId = tauriProjectId("/tmp/beta");
		trayHandler?.({ payload: { destination: "project", projectId: betaProjectId } });
		expect(navigateMock).toHaveBeenCalledWith(`/project/${betaProjectId}`);

		trayHandler?.({ payload: { destination: "settings" } });
		expect(navigateMock).toHaveBeenCalledWith("/config/global");

		trayHandler?.({ payload: { destination: "dashboard" } });
		expect(navigateMock).toHaveBeenCalledWith("/dashboard");

		unmount();
		expect(unlistenMock).toHaveBeenCalledTimes(1);
	});
});
