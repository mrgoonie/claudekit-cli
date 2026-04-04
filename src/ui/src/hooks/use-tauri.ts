/**
 * Tauri v2 environment detection hook.
 *
 * Tauri v2 injects `__TAURI_INTERNALS__` onto the window object before the
 * webview loads. Checking for it is the canonical way to distinguish a native
 * Tauri window from a regular browser tab.
 *
 * Usage:
 *   import { isTauri } from "@/hooks/use-tauri";
 *   if (isTauri()) { ... }  // native-only code path
 */

/** Returns true when the React app is running inside a Tauri v2 native window. */
export function isTauri(): boolean {
	return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
