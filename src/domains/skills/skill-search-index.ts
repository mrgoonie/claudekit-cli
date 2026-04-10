/**
 * BM25 full-text search index for skill catalog.
 * Pure implementation — no external dependencies.
 *
 * BM25 formula:
 *   score(q, D) = sum_i [ IDF(qi) * (tf * (k1+1)) / (tf + k1*(1 - b + b*|D|/avgDL)) ]
 *   IDF(qi)     = ln((N - df + 0.5) / (df + 0.5) + 1)
 */

import type { CatalogSkillEntry, SkillSearchResult } from "../../commands/skills/types.js";

// BM25 tuning constants
const K1 = 1.2;
const B = 0.75;

const STOP_WORDS = new Set([
	"the",
	"a",
	"an",
	"and",
	"or",
	"but",
	"in",
	"on",
	"at",
	"to",
	"for",
	"of",
	"is",
	"are",
	"was",
	"were",
	"be",
	"been",
	"use",
	"with",
	"from",
	"by",
	"as",
	"this",
	"that",
	"it",
]);

interface BM25Document {
	name: string;
	tokens: string[];
	length: number;
	tf: Map<string, number>; // precomputed term frequency
}

interface BM25Index {
	docs: BM25Document[];
	df: Map<string, number>; // document frequency per token
	avgDL: number;
	totalDocs: number;
}

/**
 * Tokenize text: lowercase, split on non-word chars, filter short/stop tokens.
 */
function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.split(/\W+/)
		.filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Build BM25 document text from a skill entry.
 * Name gets 3x weight, keywords get 2x weight.
 */
function buildDocumentText(skill: CatalogSkillEntry): string {
	const parts: string[] = [
		// Boost name by repeating 3x
		skill.name,
		skill.name,
		skill.name,
		skill.description,
	];

	if (skill.keywords && skill.keywords.length > 0) {
		// Boost keywords by repeating 2x
		const kw = skill.keywords.join(" ");
		parts.push(kw, kw);
	}

	if (skill.category) parts.push(skill.category);
	if (skill.displayName && skill.displayName !== skill.name) parts.push(skill.displayName);

	return parts.join(" ");
}

/**
 * Build a BM25 index from a list of catalog skill entries.
 */
export function buildIndex(skills: CatalogSkillEntry[]): BM25Index {
	const docs: BM25Document[] = skills.map((skill) => {
		const tokens = tokenize(buildDocumentText(skill));
		const tf = new Map<string, number>();
		for (const token of tokens) {
			tf.set(token, (tf.get(token) || 0) + 1);
		}
		return { name: skill.name, tokens, length: tokens.length, tf };
	});

	const df = new Map<string, number>();
	for (const doc of docs) {
		const seen = new Set<string>();
		for (const token of doc.tokens) {
			if (!seen.has(token)) {
				df.set(token, (df.get(token) ?? 0) + 1);
				seen.add(token);
			}
		}
	}

	const totalLength = docs.reduce((sum, d) => sum + d.length, 0);
	const avgDL = docs.length > 0 ? totalLength / docs.length : 1;

	return { docs, df, avgDL, totalDocs: docs.length };
}

/**
 * Run BM25 search over the index.
 * Returns top-N results sorted by score descending.
 */
export function search(
	index: BM25Index,
	query: string,
	limit = 10,
): { docIndex: number; score: number }[] {
	if (index.totalDocs === 0) return [];

	const queryTokens = tokenize(query);
	if (queryTokens.length === 0) return [];

	const scores = index.docs.map((doc, docIndex) => {
		let score = 0;

		for (const token of queryTokens) {
			const df = index.df.get(token) ?? 0;
			if (df === 0) continue;

			const N = index.totalDocs;
			// IDF with smoothing to prevent negative values
			const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

			const tf = doc.tf.get(token) || 0;
			if (tf === 0) continue;

			const docLen = doc.length;
			const normTf = (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * (docLen / index.avgDL)));

			score += idf * normTf;
		}

		return { docIndex, score };
	});

	return scores
		.filter((s) => s.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit);
}

// Module-level cache — safe for CLI (single process) and Express dashboard (single skillsBasePath).
// If multi-project mode is added, cache key should include basePath, not just timestamp.
let _cachedIndex: BM25Index | null = null;
let _cachedCatalogTimestamp = "";

/**
 * High-level search over a catalog skill list.
 * Rebuilds the BM25 index only when the catalog timestamp changes.
 * Returns SkillSearchResult[] ready for display or JSON output.
 */
export function searchSkills(
	skills: CatalogSkillEntry[],
	query: string,
	limit = 10,
	catalogTimestamp?: string,
): SkillSearchResult[] {
	// Rebuild index only if catalog changed or no cache exists
	if (!_cachedIndex || catalogTimestamp !== _cachedCatalogTimestamp) {
		_cachedIndex = buildIndex(skills);
		_cachedCatalogTimestamp = catalogTimestamp ?? "";
	}

	const hits = search(_cachedIndex, query, limit);

	return hits.map(({ docIndex, score }) => {
		const skill = skills[docIndex];
		return {
			name: skill.name,
			displayName: skill.displayName,
			description: skill.description,
			category: skill.category,
			score,
			path: skill.path,
		};
	});
}
