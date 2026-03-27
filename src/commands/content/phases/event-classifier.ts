/**
 * Classify raw git events by content-worthiness and editorial importance.
 * Pure functions — no I/O, no side effects.
 */

import type { RawGitEvent } from "./change-detector.js";

export interface EventClassification {
	contentWorthy: boolean;
	importance: "high" | "medium" | "low";
	suggestedFormats: string[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Classify a single raw git event. */
export function classifyEvent(event: RawGitEvent): EventClassification {
	switch (event.eventType) {
		case "pr_merged":
			return classifyPR(event);
		case "tag":
		case "release":
			return { contentWorthy: true, importance: "high", suggestedFormats: ["text", "photo"] };
		case "plan_completed":
			return {
				contentWorthy: true,
				importance: "high",
				suggestedFormats: ["text", "photo", "thread"],
			};
		case "commit":
			return classifyCommit(event);
		default:
			return { contentWorthy: false, importance: "low", suggestedFormats: [] };
	}
}

// ---------------------------------------------------------------------------
// Per-type classifiers
// ---------------------------------------------------------------------------

function classifyPR(event: RawGitEvent): EventClassification {
	const title = event.title.toLowerCase();
	if (title.startsWith("feat") || title.includes("feature")) {
		return { contentWorthy: true, importance: "high", suggestedFormats: ["text", "photo"] };
	}
	if (title.startsWith("fix") || title.includes("bugfix")) {
		return { contentWorthy: true, importance: "medium", suggestedFormats: ["text"] };
	}
	// Default: still worth noting (e.g. refactor, perf, docs PRs)
	return { contentWorthy: true, importance: "medium", suggestedFormats: ["text"] };
}

function classifyCommit(event: RawGitEvent): EventClassification {
	const title = event.title.toLowerCase();

	if (title.startsWith("feat:") || title.startsWith("feat(")) {
		return { contentWorthy: true, importance: "medium", suggestedFormats: ["text"] };
	}

	if (title.startsWith("fix:") || title.startsWith("fix(")) {
		// Only scoped fixes are noteworthy (e.g. "fix(auth): ..." vs "fix: typo")
		const hasScope = title.includes("(") && title.includes(")");
		return { contentWorthy: hasScope, importance: "low", suggestedFormats: ["text"] };
	}

	if (title.startsWith("perf:") || title.startsWith("perf(")) {
		return { contentWorthy: true, importance: "medium", suggestedFormats: ["text"] };
	}

	return { contentWorthy: false, importance: "low", suggestedFormats: [] };
}
