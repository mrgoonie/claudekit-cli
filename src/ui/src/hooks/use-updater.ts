/**
 * Updater hook stub — web mode only.
 * Desktop updater (Tauri) has been removed.
 */

export interface UseUpdaterResult {
	/** Always false in web mode — no auto-updater available */
	updateAvailable: boolean;
}

export function useUpdater(): UseUpdaterResult {
	return { updateAvailable: false };
}
