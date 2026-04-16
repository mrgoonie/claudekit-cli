import { useEffect, useState } from "react";
import { fetchCkConfigScope } from "../services/ck-config-api";
import { getDesktopOnboardingCompleted } from "../services/desktop-onboarding-state";
import { isTauri } from "./use-tauri";

interface UseDesktopOnboardingGateOptions {
	projectCount: number;
	projectsLoading: boolean;
}

interface UseDesktopOnboardingGateResult {
	checking: boolean;
	shouldShowOnboarding: boolean;
	dismissOnboarding: () => void;
}

export function useDesktopOnboardingGate({
	projectCount,
	projectsLoading,
}: UseDesktopOnboardingGateOptions): UseDesktopOnboardingGateResult {
	const desktopMode = isTauri();
	const [checking, setChecking] = useState(desktopMode);
	const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		let cancelled = false;

		if (!desktopMode) {
			setChecking(false);
			setShouldShowOnboarding(false);
			return;
		}

		if (dismissed) {
			setChecking(false);
			setShouldShowOnboarding(false);
			return;
		}

		if (projectsLoading) {
			setChecking(true);
			return;
		}

		async function load(): Promise<void> {
			setChecking(true);
			try {
				const completed = await getDesktopOnboardingCompleted();
				if (completed || projectCount > 0) {
					if (!cancelled) {
						setShouldShowOnboarding(false);
					}
					return;
				}

				const globalConfig = await fetchCkConfigScope("global");
				const hasGlobalConfig = Object.keys(globalConfig.config).length > 0;

				if (!cancelled) {
					setShouldShowOnboarding(!hasGlobalConfig);
				}
			} catch (error) {
				console.error("[desktop-onboarding] Failed to evaluate first-run state", error);
				if (!cancelled) {
					setShouldShowOnboarding(projectCount === 0);
				}
			} finally {
				if (!cancelled) {
					setChecking(false);
				}
			}
		}

		void load();

		return () => {
			cancelled = true;
		};
	}, [desktopMode, dismissed, projectCount, projectsLoading]);

	return {
		checking,
		shouldShowOnboarding,
		dismissOnboarding: () => {
			setDismissed(true);
			setChecking(false);
			setShouldShowOnboarding(false);
		},
	};
}
