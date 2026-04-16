/**
 * Tauri v2 auto-updater hook.
 *
 * Listens for the "check-updates" event emitted by the system tray menu item
 * (tray.rs → "Check for Updates"). When triggered, calls the updater plugin's
 * check() function and sets updateAvailable=true if a newer version exists.
 *
 * Design decisions:
 * - Dynamic import: @tauri-apps/api and @tauri-apps/plugin-updater are NOT
 *   bundled in web mode (ck config ui). isTauri() guard ensures they are only
 *   loaded when running inside the Tauri webview.
 * - Silent error handling: the updater pubkey is intentionally empty in Phase 1
 *   (pre-release), so check() will throw. We catch and suppress to avoid
 *   noise in the console during development.
 * - Cleanup: the listen() unsubscribe function is stored and called on unmount
 *   to prevent memory leaks across HMR reloads in dev mode.
 *
 * Usage:
 *   const { updateAvailable } = useUpdater();
 *   // Show update badge when updateAvailable === true
 */

import { useEffect, useState } from "react";
import { isTauri } from "./use-tauri";

const SIGNED_UPDATER_ENABLED = false;

export interface UseUpdaterResult {
	/** True when the updater confirmed a newer version is available */
	updateAvailable: boolean;
}

export function useUpdater(): UseUpdaterResult {
	const [updateAvailable, setUpdateAvailable] = useState(false);

	useEffect(() => {
		// Only activate in Tauri desktop mode — web mode has no updater
		// Phase 3 ships a plain desktop download manifest (`desktop-manifest.json`) for `ck app`, not the
		// signed Tauri updater contract. Keep the updater hook disabled until the
		// signing-key phase reintroduces a real updater payload and pubkey.
		if (!isTauri() || !SIGNED_UPDATER_ENABLED) return;

		let cancelled = false;
		let unlisten: (() => void) | undefined;

		// Dynamic import keeps Tauri plugin deps out of the web bundle
		Promise.all([import("@tauri-apps/api/event"), import("@tauri-apps/plugin-updater")]).then(
			([{ listen }, { check }]) => {
				if (cancelled) return;
				listen("check-updates", async () => {
					try {
						const update = await check();
						if (update?.available) {
							setUpdateAvailable(true);
						}
					} catch {
						// Silently ignore: updater pubkey is empty until pre-release key
						// is generated via `tauri signer generate` and stored as a repo secret.
						// See src-tauri/tauri.conf.json → plugins.updater.pubkey (TODO pre-release).
					}
				}).then((fn) => {
					if (cancelled) {
						fn();
						return;
					}
					unlisten = fn;
				});
			},
		);

		return () => {
			cancelled = true;
			unlisten?.();
		};
	}, []);

	return { updateAvailable };
}
