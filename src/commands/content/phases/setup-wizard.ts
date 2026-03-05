/**
 * Onboarding wizard for `ck content`.
 * Orchestrates platform selection, per-platform setup, repo discovery,
 * brand detection, scheduling preferences, and review mode selection.
 * Persists the resulting config via state-manager.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import type { ContentConfig } from "../types.js";
import type { ContentLogger } from "./content-logger.js";
import { setupFacebookPlatform } from "./platform-setup-facebook.js";
import { setupXPlatform } from "./platform-setup-x.js";
import { discoverRepos } from "./repo-discoverer.js";
import { loadContentConfig, saveContentConfig } from "./state-manager.js";

export interface SetupResult {
	success: boolean;
	config: ContentConfig;
}

/**
 * Run the full onboarding wizard.
 * Returns the final config (and success flag) after all steps complete.
 */
export async function runSetupWizard(
	cwd: string,
	contentLogger: ContentLogger,
): Promise<SetupResult> {
	console.log();
	p.intro(pc.bgCyan(pc.white(" CK Content — Multi-Channel Content Engine ")));

	p.log.info("This wizard will help you set up automated content publishing");
	p.log.info("from your git activity to social media platforms.\n");

	// Load existing config (or schema defaults for a fresh install)
	const config = await loadContentConfig(cwd);

	// Step 1: Platform selection
	const selectedPlatforms = await selectPlatforms(config);
	if (selectedPlatforms === null) return { success: false, config };

	// Step 2: Per-platform setup
	await runPlatformSetups(selectedPlatforms, config, contentLogger);

	// Step 3: Repo discovery
	await showRepoSummary(cwd);

	// Step 4: Brand asset detection
	detectBrandAssets(cwd, contentLogger);

	// Step 5: Schedule / timezone
	await configureSchedule(config);

	// Step 6: Review mode
	await configureReviewMode(config);

	// Only enable if at least one platform was set up successfully
	const anyPlatformReady = config.platforms.x.enabled || config.platforms.facebook.enabled;
	config.enabled = anyPlatformReady;
	await saveContentConfig(cwd, config);

	if (!anyPlatformReady) {
		p.log.warning("No platforms configured successfully. Run 'ck content setup' to retry.");
		p.outro("Setup incomplete.");
		return { success: false, config };
	}

	printSummary(selectedPlatforms, config);
	p.outro("Run 'ck content start' to begin monitoring!");

	contentLogger.info("Setup wizard completed successfully");
	return { success: true, config };
}

// ---------------------------------------------------------------------------
// Step implementations
// ---------------------------------------------------------------------------

/** Prompt user to pick one or more platforms. Returns null on cancel. */
async function selectPlatforms(_config: ContentConfig): Promise<string[] | null> {
	const platforms = await p.multiselect({
		message: "Which platforms do you want to publish to?",
		options: [
			{ value: "x", label: "X (Twitter)", hint: "Auto-installs xurl CLI if needed" },
			{ value: "facebook", label: "Facebook Pages", hint: "Requires Meta API token" },
		],
		required: true,
	});
	if (p.isCancel(platforms)) return null;
	return platforms as string[];
}

/** Run setup for each selected platform and mutate config accordingly. */
async function runPlatformSetups(
	selectedPlatforms: string[],
	config: ContentConfig,
	contentLogger: ContentLogger,
): Promise<void> {
	if (selectedPlatforms.includes("x")) {
		const ok = await setupXPlatform(contentLogger);
		config.platforms.x.enabled = ok;
		if (!ok) p.log.warning("X setup incomplete. Retry later with 'ck content setup'.");
	}

	if (selectedPlatforms.includes("facebook")) {
		const fbResult = await setupFacebookPlatform(contentLogger);
		if (fbResult) {
			config.platforms.facebook.enabled = true;
			config.platforms.facebook.pageId = fbResult.pageId;
			// Access token intentionally NOT written to .ck.json — store it securely
			// (e.g. env var FACEBOOK_PAGE_TOKEN) and read at runtime.
			contentLogger.info(
				"Facebook page ID saved; store access token as env var FACEBOOK_PAGE_TOKEN",
			);
		} else {
			p.log.warning("Facebook setup incomplete. Retry later with 'ck content setup'.");
		}
	}
}

/** Discover repos and print a summary. */
async function showRepoSummary(cwd: string): Promise<void> {
	const repos = discoverRepos(cwd);
	p.log.info(`Found ${repos.length} git repo(s) to monitor:`);
	for (const repo of repos) {
		const remote = repo.remoteUrl ? ` (${repo.remoteUrl})` : " (local only)";
		p.log.info(`  ${pc.green("●")} ${repo.name}${remote}`);
	}
}

/** Warn about missing brand guideline files for all discovered repos. */
function detectBrandAssets(cwd: string, contentLogger: ContentLogger): void {
	const repos = discoverRepos(cwd);
	for (const repo of repos) {
		const hasGuidelines = existsSync(join(repo.path, "docs", "brand-guidelines.md"));
		const hasStyles = existsSync(join(repo.path, "assets", "writing-styles"));
		if (!hasGuidelines) {
			p.log.warning(`${repo.name}: No docs/brand-guidelines.md — content will use generic tone.`);
			contentLogger.warn(`${repo.name}: missing docs/brand-guidelines.md`);
		}
		if (!hasStyles) {
			p.log.warning(`${repo.name}: No assets/writing-styles/ found.`);
			contentLogger.warn(`${repo.name}: missing assets/writing-styles/`);
		}
	}
}

/** Set timezone and max-posts-per-day on the config object. */
async function configureSchedule(config: ContentConfig): Promise<void> {
	const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	p.log.info(`Detected timezone: ${timezone}`);
	config.schedule.timezone = timezone;

	const maxPosts = await p.text({
		message: "Max content posts per day (across all platforms)?",
		initialValue: String(config.maxContentPerDay),
		validate: (v) => {
			const n = Number.parseInt(v, 10);
			if (Number.isNaN(n) || n < 1 || n > 50) return "Enter a number between 1 and 50";
			return undefined;
		},
	});
	if (!p.isCancel(maxPosts)) {
		config.maxContentPerDay = Number.parseInt(String(maxPosts), 10);
	}
}

/** Prompt for review mode and set it on the config object. */
async function configureReviewMode(config: ContentConfig): Promise<void> {
	const reviewMode = await p.select({
		message: "Content review mode?",
		options: [
			{ value: "auto", label: "Auto", hint: "Publish immediately after creation" },
			{
				value: "hybrid",
				label: "Hybrid (recommended)",
				hint: "Auto by default, manual when flagged",
			},
			{ value: "manual", label: "Manual", hint: "Review every post before publishing" },
		],
	});
	if (!p.isCancel(reviewMode)) {
		config.reviewMode = reviewMode as "auto" | "manual" | "hybrid";
	}
}

/** Print a final configuration summary table. */
function printSummary(selectedPlatforms: string[], config: ContentConfig): void {
	p.log.success("Configuration saved!");
	console.log();
	console.log(`  ${pc.dim("Platforms:")}  ${selectedPlatforms.join(", ")}`);
	console.log(`  ${pc.dim("Review:")}     ${config.reviewMode}`);
	console.log(`  ${pc.dim("Max/day:")}    ${config.maxContentPerDay}`);
	console.log(`  ${pc.dim("Timezone:")}   ${config.schedule.timezone}`);
	console.log();
}
