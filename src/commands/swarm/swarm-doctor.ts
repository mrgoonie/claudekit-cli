/**
 * Swarm Doctor Command — Diagnostic checks for swarm mode installation
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
	detectSwarmModeState,
	hasBackup,
	isHookInstalled,
	isSwarmSkillInstalled,
	locateCliJs,
	readSwarmState,
} from "@/domains/swarm/index.js";
import { intro, log } from "@/shared/safe-prompts.js";
import pc from "picocolors";

type Status = "pass" | "fail" | "warn";
interface CheckResult {
	name: string;
	status: Status;
	message: string;
}

const symbols: Record<Status, string> = {
	pass: pc.green("[OK]"),
	fail: pc.red("[X]"),
	warn: pc.yellow("[!]"),
};

function check(name: string, fn: () => [Status, string]): CheckResult {
	try {
		const [status, message] = fn();
		return { name, status, message };
	} catch (error) {
		return {
			name,
			status: "fail",
			message: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
		};
	}
}

export async function swarmDoctor(): Promise<void> {
	intro("CK Swarm — Diagnostics");

	const cliResult = await locateCliJs();
	const state = readSwarmState();
	const results: CheckResult[] = [];

	// 1. Claude Code installed
	results.push(
		check("Claude Code CLI", () =>
			cliResult
				? ["pass", `Found at ${cliResult.path}`]
				: ["fail", "Not found in standard locations"],
		),
	);

	// 2. Version >= 2.1.16
	results.push(
		check("CC version", () => {
			if (!cliResult) return ["fail", "Cannot check — CLI not found"];
			const v = cliResult.version;
			if (!v || v === "unknown") return ["warn", "Could not detect version"];

			// Strip pre-release suffix
			const cleanV = v.split("-")[0];
			const parts = cleanV.split(".").map(Number);
			const ok =
				parts[0] > 2 ||
				(parts[0] === 2 && parts[1] > 1) ||
				(parts[0] === 2 && parts[1] === 1 && (parts[2] ?? 0) >= 16);
			return [ok ? "pass" : "fail", `v${v} (>= 2.1.16 required)`];
		}),
	);

	// 3. Swarm patch applied
	results.push(
		check("Swarm patch", () => {
			if (!cliResult) return ["fail", "Cannot check — cli.js not found"];
			const content = readFileSync(cliResult.path, "utf-8");
			const mode = detectSwarmModeState(content);
			if (mode === "enabled") return ["pass", "Gate is patched"];
			if (mode === "disabled") return ["warn", "Not patched (run 'ck swarm enable')"];
			return ["warn", "Could not detect patch state"];
		}),
	);

	// 4. State file
	results.push(
		check("State file", () =>
			state?.enabled ? ["pass", `Last patched: ${state.patchedAt}`] : ["warn", "No state file"],
		),
	);

	// 5. Backup exists
	results.push(
		check("Backup file", () => {
			if (!state?.enabled) return ["pass", "N/A (not enabled)"];
			return hasBackup(state.cliJsPath)
				? ["pass", "Backup found"]
				: ["fail", "Missing — cannot disable safely"];
		}),
	);

	// 6. Auto-reapply hook
	results.push(
		check("Auto-reapply hook", () =>
			isHookInstalled() ? ["pass", "Installed"] : ["warn", "Not installed"],
		),
	);

	// 7. ck-swarm skill
	results.push(
		check("ck-swarm skill", () =>
			isSwarmSkillInstalled() ? ["pass", "Installed"] : ["warn", "Not installed"],
		),
	);

	// 8. tmux (skip on Windows)
	results.push(
		check("tmux available", () => {
			if (process.platform === "win32") {
				return ["pass", "N/A on Windows (use Windows Terminal)"];
			}
			try {
				execSync("which tmux", { stdio: "ignore" });
				return ["pass", "Found in PATH"];
			} catch {
				return ["warn", "Not found (recommended for delegate mode)"];
			}
		}),
	);

	// Display
	console.log();
	for (const r of results) {
		log.message(`${symbols[r.status]} ${r.name}: ${r.message}`);
	}
	console.log();

	const p = results.filter((r) => r.status === "pass").length;
	const f = results.filter((r) => r.status === "fail").length;
	const w = results.filter((r) => r.status === "warn").length;

	if (f === 0 && w === 0) log.success(`All checks passed (${p}/${results.length})`);
	else if (f === 0) log.warning(`${p} passed, ${w} warnings`);
	else log.error(`${p} passed, ${f} failed, ${w} warnings`);
	console.log();
}
