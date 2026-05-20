/**
 * Registry Client
 * Thin wrapper around NpmRegistryClient with credential-redaction utilities.
 * Also re-exports redactCommandForLog used by package-manager-runner.
 */

import { redactRegistryUrlForLog } from "@/domains/github/npm-registry.js";

/**
 * Redact sensitive command arguments for logging/output safety.
 * Strips credentials from --registry flags and any inline https URLs.
 * @internal Exported for testing
 */
export function redactCommandForLog(command: string): string {
	if (!command) return command;

	const redactedRegistryFlags = command.replace(
		/(--registry(?:=|\s+))(['"]?)(\S+?)(\2)(?=\s|$)/g,
		(_match, prefix: string, quote: string, url: string) =>
			`${prefix}${quote}${redactRegistryUrlForLog(url)}${quote}`,
	);

	// Fallback for any inline URL with embedded credentials.
	return redactedRegistryFlags.replace(/https?:\/\/[^\s"']+/g, (url) =>
		redactRegistryUrlForLog(url),
	);
}
