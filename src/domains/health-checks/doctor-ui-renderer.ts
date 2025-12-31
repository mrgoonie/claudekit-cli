import { getStatusSymbols } from "@/shared/terminal-utils.js";
import pc from "picocolors";
import type { CheckResult, CheckSummary, HealingSummary } from "./types.js";

export class DoctorUIRenderer {
	private symbols = getStatusSymbols();

	/**
	 * Render health check results grouped by section
	 * Uses compact console output for better readability
	 */
	renderResults(summary: CheckSummary): void {
		const groups = this.groupChecks(summary.checks);

		for (const [groupName, checks] of groups) {
			// Section header with bar
			console.log("│");
			console.log(`│  ${pc.bold(pc.cyan(groupName.toUpperCase()))}`);
			console.log(`│  ${pc.dim("─".repeat(50))}`);

			// Calculate column widths for table-like alignment
			const maxNameLen = Math.max(...checks.map((c) => c.name.length));
			const maxMsgLen = Math.max(...checks.map((c) => c.message.length));

			// Render each check with aligned columns
			for (const check of checks) {
				this.renderCheck(check, maxNameLen, maxMsgLen);
			}
		}

		// Summary
		console.log("│");
		this.renderSummaryLine(summary);
	}

	/** Render single check - table-aligned columns */
	private renderCheck(check: CheckResult, maxNameLen: number, maxMsgLen: number): void {
		const symbol = this.getColoredSymbol(check.status);
		const name = pc.bold(check.name.padEnd(maxNameLen));
		const paddedMsg = check.message.padEnd(maxMsgLen);
		const value = this.colorizeValue(check.status, paddedMsg);

		// Build line: symbol | name | value | path (all aligned)
		let line = `│  ${symbol} ${name}  ${value}`;
		if (check.details) {
			line += `  ${pc.dim(this.shortenPath(check.details))}`;
		}
		console.log(line);

		// Show suggestion only for non-pass (actionable items)
		if (check.status !== "pass" && check.suggestion) {
			const indent = " ".repeat(maxNameLen + 5); // align under the value column
			console.log(`│  ${indent}${pc.dim(`→ ${check.suggestion}`)}`);
		}
	}

	/** Get colored symbol for status */
	private getColoredSymbol(status: string): string {
		switch (status) {
			case "pass":
				return pc.green(this.symbols.pass);
			case "warn":
				return pc.yellow(this.symbols.warn);
			case "fail":
				return pc.red(this.symbols.fail);
			default:
				return pc.blue(this.symbols.info);
		}
	}

	/**
	 * Render auto-heal results compactly
	 */
	renderHealingSummary(healSummary: HealingSummary): void {
		console.log("│");
		console.log(`│  ${pc.bold(pc.cyan("AUTO-HEAL RESULTS"))}`);
		console.log(`│  ${pc.dim("─".repeat(50))}`);

		for (const fix of healSummary.fixes) {
			const symbol = fix.success ? pc.green(this.symbols.pass) : pc.red(this.symbols.fail);
			console.log(`│  ${symbol} ${pc.bold(fix.checkName)}  ${pc.dim(fix.message)}`);
			if (!fix.success && fix.error) {
				console.log(`│     ${pc.red(`Error: ${fix.error}`)}`);
			}
		}

		console.log("│");
		console.log(
			`│  Fixed: ${pc.green(String(healSummary.succeeded))}, Failed: ${pc.red(String(healSummary.failed))}`,
		);
	}

	private groupChecks(checks: CheckResult[]): Map<string, CheckResult[]> {
		const groups = new Map<string, CheckResult[]>();
		for (const check of checks) {
			const group = groups.get(check.group) || [];
			group.push(check);
			groups.set(check.group, group);
		}
		return groups;
	}

	/** Colorize value based on status */
	private colorizeValue(status: string, message: string): string {
		switch (status) {
			case "pass":
				return pc.green(message);
			case "warn":
				return pc.yellow(message);
			case "fail":
				return pc.red(message);
			default:
				return message; // info: normal color
		}
	}

	/** Shorten paths: replace $HOME with ~, truncate middle if too long */
	private shortenPath(path: string): string {
		const home = process.env.HOME || process.env.USERPROFILE || "";
		let shortened = home ? path.replace(home, "~") : path;

		// Truncate middle if > 50 chars
		const maxLen = 50;
		if (shortened.length > maxLen) {
			const start = shortened.slice(0, 20);
			const end = shortened.slice(-27);
			shortened = `${start}...${end}`;
		}
		return shortened;
	}

	private renderSummaryLine(summary: CheckSummary): void {
		const parts: string[] = [];

		if (summary.passed > 0) {
			parts.push(pc.green(`${summary.passed} ${this.symbols.pass}`));
		}
		if (summary.warnings > 0) {
			parts.push(pc.yellow(`${summary.warnings} ${this.symbols.warn}`));
		}
		if (summary.failed > 0) {
			parts.push(pc.red(`${summary.failed} ${this.symbols.fail}`));
		}

		console.log(`│  ${pc.dim("─".repeat(50))}`);
		console.log(`│  Summary: ${parts.join("  ")}`);
		console.log("│");
		console.log(`│  ${pc.dim("Quick Commands:")}`);
		console.log(`│  ${pc.dim("  ck init        Install/update ClaudeKit in project")}`);
		console.log(`│  ${pc.dim("  ck init -g     Install/update ClaudeKit globally")}`);
		console.log(`│  ${pc.dim("  ck update      Update the CLI tool")}`);
		console.log(`│  ${pc.dim("  ck uninstall   Remove ClaudeKit from project/global")}`);
		console.log(`│  ${pc.dim("  ck --help      Show all commands")}`);
	}
}
