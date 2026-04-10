/**
 * Plan Table Parser
 * TypeScript port of the CJS plan-table-parser.cjs shared module.
 * Supports 7+ markdown table/list formats for plan.md phase extraction.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import matter from "gray-matter";
import type { ParseOptions, PlanPhase } from "./plan-types.js";

/**
 * Normalize raw status string to standard enum value
 */
export function normalizeStatus(raw: string): "completed" | "in-progress" | "pending" {
	const s = raw.toLowerCase().trim();
	if (s.includes("complete") || s.includes("done") || s.includes("✓") || s.includes("✅")) {
		return "completed";
	}
	if (s.includes("progress") || s.includes("active") || s.includes("wip") || s.includes("🔄")) {
		return "in-progress";
	}
	// If value looks like a date (YYYY-MM-DD), treat as completed
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return "completed";
	return "pending";
}

/**
 * Convert a phase filename to a human-readable title.
 * e.g. "phase-01-setup-environment.md" → "Setup Environment"
 * Known acronyms (API, CLI, UI, etc.) are uppercased automatically.
 */
const ACRONYMS = new Set(["api", "ui", "ux", "cli", "ci", "cd", "db", "sql", "css", "html", "sdk"]);

export function filenameToTitle(name: string): string {
	if (!/^phase-\d+[a-z]?-.*\.md$/i.test(name)) return name;
	return name
		.replace(/^phase-\d+[a-z]?-/i, "")
		.replace(/\.md$/, "")
		.replace(/-/g, " ")
		.replace(/\b\w+/g, (word) =>
			ACRONYMS.has(word.toLowerCase())
				? word.toUpperCase()
				: word.charAt(0).toUpperCase() + word.slice(1),
		);
}

/**
 * Build anchor string for a phase when generateAnchors option is set
 */
function buildAnchor(phaseId: string, name: string): string {
	const suffix = phaseId.replace(/^\d+/, "");
	const num = phaseId.replace(/[a-z]+$/i, "");
	const slug = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
	return `phase-${String(num).padStart(2, "0")}${suffix}-${slug}`;
}

// ─── Format 0: Header-Aware Table ────────────────────────────────────────────

/**
 * Format 0: Header-Aware parser — reads the header row to find column indices.
 * Solves multi-column tables where Status may be at any position.
 * Prefers tables containing markdown links (phase tables over mapping tables).
 */
function parseHeaderAwareTable(content: string, dir: string, options?: ParseOptions): PlanPhase[] {
	const lines = content.split("\n");
	const alphaIdRegex = /(\d+)([a-z]?)/i;
	let firstTablePhases: PlanPhase[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!/^\|/.test(line)) continue;
		// Must have a separator row next
		if (i + 1 >= lines.length || !/^\|[\s\-:|]+\|/.test(lines[i + 1])) continue;

		const cells = line
			.split("|")
			.slice(1, -1)
			.map((c) => c.trim());

		// Determine column indices from header names
		let phaseCol = -1;
		let nameCol = -1;
		let nameColExplicit = false; // true when set by "name"/"task"/"description" header
		let statusCol = -1;

		for (let idx = 0; idx < cells.length; idx++) {
			const lower = cells[idx].toLowerCase();
			if ((lower === "#" || lower === "id") && phaseCol === -1) phaseCol = idx;
			else if (lower === "phase" && phaseCol === -1) {
				phaseCol = idx;
				// Set nameCol tentatively; an explicit "name" column overrides this
				if (nameCol === -1) nameCol = idx;
			} else if (
				(lower === "name" || lower === "task" || lower === "description") &&
				!nameColExplicit
			) {
				nameCol = idx;
				nameColExplicit = true;
			} else if (lower === "status") {
				statusCol = idx;
			}
		}

		if (statusCol === -1) continue;
		if (nameCol === -1 && phaseCol !== -1) nameCol = phaseCol;

		const candidatePhases: PlanPhase[] = [];
		let hasLinks = false;

		for (let j = i + 2; j < lines.length; j++) {
			const row = lines[j];
			if (!/^\|/.test(row)) break;
			if (/^\|[\s\-:|]+\|/.test(row)) break;

			const rowCells = row
				.split("|")
				.slice(1, -1)
				.map((c) => c.trim());

			const phaseRaw = phaseCol >= 0 ? (rowCells[phaseCol] ?? "") : "";
			const nameRaw = nameCol >= 0 ? (rowCells[nameCol] ?? "") : "";
			const statusRaw = statusCol >= 0 ? (rowCells[statusCol] ?? "") : "";

			// Extract alphanumeric phase ID
			const idMatch = alphaIdRegex.exec(phaseRaw.replace(/\[.*?\]\(.*?\)/g, "").trim());
			const phaseNum = idMatch ? Number.parseInt(idMatch[1], 10) : 0;
			const letter = idMatch?.[2] ? idMatch[2].toLowerCase() : "";
			const phaseId = idMatch ? `${idMatch[1]}${letter}` : "0";

			// Detect markdown links in name or phase cell
			const linkMatch =
				/\[([^\]]+)\]\(([^)]+)\)/.exec(nameRaw) ?? /\[([^\]]+)\]\(([^)]+)\)/.exec(phaseRaw);

			let name: string;
			let file: string;
			let linkText: string;

			if (linkMatch) {
				hasLinks = true;
				linkText = linkMatch[1].trim();
				name = filenameToTitle(linkText);
				file = resolve(dir, linkMatch[2]);
			} else {
				name = nameRaw.replace(/\[.*?\]\(.*?\)/g, "").trim() || `Phase ${phaseId}`;
				linkText = name;
				file = "";
			}

			if (!name && !phaseRaw) continue;

			const anchor = options?.generateAnchors ? buildAnchor(phaseId, name) : null;
			candidatePhases.push({
				phase: phaseNum,
				phaseId,
				name,
				status: normalizeStatus(statusRaw),
				file,
				linkText,
				anchor,
			});
		}

		// Prefer tables with links (phase tables over plain mapping tables)
		if (candidatePhases.length > 0 && hasLinks) {
			return candidatePhases;
		}
		// Track first unlinked table as fallback
		if (candidatePhases.length > 0 && firstTablePhases.length === 0) {
			firstTablePhases = candidatePhases;
		}
	}
	return firstTablePhases;
}

// ─── Fallback Formats 1-6 ────────────────────────────────────────────────────

function parseFormat1(content: string, dir: string, options?: ParseOptions): PlanPhase[] {
	// Format 1: | Phase | Name | Status | [Link](path) |
	const regex = /\|\s*(\d+)([a-z]?)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*\[([^\]]+)\]\(([^)]+)\)/gi;
	const phases: PlanPhase[] = [];
	for (const match of content.matchAll(regex)) {
		const [, num, suffix, name, status, linkText, linkPath] = match;
		const phaseId = `${num}${suffix}`;
		const anchor = options?.generateAnchors ? buildAnchor(phaseId, name.trim()) : null;
		phases.push({
			phase: Number.parseInt(num, 10),
			phaseId,
			name: name.trim(),
			status: normalizeStatus(status),
			file: resolve(dir, linkPath),
			linkText: linkText.trim(),
			anchor,
		});
	}
	return phases;
}

function parseFormat2(content: string, dir: string, options?: ParseOptions): PlanPhase[] {
	// Format 2: | [Phase X](path) | Description | Status |
	const regex = /\|\s*\[(?:Phase\s*)?(\d+)([a-z]?)\]\(([^)]+)\)\s*\|\s*([^|]+)\s*\|\s*([^|]+)/gi;
	const phases: PlanPhase[] = [];
	for (const match of content.matchAll(regex)) {
		const [, num, suffix, linkPath, name, status] = match;
		const phaseId = `${num}${suffix}`;
		const linkText = `Phase ${phaseId}`;
		const anchor = options?.generateAnchors ? buildAnchor(phaseId, name.trim()) : null;
		phases.push({
			phase: Number.parseInt(num, 10),
			phaseId,
			name: name.trim(),
			status: normalizeStatus(status),
			file: resolve(dir, linkPath),
			linkText,
			anchor,
		});
	}
	return phases;
}

function parseFormat2b(content: string, dir: string, options?: ParseOptions): PlanPhase[] {
	// Format 2b: | # | [Name](path) | Status |
	const regex = /\|\s*(\d+)([a-z]?)\s*\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*([^|]+)/gi;
	const phases: PlanPhase[] = [];
	for (const match of content.matchAll(regex)) {
		const [, num, suffix, name, linkPath, status] = match;
		const phaseId = `${num}${suffix}`;
		const anchor = options?.generateAnchors ? buildAnchor(phaseId, name.trim()) : null;
		phases.push({
			phase: Number.parseInt(num, 10),
			phaseId,
			name: name.trim(),
			status: normalizeStatus(status),
			file: resolve(dir, linkPath),
			linkText: name.trim(),
			anchor,
		});
	}
	return phases;
}

function parseFormat2c(content: string, _dir: string, options?: ParseOptions): PlanPhase[] {
	// Format 2c: | # | Description | Status | (no links — plain text table)
	const phases: PlanPhase[] = [];
	// Capture the full numeric+suffix ID to preserve leading zeros (e.g. "01" stays "01")
	const regex = /\|\s*(\d+)([a-z]?)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/gi;
	for (const match of content.matchAll(regex)) {
		const name = match[3].trim();
		// Skip separator rows only — don't filter by name to avoid dropping valid phases
		if (name.includes("---") || name.includes("===")) continue;
		// Skip if the first column is not a valid phase number (header row detection)
		if (Number.isNaN(Number.parseInt(match[1], 10))) continue;
		// Skip header-like rows
		const nameText = name.toLowerCase();
		if (["description", "name", "phase", "task"].includes(nameText)) continue;
		const phaseId = `${match[1]}${match[2]}`;
		const anchor = options?.generateAnchors ? buildAnchor(phaseId, name) : null;
		phases.push({
			phase: Number.parseInt(match[1], 10),
			phaseId,
			name,
			status: normalizeStatus(match[4]),
			file: "",
			linkText: name,
			anchor,
		});
	}
	return phases;
}

function parseFormat3(content: string, _dir: string, options?: ParseOptions): PlanPhase[] {
	// Format 3: Heading-based phases (### Phase X: Name)
	const lines = content.split("\n");
	const phases: PlanPhase[] = [];
	let current: PlanPhase | null = null;

	for (const line of lines) {
		const headingMatch = /###\s*Phase\s*(\d+)([a-z]?)[:\s]+(.+)/i.exec(line);
		if (headingMatch) {
			if (current) phases.push(current);
			const [, num, suffix, name] = headingMatch;
			const phaseId = `${num}${suffix}`;
			const anchor = options?.generateAnchors ? buildAnchor(phaseId, name.trim()) : null;
			current = {
				phase: Number.parseInt(num, 10),
				phaseId,
				name: name.trim(),
				status: "pending",
				file: "",
				linkText: `Phase ${phaseId}`,
				anchor,
			};
		} else if (current) {
			const statusMatch = /-\s*Status:\s*(.+)/i.exec(line);
			if (statusMatch) current.status = normalizeStatus(statusMatch[1]);
		}
	}
	if (current) phases.push(current);
	return phases;
}

function parseFormat4(content: string, planFilePath: string, options?: ParseOptions): PlanPhase[] {
	// Format 4: Bullet-list "- Phase 01: Name ✅" — only triggers if content uses "Phase N:" style
	// Note: regex strips at most one leading zero (0?(\d+)), matching CJS upstream behavior
	if (!/^-\s*Phase\s*\d+[:\s]/m.test(content)) return [];
	const lines = content.split("\n");
	const phases: PlanPhase[] = [];
	let current: Partial<PlanPhase> | null = null;
	let currentNum = "1";
	let currentSuffix = "";

	for (const line of lines) {
		const bulletMatch = /^-\s*Phase\s*0?(\d+)([a-z]?)[:\s]+([^✅✓\n]+)/i.exec(line);
		const fileMatch = /^\s+-\s*File:\s*`?([^`\n]+)`?/i.exec(line);
		const statusMatch = /^\s+-\s*(Completed|Status):\s*(.+)/i.exec(line);

		if (bulletMatch) {
			if (current?.name) {
				const prevPhaseId = `${currentNum}${currentSuffix}`;
				const anchor = options?.generateAnchors ? buildAnchor(prevPhaseId, current.name) : null;
				phases.push({
					phase: Number.parseInt(currentNum, 10),
					phaseId: prevPhaseId,
					name: current.name,
					status: current.status ?? "pending",
					file: current.file ?? "",
					linkText: current.name,
					anchor,
				});
			}
			currentNum = bulletMatch[1];
			currentSuffix = bulletMatch[2];
			const name = bulletMatch[3].trim().replace(/\s*\([^)]*\)\s*$/, "");
			const hasCheck = /[✅✓]/.test(line);
			current = { name, status: hasCheck ? "completed" : "pending" };
		} else if (fileMatch && current) {
			const planDir = dirname(planFilePath);
			current.file = resolve(planDir, fileMatch[1].trim());
		} else if (statusMatch && current) {
			current.status = normalizeStatus(statusMatch[2]);
		}
	}
	if (current?.name) {
		const lastPhaseId = `${currentNum}${currentSuffix}`;
		const anchor = options?.generateAnchors ? buildAnchor(lastPhaseId, current.name) : null;
		phases.push({
			phase: Number.parseInt(currentNum, 10),
			phaseId: lastPhaseId,
			name: current.name,
			status: current.status ?? "pending",
			file: current.file ?? "",
			linkText: current.name,
			anchor,
		});
	}
	return phases;
}

function parseFormat5(content: string, _dir: string, options?: ParseOptions): PlanPhase[] {
	// Format 5: Numbered list with checkbox status
	const phases: PlanPhase[] = [];
	const phaseMap = new Map<string, PlanPhase>();

	for (const match of content.matchAll(/^(\d+)([a-z]?)[).]\s*\*\*([^*]+)\*\*/gim)) {
		const [, num, suffix, name] = match;
		const phaseId = `${num}${suffix}`;
		const anchor = options?.generateAnchors ? buildAnchor(phaseId, name.trim()) : null;
		phaseMap.set(name.trim().toLowerCase(), {
			phase: Number.parseInt(num, 10),
			phaseId,
			name: name.trim(),
			status: "pending",
			file: "",
			linkText: name.trim(),
			anchor,
		});
	}

	for (const match of content.matchAll(/^-\s*\[(x| )\]\s*([^:\n]+)/gim)) {
		const [, checked, name] = match;
		const entry = phaseMap.get(name.trim().toLowerCase());
		if (entry) entry.status = checked.toLowerCase() === "x" ? "completed" : "pending";
	}

	if (phaseMap.size > 0) {
		phases.push(
			...Array.from(phaseMap.values()).sort((a, b) => {
				const diff = a.phase - b.phase;
				if (diff !== 0) return diff;
				return a.phaseId.localeCompare(b.phaseId);
			}),
		);
	}
	return phases;
}

function parseFormat6(content: string, dir: string, options?: ParseOptions): PlanPhase[] {
	// Format 6: Checkbox list with bold links - [x] **[Phase X](path)**
	const regex =
		/^-\s*\[(x| )\]\s*\*\*\[(?:Phase\s*)?(\d+)([a-z]?)[:\s]*([^\]]*)\]\(([^)]+)\)\*\*/gim;
	const phases: PlanPhase[] = [];
	for (const match of content.matchAll(regex)) {
		const [, checked, num, suffix, name, linkPath] = match;
		const phaseId = `${num}${suffix}`;
		const phaseName = name.trim() || `Phase ${phaseId}`;
		const anchor = options?.generateAnchors ? buildAnchor(phaseId, phaseName) : null;
		phases.push({
			phase: Number.parseInt(num, 10),
			phaseId,
			name: phaseName,
			status: checked.toLowerCase() === "x" ? "completed" : "pending",
			file: resolve(dir, linkPath),
			linkText: phaseName,
			anchor,
		});
	}
	return phases;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse phases from already-stripped markdown body (no frontmatter).
 * Use this when the caller has already called matter() to avoid double parsing.
 *
 * Priority: F0 (header-aware table) is the fast path for standard plans.
 * Fallbacks F1–F6 cover legacy/alternative markdown formats and are tried
 * sequentially only if F0 yields no results. For typical plans (<200 lines)
 * the full waterfall is negligible.
 */
export function parsePhasesFromBody(
	body: string,
	dir: string,
	options?: ParseOptions,
): PlanPhase[] {
	const normalizedBody = body.replace(/\r\n/g, "\n");
	const result = parseHeaderAwareTable(normalizedBody, dir, options);
	if (result.length > 0) return result;

	const f1 = parseFormat1(normalizedBody, dir, options);
	if (f1.length > 0) return f1;

	const f2 = parseFormat2(normalizedBody, dir, options);
	if (f2.length > 0) return f2;

	const f2b = parseFormat2b(normalizedBody, dir, options);
	if (f2b.length > 0) return f2b;

	const f2c = parseFormat2c(normalizedBody, dir, options);
	if (f2c.length > 0) return f2c;

	const f3 = parseFormat3(normalizedBody, dir, options);
	if (f3.length > 0) return f3;

	const f4 = parseFormat4(normalizedBody, dir, options);
	if (f4.length > 0) return f4;

	const f5 = parseFormat5(normalizedBody, dir, options);
	if (f5.length > 0) return f5;

	return parseFormat6(normalizedBody, dir, options);
}

/**
 * Parse all plan phases from markdown content.
 * Strips frontmatter once, then delegates to format parsers.
 */
export function parsePlanPhases(content: string, dir: string, options?: ParseOptions): PlanPhase[] {
	const { content: body } = matter(content, { engines: { javascript: { parse: () => ({}) } } });
	return parsePhasesFromBody(body, dir, options);
}

/**
 * Read and parse a plan file. Returns frontmatter + phases.
 * Calls matter() once and reuses the stripped body for phase parsing.
 */
export function parsePlanFile(
	planFilePath: string,
	options?: ParseOptions,
): { frontmatter: Record<string, unknown>; phases: PlanPhase[] } {
	const content = readFileSync(planFilePath, "utf8");
	const dir = dirname(planFilePath);
	const { data: frontmatter, content: body } = matter(content, {
		engines: { javascript: { parse: () => ({}) } },
	});
	const phases = parsePhasesFromBody(body, dir, options);
	return { frontmatter: frontmatter as Record<string, unknown>, phases };
}
