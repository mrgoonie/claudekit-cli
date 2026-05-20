/**
 * Plan Writer
 * Generates canonical plan.md and phase file templates.
 * All output is Format 0: 3-column | Phase | Name | Status | table.
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import matter from "gray-matter";
import type { CreatePlanOptions } from "./plan-types.js";

// ─── Filename Utilities ───────────────────────────────────────────────────────

/**
 * Convert phase ID + name to canonical kebab-case filename.
 * Pads numeric part to 2 digits; preserves letter suffix.
 *
 * Examples:
 *   "1",  "Setup Environment" → "phase-01-setup-environment.md"
 *   "1a", "Attachments"       → "phase-01a-attachments.md"
 *   "12", "Final Review"      → "phase-12-final-review.md"
 */
export function phaseNameToFilename(id: string, name: string): string {
	// Split numeric part from letter suffix (e.g. "1a" → ["1", "a"])
	const numMatch = /^(\d+)([a-z]*)$/i.exec(id);
	const num = numMatch ? numMatch[1] : id;
	const suffix = numMatch ? numMatch[2].toLowerCase() : "";
	const paddedNum = num.padStart(2, "0");

	// Convert name to kebab-case: lowercase, strip non-alphanumeric, collapse hyphens, cap length
	const slug = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 60);

	return `phase-${paddedNum}${suffix}-${slug}.md`;
}

// ─── Content Generators ───────────────────────────────────────────────────────

function getCurrentBranch(): string {
	try {
		return execSync("git branch --show-current", {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		return "";
	}
}

/**
 * Generate canonical plan.md content with YAML frontmatter + 3-column phase table.
 * Uses Format 0: | Phase | Name | Status |
 */
export function generatePlanMd(options: CreatePlanOptions): string {
	const {
		title,
		description = "",
		priority = "P2",
		issue,
		phases,
		source = "cli",
		sessionId,
	} = options;
	const created = new Date().toISOString();

	// Build YAML frontmatter lines
	// Escape quotes in YAML strings to prevent injection
	const escYaml = (s: string) =>
		s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

	// Determine createdBy based on source
	const createdBy =
		source === "skill" ? "ck:plan" : source === "dashboard" ? "dashboard" : "ck-cli";
	const branch = getCurrentBranch();

	const frontmatterLines: string[] = [
		`title: "${escYaml(title)}"`,
		`description: "${escYaml(description)}"`,
		"status: pending",
		`priority: ${priority}`,
	];
	if (issue !== undefined) {
		frontmatterLines.push(`issue: ${issue}`);
	}
	frontmatterLines.push(`branch: "${escYaml(branch)}"`);
	frontmatterLines.push("tags: []");
	frontmatterLines.push("blockedBy: []");
	frontmatterLines.push("blocks: []");
	// Tracking metadata (CLI-strict plan tracking)
	frontmatterLines.push(`created: "${created}"`);
	frontmatterLines.push(`createdBy: "${createdBy}"`);
	frontmatterLines.push(`source: ${source}`);
	if (sessionId) {
		frontmatterLines.push(`sessionId: "${escYaml(sessionId)}"`);
	}

	const frontmatter = `---\n${frontmatterLines.join("\n")}\n---`;

	// Resolve IDs and filenames for each phase
	const resolvedPhases = resolvePhaseIds(phases);

	// Build phase table rows (sanitize pipe chars in names to prevent table corruption)
	const escPipe = (s: string) => s.replace(/\|/g, "\\|");
	const tableRows = resolvedPhases
		.map(({ id, name }) => {
			const filename = phaseNameToFilename(id, name);
			return `| ${id} | [${escPipe(name)}](./${filename}) | Pending |`;
		})
		.join("\n");

	return [
		frontmatter,
		"",
		`# ${title}`,
		"",
		"## Overview",
		"",
		"<!-- Brief description -->",
		"",
		"## Phases",
		"",
		"| Phase | Name | Status |",
		"|-------|------|--------|",
		tableRows,
		"",
		"## Dependencies",
		"",
		"<!-- Cross-plan dependencies -->",
		"",
	].join("\n");
}

/**
 * Generate phase file template content with YAML frontmatter.
 */
export function generatePhaseTemplate(phase: { id: string; name: string }): string {
	// Extract numeric part for the phase number field
	const numMatch = /^(\d+)/.exec(phase.id);
	const phaseNum = numMatch ? Number.parseInt(numMatch[1], 10) : 0;

	const frontmatter = [
		"---",
		`phase: ${phaseNum}`,
		`title: "${phase.name}"`,
		"status: pending",
		`effort: ""`,
		"---",
	].join("\n");

	return [
		frontmatter,
		"",
		`# Phase ${phase.id}: ${phase.name}`,
		"",
		"## Overview",
		"",
		"<!-- Brief description -->",
		"",
		"## Implementation Steps",
		"",
		"<!-- Detailed steps -->",
		"",
		"## Success Criteria",
		"",
		"- [ ] ...",
		"",
	].join("\n");
}

// ─── Scaffold ─────────────────────────────────────────────────────────────────

/**
 * Auto-assign sequential IDs to phases if not provided.
 * Returns array of { id, name } with all IDs resolved.
 */
function resolvePhaseIds(
	phases: Array<{ id?: string; name: string }>,
): Array<{ id: string; name: string }> {
	let nextNum = 1;
	return phases.map((p) => {
		if (p.id) {
			// Track max sequential number to avoid collisions
			const numMatch = /^(\d+)/.exec(p.id);
			if (numMatch) {
				const n = Number.parseInt(numMatch[1], 10);
				if (n >= nextNum) nextNum = n + 1;
			}
			return { id: p.id, name: p.name };
		}
		return { id: String(nextNum++), name: p.name };
	});
}

/**
 * Scaffold plan directory: write plan.md + all phase files.
 * Creates dir with mkdirSync({ recursive: true }) for idempotency.
 * Returns absolute paths of all created files.
 */
export function scaffoldPlan(options: CreatePlanOptions): {
	planFile: string;
	phaseFiles: string[];
	phaseIds: string[];
} {
	const { dir } = options;

	mkdirSync(dir, { recursive: true });

	const resolvedPhases = resolvePhaseIds(options.phases);
	const optionsWithResolved = { ...options, phases: resolvedPhases };

	// Write plan.md (pass pre-resolved phases to avoid double resolution)
	const planFile = join(dir, "plan.md");
	writeFileSync(planFile, generatePlanMd(optionsWithResolved), "utf8");

	// Write each phase file
	const phaseFiles: string[] = [];
	for (const phase of resolvedPhases) {
		const filename = phaseNameToFilename(phase.id, phase.name);
		const phaseFile = join(dir, filename);
		writeFileSync(phaseFile, generatePhaseTemplate(phase), "utf8");
		phaseFiles.push(phaseFile);
	}

	return {
		planFile,
		phaseFiles,
		phaseIds: resolvedPhases.map((phase) => phase.id),
	};
}

// ─── Sub-phase ID Computation ─────────────────────────────────────────────────

/**
 * Compute next sub-phase ID after a given phase.
 * First sub-phase of "1" → "1b" (original stays as "1").
 * Subsequent sub-phases: "1b" → "1c", "1c" → "1d", etc.
 *
 * Examples:
 *   "1",  ["1", "2"]         → "1b"
 *   "1b", ["1", "1b", "2"]   → "1c"
 *   "1c", ["1", "1b", "1c"]  → "1d"
 */
export function nextSubPhaseId(afterId: string, existingIds: string[]): string {
	const numMatch = /^(\d+)([a-z]*)$/i.exec(afterId);
	if (!numMatch) throw new Error(`Invalid phase ID: ${afterId}`);

	const num = numMatch[1];
	const currentSuffix = numMatch[2].toLowerCase();

	// Determine next letter suffix: no suffix → 'b', 'b' → 'c', etc.
	// Sub-phases always start at 'b' (the original phase keeps the bare numeric ID)
	const nextSuffixChar =
		currentSuffix === "" ? "b" : String.fromCharCode(currentSuffix.charCodeAt(0) + 1);
	if (nextSuffixChar > "z") throw new Error(`Too many sub-phases for phase ${num}`);
	const candidate = `${num}${nextSuffixChar}`;

	// If candidate already exists, keep incrementing
	if (existingIds.includes(candidate)) {
		return nextSubPhaseId(`${num}${nextSuffixChar}`, existingIds);
	}
	return candidate;
}

// ─── Plan.md Read-Modify-Write ────────────────────────────────────────────────

/** Detect canonical Format 0: requires exact | Phase | Name | Status | header */
function isCanonicalFormat(content: string): boolean {
	return /^\|\s*phase\s*\|\s*name\s*\|\s*status\s*\|/im.test(content);
}

/**
 * Update phase status in plan.md (read-modify-write).
 * Also updates the corresponding phase file frontmatter if it exists.
 * Updates plan.md frontmatter status based on all-completed / any-in-progress logic.
 * Non-canonical plan.md: logs warning and exits without modification.
 * Unknown phase ID: throws error.
 */
export function updatePhaseStatus(
	planFile: string,
	phaseId: string,
	newStatus: "pending" | "in-progress" | "completed",
): void {
	const raw = readFileSync(planFile, "utf8").replace(/\r\n/g, "\n");

	if (!isCanonicalFormat(raw)) {
		console.error("[!] plan.md is not in canonical format — skipping status update");
		return;
	}

	const { data: frontmatter, content: body } = matter(raw, {
		engines: { javascript: { parse: () => ({}) } },
	});

	// Map status to display string (title case for table)
	const statusDisplay: Record<string, string> = {
		pending: "Pending",
		"in-progress": "In Progress",
		completed: "Completed",
	};

	// Parse and update table rows
	let found = false;
	const updatedBody = body.replace(/^\|.*\|.*\|.*\|$/gm, (row) => {
		// Match rows like: | 1 | [Name](./file.md) | Status |
		// Phase column can be a bare number or alphanumeric ID (e.g. 1, 1b, 12)
		const rowPhaseMatch = /^\|\s*(\d+[a-z]?)\s*\|/i.exec(row);
		if (!rowPhaseMatch) return row;

		const rowId = rowPhaseMatch[1].toLowerCase();
		if (rowId !== phaseId.toLowerCase()) return row;

		found = true;
		// Replace last column (status) — keep phase and name columns intact
		return row.replace(/\|\s*[^|]+\s*\|\s*$/, `| ${statusDisplay[newStatus] ?? newStatus} |`);
	});

	if (!found) {
		throw new Error(`Phase ID "${phaseId}" not found in ${planFile}`);
	}

	// Determine updated plan-level status from all phase rows
	const phaseRows = [...updatedBody.matchAll(/^\|\s*\d+[a-z]?\s*\|[^|]+\|\s*([^|]+)\s*\|$/gim)];
	const allStatuses = phaseRows.map((m) => m[1].trim().toLowerCase());

	let planStatus: string = (frontmatter.status as string) ?? "pending";
	if (allStatuses.length > 0) {
		if (allStatuses.every((s) => s === "completed")) {
			planStatus = "completed";
		} else if (allStatuses.some((s) => s === "in progress" || s === "in-progress")) {
			planStatus = "in-progress";
		} else {
			planStatus = "pending";
		}
	}

	// Rebuild plan.md with updated frontmatter
	const updatedFrontmatter = { ...frontmatter, status: planStatus };
	const updatedContent = matter.stringify(updatedBody, updatedFrontmatter);
	writeFileSync(planFile, updatedContent, "utf8");

	// Update phase file frontmatter if it exists
	const planDir = dirname(planFile);
	const phaseFilename = phaseNameFilenameFromTableRow(updatedBody, phaseId, planDir);
	if (phaseFilename && existsSync(phaseFilename)) {
		updatePhaseFileFrontmatter(phaseFilename, newStatus);
	}
}

/** Extract phase file path from plan.md table row matching phaseId */
function phaseNameFilenameFromTableRow(
	body: string,
	phaseId: string,
	planDir: string,
): string | null {
	for (const row of body.split("\n")) {
		const rowPhaseMatch = /^\|\s*(\d+[a-z]?)\s*\|/i.exec(row);
		if (!rowPhaseMatch || rowPhaseMatch[1].toLowerCase() !== phaseId.toLowerCase()) continue;

		const linkMatch = /\[([^\]]+)\]\(\.\/([^)]+)\)/.exec(row);
		if (linkMatch) return join(planDir, linkMatch[2]);
	}
	return null;
}

/** Update status field in a phase file's YAML frontmatter */
function updatePhaseFileFrontmatter(
	phaseFile: string,
	newStatus: "pending" | "in-progress" | "completed",
): void {
	const raw = readFileSync(phaseFile, "utf8");
	const { data: frontmatter, content: body } = matter(raw, {
		engines: { javascript: { parse: () => ({}) } },
	});
	const updated = { ...frontmatter, status: newStatus };
	writeFileSync(phaseFile, matter.stringify(body, updated), "utf8");
}

// ─── Add Phase ────────────────────────────────────────────────────────────────

/**
 * Add a new phase row to plan.md + create phase file.
 * If afterId: inserts sub-phase (e.g. 1b after 1, 1c after 1b).
 * If no afterId: appends with next sequential ID.
 * Updates plan.md table with new row and creates corresponding phase file.
 */
export function addPhase(
	planFile: string,
	name: string,
	afterId?: string,
): { phaseId: string; phaseFile: string } {
	const raw = readFileSync(planFile, "utf8").replace(/\r\n/g, "\n");

	if (!isCanonicalFormat(raw)) {
		console.error("[!] plan.md is not in canonical format — cannot add phase");
		throw new Error("Non-canonical plan.md — cannot add phase");
	}

	const { data: frontmatter, content: body } = matter(raw, {
		engines: { javascript: { parse: () => ({}) } },
	});
	const planDir = dirname(planFile);

	// Collect existing phase IDs from table
	const existingIds: string[] = [];
	for (const match of body.matchAll(/^\|\s*(\d+[a-z]?)\s*\|/gim)) {
		existingIds.push(match[1].toLowerCase());
	}

	let phaseId: string;

	if (afterId) {
		// Sub-phase: compute next letter suffix
		phaseId = nextSubPhaseId(afterId, existingIds);
	} else {
		// Sequential: find max numeric ID and increment
		const maxNum = existingIds.reduce((max, id) => {
			const n = Number.parseInt(id, 10);
			return Number.isNaN(n) ? max : Math.max(max, n);
		}, 0);
		phaseId = String(maxNum + 1);
	}

	// Build new table row (sanitize pipe chars in name)
	const filename = phaseNameToFilename(phaseId, name);
	const safeName = name.replace(/\|/g, "\\|");
	const newRow = `| ${phaseId} | [${safeName}](./${filename}) | Pending |`;

	let updatedBody: string;

	if (afterId) {
		// Insert row after the matching afterId row
		const lines = body.split("\n");
		let insertIdx = -1;
		for (let i = 0; i < lines.length; i++) {
			const m = /^\|\s*(\d+[a-z]?)\s*\|/i.exec(lines[i]);
			if (m && m[1].toLowerCase() === afterId.toLowerCase()) insertIdx = i;
		}

		if (insertIdx === -1) {
			throw new Error(`Phase ID "${afterId}" not found in ${basename(planFile)}`);
		}

		lines.splice(insertIdx + 1, 0, newRow);
		updatedBody = lines.join("\n");
	} else {
		// Append after last table row in the phases section
		// Find the last data row of the phases table
		const lines = body.split("\n");
		let lastTableRowIdx = -1;
		let inPhasesTable = false;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (/^\|\s*phase\s*\|\s*name\s*\|\s*status\s*\|/i.test(line)) {
				inPhasesTable = true;
			}
			if (inPhasesTable && /^\|\s*\d+[a-z]?\s*\|/i.test(line)) {
				lastTableRowIdx = i;
			}
			// Stop tracking after blank line following table
			if (inPhasesTable && lastTableRowIdx >= 0 && line.trim() === "") {
				inPhasesTable = false;
			}
		}

		if (lastTableRowIdx === -1) {
			// No existing rows — append after separator line
			const sepIdx = lines.findIndex((l) => /^\|[-:| ]+\|$/.test(l));
			if (sepIdx === -1) throw new Error("Phases table not found in plan.md");
			lines.splice(sepIdx + 1, 0, newRow);
		} else {
			lines.splice(lastTableRowIdx + 1, 0, newRow);
		}

		updatedBody = lines.join("\n");
	}

	// Write updated plan.md
	writeFileSync(planFile, matter.stringify(updatedBody, frontmatter), "utf8");

	// Create phase file
	const phaseFilePath = join(planDir, filename);
	writeFileSync(phaseFilePath, generatePhaseTemplate({ id: phaseId, name }), "utf8");

	return { phaseId, phaseFile: phaseFilePath };
}
