/**
 * Plan Validator
 * Format compliance checks for plan.md files.
 * Reports issues with severity levels: error, warning, info.
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import matter from "gray-matter";
import { parsePhasesFromBody } from "./plan-table-parser.js";
import type { ValidationIssue, ValidationResult } from "./plan-types.js";

/**
 * Validate a plan file for format compliance.
 * @param filePath - Absolute path to plan.md
 * @param strict - If true, warnings become errors for critical checks
 */
export function validatePlanFile(filePath: string, strict = false): ValidationResult {
	const rawContent = readFileSync(filePath, "utf8");
	// Normalize CRLF to LF for consistent line handling on Windows
	const content = rawContent.replace(/\r\n/g, "\n");
	const dir = dirname(filePath);
	const issues: ValidationIssue[] = [];
	const lines = content.split("\n");

	// Check 1: YAML frontmatter present — reuse stripped body to avoid double-parse
	const { data: frontmatter, content: body } = matter(content, {
		engines: { javascript: { parse: () => ({}) } },
	});
	if (!frontmatter || Object.keys(frontmatter).length === 0) {
		issues.push({
			line: 1,
			severity: strict ? "error" : "warning",
			code: "missing-frontmatter",
			message: "Plan file has no YAML frontmatter",
			fix: "Add frontmatter with title, status, priority fields",
		});
	}

	// Check 2: Filename-as-link-text (link text matches phase filename pattern)
	lines.forEach((line, i) => {
		const match = /\[phase-\d+[a-z]?-[^\]]*\.md\]/i.exec(line);
		if (match) {
			issues.push({
				line: i + 1,
				severity: "warning",
				code: "filename-as-link-text",
				message: "Link text uses filename instead of human-readable name",
				fix: "Use descriptive name: [Setup Environment](./phase-01-setup.md)",
			});
		}
	});

	// Check 3: No phases found — use body-only parser to avoid double matter() call
	const phases = parsePhasesFromBody(body, dir);
	if (phases.length === 0) {
		issues.push({
			line: 1,
			severity: "warning",
			code: "no-phases-found",
			message: "No plan phases detected in any supported format",
		});
	}

	// Check 4: Phase files referenced but missing on disk
	for (const phase of phases) {
		if (phase.file && !existsSync(phase.file)) {
			// Find the line number where this file is referenced
			const fileBasename = basename(phase.file);
			const refLine = lines.findIndex((l) => l.includes(fileBasename));
			issues.push({
				line: refLine >= 0 ? refLine + 1 : 1,
				severity: "warning",
				code: "missing-phase-file",
				message: `Phase ${phase.phaseId} references '${basename(phase.file)}' which doesn't exist`,
			});
		}
	}

	return {
		file: filePath,
		valid: !issues.some((i) => i.severity === "error"),
		issues,
		phases,
	};
}
