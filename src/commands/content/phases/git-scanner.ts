/**
 * Git scanner orchestrator for the content command.
 * Discovers repos, detects changes, classifies events, and persists content-worthy ones to SQLite.
 */

import type { Database } from "bun:sqlite";
import type { ContentConfig, ContentState, ScanResult } from "../types.js";
import {
	detectCommits,
	detectCompletedPlans,
	detectMergedPRs,
	detectTags,
} from "./change-detector.js";
import type { ContentLogger } from "./content-logger.js";
import { insertGitEvent } from "./db-queries.js";
import { classifyEvent } from "./event-classifier.js";
import { discoverRepos } from "./repo-discoverer.js";

// Fallback lookback window when config value is somehow unavailable
const FALLBACK_LOOKBACK_DAYS = 30;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scan all discoverable git repos under `cwd`, classify events, and persist
 * content-worthy ones. Mutates `state.lastScanAt` on success.
 */
export async function scanGitRepos(
	cwd: string,
	_config: ContentConfig,
	state: ContentState,
	db: Database,
	contentLogger: ContentLogger,
): Promise<ScanResult> {
	const repos = discoverRepos(cwd);
	const isFirstScan = !state.lastScanAt;
	const lookbackDays = _config.firstScanLookbackDays ?? FALLBACK_LOOKBACK_DAYS;
	const since =
		state.lastScanAt ?? new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

	// Only log repo count on first scan; subsequent scans use debug level
	if (isFirstScan) {
		contentLogger.info(
			`Discovered ${repos.length} repo(s) to scan. Looking back ${lookbackDays} days.`,
		);
	} else {
		contentLogger.debug(`Scanning ${repos.length} repo(s) since ${since}`);
	}

	let eventsFound = 0;
	let contentWorthyEvents = 0;

	for (const repo of repos) {
		try {
			const rawEvents = [
				...detectCommits(repo, since),
				...detectMergedPRs(repo, since),
				...detectTags(repo, since),
				...detectCompletedPlans(repo, since),
			];

			let repoContentWorthy = 0;
			for (const raw of rawEvents) {
				eventsFound++;
				const classification = classifyEvent(raw);

				if (classification.contentWorthy) {
					contentWorthyEvents++;
					repoContentWorthy++;
					insertGitEvent(db, {
						repoPath: raw.repoPath,
						repoName: raw.repoName,
						eventType: raw.eventType,
						ref: raw.ref,
						title: raw.title,
						body: raw.body,
						author: raw.author,
						contentWorthy: true,
						importance: classification.importance,
					});
				}
			}

			contentLogger.debug(
				`Repo ${repo.name}: ${rawEvents.length} events found, ${repoContentWorthy} content-worthy`,
			);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			contentLogger.warn(`Error scanning repo ${repo.name}: ${msg}`);
		}
	}

	if (eventsFound === 0) {
		contentLogger.debug(`No new events since ${since}. Repos may have no recent activity.`);
	} else {
		contentLogger.info(
			`Scan complete: ${eventsFound} events found, ${contentWorthyEvents} content-worthy.`,
		);
	}

	state.lastScanAt = new Date().toISOString();

	return { totalRepos: repos.length, eventsFound, contentWorthyEvents };
}
