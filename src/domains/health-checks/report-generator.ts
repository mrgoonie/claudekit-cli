import { execSync, spawnSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getOSInfo } from "@/services/package-installer/dependency-checker.js";
import { isNonInteractive } from "@/shared/environment.js";
import { logger } from "@/shared/logger.js";
import * as clack from "@clack/prompts";
import type {
	CheckResult,
	CheckSummary,
	DiagnosticReport,
	ReportOptions,
	SystemInfo,
} from "./types.js";

// Read version from package.json at runtime
function getCliVersion(): string {
	try {
		const __dirname = dirname(fileURLToPath(import.meta.url));
		const pkgPath = join(__dirname, "../../../package.json");
		const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
		return pkg.version || "unknown";
	} catch (err) {
		logger.debug(`Failed to read CLI version: ${err}`);
		return "unknown";
	}
}

/** ReportGenerator creates text/JSON reports with optional gist upload */
export class ReportGenerator {
	/** Generate report in specified format */
	generate(summary: CheckSummary, options: ReportOptions): string {
		return options.format === "json"
			? this.generateJsonReport(summary)
			: this.generateTextReport(summary);
	}

	/** Generate human-readable text report */
	generateTextReport(summary: CheckSummary): string {
		const lines: string[] = [];
		const divider = "=".repeat(65);
		const sectionDivider = "─".repeat(65);

		lines.push(divider);
		lines.push("CLAUDEKIT DIAGNOSTIC REPORT");
		lines.push(`Generated: ${summary.timestamp}`);
		lines.push(`CLI Version: ${this.getSystemInfo().cliVersion}`);
		lines.push(divider);

		// Issues section (WARN + FAIL only) - shown at top for quick identification
		const issues = summary.checks.filter((c) => c.status === "warn" || c.status === "fail");
		if (issues.length > 0) {
			lines.push("");
			lines.push("⚠️  ISSUES FOUND");
			lines.push(sectionDivider);
			for (const issue of issues) {
				const icon = this.getStatusIcon(issue.status);
				lines.push(`  ${icon} ${issue.name}: ${issue.message}`);
				if (issue.details) {
					lines.push(`         Path: ${this.scrubPath(issue.details)}`);
				}
				if (issue.suggestion) {
					lines.push(`         Fix:  ${issue.suggestion}`);
				}
			}
		}

		// Environment section
		const system = this.getSystemInfo();
		lines.push("");
		lines.push("ENVIRONMENT");
		lines.push(sectionDivider);
		lines.push(`  OS:       ${system.os} ${system.osVersion}`);
		lines.push(`  Node:     ${system.node}`);
		lines.push(`  CWD:      ${this.scrubPath(system.cwd)}`);

		// Group checks by category
		const groups = this.groupChecks(summary.checks);

		for (const [groupName, checks] of groups) {
			lines.push("");
			lines.push(groupName.toUpperCase());
			lines.push(sectionDivider);

			for (const check of checks) {
				const icon = this.getStatusSymbol(check.status);
				lines.push(`  ${icon} ${check.name.padEnd(22)} ${check.message}`);
				if (check.details) {
					lines.push(`${"".padEnd(27)}Path: ${this.scrubPath(check.details)}`);
				}
				// Show suggestion only for non-pass items
				if (check.status !== "pass" && check.suggestion) {
					lines.push(`${"".padEnd(27)}Fix:  ${check.suggestion}`);
				}
			}
		}

		// Summary
		lines.push("");
		lines.push(divider);
		lines.push(
			`SUMMARY: ${summary.passed} ✓ passed, ${summary.warnings} ⚠ warnings, ${summary.failed} ✗ failed`,
		);
		lines.push(divider);

		return lines.join("\n");
	}

	/** Group checks by their group property */
	private groupChecks(checks: CheckResult[]): Map<string, CheckResult[]> {
		const groups = new Map<string, CheckResult[]>();
		for (const check of checks) {
			const group = groups.get(check.group) || [];
			group.push(check);
			groups.set(check.group, group);
		}
		return groups;
	}

	/** Get status symbol (for text report) */
	private getStatusSymbol(status: string): string {
		switch (status) {
			case "pass":
				return "✓";
			case "warn":
				return "⚠";
			case "fail":
				return "✗";
			default:
				return "ℹ";
		}
	}

	/** Generate machine-readable JSON report */
	generateJsonReport(summary: CheckSummary): string {
		const report: DiagnosticReport = {
			version: "1.0",
			timestamp: summary.timestamp,
			system: this.getSystemInfo(),
			summary: {
				timestamp: summary.timestamp,
				total: summary.total,
				passed: summary.passed,
				warnings: summary.warnings,
				failed: summary.failed,
				fixed: summary.fixed,
				checks: summary.checks.map((c) => ({
					id: c.id,
					name: c.name,
					group: c.group,
					status: c.status,
					message: c.message,
					details: c.details,
					suggestion: c.suggestion,
					autoFixable: c.autoFixable,
					fixed: c.fixed,
					fixError: c.fixError,
				})),
			},
			errors: summary.checks
				.filter((c) => c.status === "fail")
				.map((c) => ({
					checkId: c.id,
					checkName: c.name,
					message: c.message,
					suggestion: c.suggestion,
				})),
		};

		return JSON.stringify(report, null, 2);
	}

	/** Upload report to GitHub Gist (secret by default) */
	async uploadToGist(report: string): Promise<{ url: string } | null> {
		// Check if gh is available
		try {
			execSync("gh --version", { stdio: "ignore" });
		} catch {
			logger.warning("GitHub CLI not installed, skipping gist upload");
			return null;
		}

		// Confirm upload (skip in CI)
		if (!isNonInteractive()) {
			const confirm = await clack.confirm({
				message: "Upload to GitHub Gist? (secret gist)",
				initialValue: false,
			});

			if (clack.isCancel(confirm) || !confirm) {
				return null;
			}
		}

		// Create temp file and upload using spawnSync to avoid command injection
		const tmpFile = join(tmpdir(), `ck-report-${Date.now()}.txt`);
		writeFileSync(tmpFile, report);

		try {
			// Use spawnSync with array args to avoid shell interpolation (command injection safe)
			const result = spawnSync(
				"gh",
				["gist", "create", tmpFile, "--desc", "ClaudeKit Diagnostic Report"],
				{
					encoding: "utf-8",
				},
			);

			if (result.status !== 0) {
				const errorMsg = result.stderr || result.error?.message || "Unknown error";
				logger.error(`Failed to create gist: ${errorMsg}`);
				return null;
			}

			return { url: result.stdout.trim() };
		} catch (e) {
			logger.error(`Failed to create gist: ${e instanceof Error ? e.message : "Unknown error"}`);
			return null;
		} finally {
			try {
				unlinkSync(tmpFile);
			} catch {
				/* ignore cleanup errors */
			}
		}
	}

	private getSystemInfo(): SystemInfo {
		const osInfo = getOSInfo();
		return {
			os: osInfo.platform,
			osVersion: osInfo.details,
			node: process.version,
			cwd: this.scrubPath(process.cwd()),
			cliVersion: getCliVersion(),
		};
	}

	private scrubPath(path: string): string {
		const home = process.env.HOME || process.env.USERPROFILE || "";
		return home ? path.replace(home, "~") : path;
	}

	private getStatusIcon(status: string): string {
		switch (status) {
			case "pass":
				return "[PASS]";
			case "warn":
				return "[WARN]";
			case "fail":
				return "[FAIL]";
			default:
				return "[INFO]";
		}
	}
}
