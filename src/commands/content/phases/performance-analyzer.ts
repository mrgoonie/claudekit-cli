/**
 * Performance analysis for published content.
 * Queries engagement snapshots to identify top performers and extract patterns
 * that can inform future content generation prompts.
 */

import type Database from "better-sqlite3";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopPerformer {
	contentId: number;
	platform: string;
	textContent: string;
	score: number;
	publishedAt: string;
}

export interface ContentPatterns {
	avgTextLength: number;
	bestPostingHours: number[];
	bestPlatform: string;
	bestContentType: string;
	commonPhrases: string[];
}

interface RawPerformerRow {
	content_id: number;
	platform: string;
	text_content: string;
	published_at: string;
	score: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the top N published content items ranked by engagement score.
 * Score = likes + shares*3 + comments*2 + impressions*0.01
 * Uses the most recent engagement snapshot per publication.
 */
export function getTopPerformers(db: Database.Database, limit: number): TopPerformer[] {
	const rows = db
		.prepare(
			`SELECT
				ci.id            AS content_id,
				ci.platform,
				ci.text_content,
				p.published_at,
				COALESCE(em.likes, 0)
					+ COALESCE(em.shares, 0) * 3
					+ COALESCE(em.comments, 0) * 2
					+ COALESCE(em.impressions, 0) * 0.01 AS score
			FROM content_items ci
			JOIN publications p ON p.content_item_id = ci.id
			LEFT JOIN engagement_metrics em ON em.publication_id = p.id
			WHERE ci.status = 'published'
			ORDER BY score DESC
			LIMIT ?`,
		)
		.all(limit) as RawPerformerRow[];

	return rows.map((r) => ({
		contentId: r.content_id,
		platform: r.platform,
		textContent: r.text_content,
		score: r.score,
		publishedAt: r.published_at,
	}));
}

/**
 * Extract actionable patterns from a set of top performers.
 * Returns empty/zero values when fewer than 3 performers are provided
 * (not enough signal to derive meaningful patterns).
 */
export function extractPatterns(performers: TopPerformer[]): ContentPatterns {
	const empty: ContentPatterns = {
		avgTextLength: 0,
		bestPostingHours: [],
		bestPlatform: "",
		bestContentType: "",
		commonPhrases: [],
	};

	if (performers.length < 3) return empty;

	// Average text length
	const avgTextLength = Math.round(
		performers.reduce((sum, p) => sum + p.textContent.length, 0) / performers.length,
	);

	// Best posting hours (top 3 by frequency)
	const hourCounts: Record<number, number> = {};
	for (const p of performers) {
		const hour = new Date(p.publishedAt).getHours();
		hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
	}
	const bestPostingHours = Object.entries(hourCounts)
		.sort(([, a], [, b]) => b - a)
		.slice(0, 3)
		.map(([h]) => Number(h));

	// Best platform by frequency among top performers
	const platformCounts: Record<string, number> = {};
	for (const p of performers) {
		platformCounts[p.platform] = (platformCounts[p.platform] ?? 0) + 1;
	}
	const bestPlatform = Object.entries(platformCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "";

	return {
		avgTextLength,
		bestPostingHours,
		bestPlatform,
		// Future: classify content type from text; "text" is the only type today
		bestContentType: "text",
		// Future: NLP phrase extraction; empty for now (YAGNI)
		commonPhrases: [],
	};
}
