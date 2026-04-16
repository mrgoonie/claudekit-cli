import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCkConfigScope } from "../../services/ck-config-api";
import { getDesktopOnboardingCompleted } from "../../services/desktop-onboarding-state";
import { useDesktopOnboardingGate } from "../use-desktop-onboarding-gate";
import { isTauri } from "../use-tauri";

vi.mock("../use-tauri", () => ({
	isTauri: vi.fn(),
}));

vi.mock("../../services/ck-config-api", () => ({
	fetchCkConfigScope: vi.fn(),
}));

vi.mock("../../services/desktop-onboarding-state", () => ({
	getDesktopOnboardingCompleted: vi.fn(),
}));

describe("useDesktopOnboardingGate", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.mocked(isTauri).mockReturnValue(true);
		vi.mocked(getDesktopOnboardingCompleted).mockResolvedValue(false);
		vi.mocked(fetchCkConfigScope).mockResolvedValue({
			config: {},
			sources: {},
			globalPath: "",
			projectPath: null,
		});
	});

	it("shows onboarding for desktop first run when projects and global config are absent", async () => {
		const { result } = renderHook(() =>
			useDesktopOnboardingGate({ projectCount: 0, projectsLoading: false }),
		);

		await waitFor(() => expect(result.current.checking).toBe(false));

		expect(result.current.shouldShowOnboarding).toBe(true);
	});

	it("disables the gate immediately outside Tauri mode", async () => {
		vi.mocked(isTauri).mockReturnValue(false);

		const { result } = renderHook(() =>
			useDesktopOnboardingGate({ projectCount: 0, projectsLoading: false }),
		);

		await waitFor(() => expect(result.current.checking).toBe(false));

		expect(getDesktopOnboardingCompleted).not.toHaveBeenCalled();
		expect(fetchCkConfigScope).not.toHaveBeenCalled();
		expect(result.current.shouldShowOnboarding).toBe(false);
	});

	it("skips onboarding when projects already exist", async () => {
		const { result } = renderHook(() =>
			useDesktopOnboardingGate({ projectCount: 2, projectsLoading: false }),
		);

		await waitFor(() => expect(result.current.checking).toBe(false));

		expect(fetchCkConfigScope).not.toHaveBeenCalled();
		expect(result.current.shouldShowOnboarding).toBe(false);
	});

	it("skips onboarding when it was previously completed", async () => {
		vi.mocked(getDesktopOnboardingCompleted).mockResolvedValue(true);

		const { result } = renderHook(() =>
			useDesktopOnboardingGate({ projectCount: 0, projectsLoading: false }),
		);

		await waitFor(() => expect(result.current.checking).toBe(false));

		expect(fetchCkConfigScope).not.toHaveBeenCalled();
		expect(result.current.shouldShowOnboarding).toBe(false);
	});

	it("skips onboarding when a global config already exists", async () => {
		vi.mocked(fetchCkConfigScope).mockResolvedValue({
			config: { codingLevel: 3 },
			sources: {},
			globalPath: "",
			projectPath: null,
		});

		const { result } = renderHook(() =>
			useDesktopOnboardingGate({ projectCount: 0, projectsLoading: false }),
		);

		await waitFor(() => expect(result.current.checking).toBe(false));

		expect(result.current.shouldShowOnboarding).toBe(false);
	});

	it("falls back to onboarding when gate evaluation fails and there are no projects", async () => {
		vi.mocked(fetchCkConfigScope).mockRejectedValue(new Error("boom"));

		const { result } = renderHook(() =>
			useDesktopOnboardingGate({ projectCount: 0, projectsLoading: false }),
		);

		await waitFor(() => expect(result.current.checking).toBe(false));

		expect(result.current.shouldShowOnboarding).toBe(true);
	});
});
