import { execSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as clack from "@clack/prompts";
import { getOSInfo } from "../../utils/dependency-checker.js";
import { isNonInteractive } from "../../utils/environment.js";
import { logger } from "../../utils/logger.js";
import type { CheckSummary, DiagnosticReport, ReportOptions, SystemInfo } from "./types.js";

const CLI_VERSION = "0.1.0"; // TODO: import from package.json when available

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

		lines.push(divider);
		lines.push("CLAUDEKIT DIAGNOSTIC REPORT");
		lines.push(`Generated: ${summary.timestamp}`);
		lines.push(divider);
		lines.push("");

		// System section
		const system = this.getSystemInfo();
		lines.push("SYSTEM");
		lines.push(`  OS: ${system.os} ${system.osVersion}`);
		lines.push(`  Node: ${system.node}`);
		lines.push(`  CWD: ${this.scrubPath(system.cwd)}`);
		lines.push(`  CLI: ${system.cliVersion}`);
		lines.push("");

		// Checks by group
		lines.push("CHECKS");
		for (const check of summary.checks) {
			const icon = this.getStatusIcon(check.status);
			lines.push(`  ${icon} ${check.name}: ${check.message}`);
		}
		lines.push("");

		// Errors section
		const errors = summary.checks.filter((c) => c.status === "fail");
		if (errors.length > 0) {
			lines.push("ERRORS");
			for (const err of errors) {
				lines.push(`  ${err.name}`);
				lines.push(`    ${err.message}`);
				if (err.suggestion) {
					lines.push(`    Suggestion: ${err.suggestion}`);
				}
			}
			lines.push("");
		}

		// Summary line
		lines.push(
			`SUMMARY: ${summary.passed} passed, ${summary.warnings} warnings, ${summary.failed} failed`,
		);
		lines.push(divider);

		return lines.join("\n");
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

		// Create temp file and upload
		const tmpFile = join(tmpdir(), `ck-report-${Date.now()}.txt`);
		writeFileSync(tmpFile, report);

		try {
			const result = execSync(`gh gist create "${tmpFile}" --desc "ClaudeKit Diagnostic Report"`, {
				encoding: "utf-8",
			});
			return { url: result.trim() };
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
			cliVersion: CLI_VERSION,
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
