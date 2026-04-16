import { LazyStore } from "@tauri-apps/plugin-store";

const STORE_PATH = "control-center-state.json";
const ONBOARDING_COMPLETED_KEY = "desktopOnboardingCompleted";

const desktopStateStore = new LazyStore(STORE_PATH, {
	defaults: {
		[ONBOARDING_COMPLETED_KEY]: false,
	},
});

export async function getDesktopOnboardingCompleted(): Promise<boolean> {
	return Boolean(await desktopStateStore.get<boolean>(ONBOARDING_COMPLETED_KEY));
}

export async function setDesktopOnboardingCompleted(completed: boolean): Promise<void> {
	await desktopStateStore.set(ONBOARDING_COMPLETED_KEY, completed);
	await desktopStateStore.save();
}
