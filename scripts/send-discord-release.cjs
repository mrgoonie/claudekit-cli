/**
 * Send Release Notification to Discord using Embeds
 *
 * Usage:
 *   node send-discord-release.cjs <type>
 *
 * Args:
 *   type: 'production' or 'dev'
 *
 * Env:
 *   DISCORD_WEBHOOK_URL: Discord webhook URL (read from env, not CLI args)
 *
 * Reads CHANGELOG.md to extract the latest release notes and formats them
 * as a structured Discord embed with section-based fields.
 *
 * NOTE: Version gate relies on @semantic-release/npm updating package.json.
 * If the release config changes to skip that step, the workflow gate will
 * silently fail to detect new releases.
 */

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const { URL } = require("node:url");

const releaseType = process.argv[2];
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

if (!["production", "dev"].includes(releaseType)) {
	console.error(`[X] Invalid release type: "${releaseType}". Must be 'production' or 'dev'`);
	process.exit(1);
}

if (!webhookUrl) {
	console.error("[X] DISCORD_WEBHOOK_URL env var not set");
	process.exit(1);
}

/**
 * Extract the latest release entry from CHANGELOG.md
 * Parses version header, date, and section/item structure
 */
function extractLatestRelease() {
	const changelogPath = path.resolve(__dirname, "../CHANGELOG.md");

	if (!fs.existsSync(changelogPath)) {
		return { version: "Unknown", date: new Date().toISOString().split("T")[0], sections: {} };
	}

	const content = fs.readFileSync(changelogPath, "utf8");
	const lines = content.split("\n");

	let version = "Unknown";
	let date = new Date().toISOString().split("T")[0];
	let collecting = false;
	let currentSection = null;
	const sections = {};

	for (const line of lines) {
		// Match version header: ## 1.15.0 (2025-11-22) or ## [1.15.0](url) (2025-11-22)
		const versionMatch = line.match(
			/^## \[?(\d+\.\d+\.\d+(?:-dev\.\d+)?)\]?.*?\((\d{4}-\d{2}-\d{2})\)/,
		);
		if (versionMatch) {
			if (!collecting) {
				version = versionMatch[1];
				date = versionMatch[2];
				collecting = true;
				continue;
			}
			break;
		}

		if (!collecting) continue;

		const sectionMatch = line.match(/^### (.+)/);
		if (sectionMatch) {
			currentSection = sectionMatch[1];
			sections[currentSection] = [];
			continue;
		}

		if (currentSection && line.trim().startsWith("*")) {
			const item = line.trim().substring(1).trim();
			if (item) {
				sections[currentSection].push(item);
			}
		}
	}

	return { version, date, sections };
}

/**
 * Create Discord embed from parsed release data.
 * Section names from CHANGELOG may already include emojis (e.g., "🚀 Features")
 * from .releaserc presetConfig — detect and avoid double-prepending.
 */
function createEmbed(release) {
	const isDev = releaseType === "dev";
	const color = isDev ? 0xf5a623 : 0x10b981;
	const title = isDev ? `🧪 Dev Release ${release.version}` : `🚀 Release ${release.version}`;
	const repoUrl = "https://github.com/mrgoonie/claudekit-cli";
	const url = `${repoUrl}/releases/tag/v${release.version}`;

	const fallbackEmojis = {
		Features: "🚀",
		Hotfixes: "🔥",
		"Bug Fixes": "🐞",
		Documentation: "📚",
		"Code Refactoring": "♻️",
		"Performance Improvements": "⚡",
		Tests: "✅",
		Styles: "💄",
		"Build System": "🏗️",
		CI: "👷",
		Chores: "🔧",
	};

	// Simplified emoji detection — covers all emojis used in .releaserc presetConfig
	const startsWithEmoji = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

	const footerText = isDev ? "Dev Release • Pre-release" : "Production Release • Latest";

	// Discord embed limits enforced here:
	//   - field.value: 1024 chars
	//   - field count: 25 max
	//   - TOTAL embed text (title + footer + all field names + all field values): 6000 chars
	// Discord rejects oversized embeds with HTTP 400. Track running total and bail
	// out into a pointer field before hitting the limit.
	const TOTAL_LIMIT = 6000;
	const SAFETY_MARGIN = 400; // leave room for the pointer field if we truncate
	let runningTotal = title.length + footerText.length;

	const fields = [];
	let truncatedSections = false;

	// Reserve slot 25 for the "More changes" pointer field — bail at 24 so the
	// pointer (added below when truncatedSections is true) keeps total <= 25.
	for (const [sectionName, items] of Object.entries(release.sections)) {
		if (items.length === 0) continue;
		if (fields.length >= 24) {
			truncatedSections = true;
			break;
		}

		let fieldName;
		if (startsWithEmoji.test(sectionName)) {
			fieldName = sectionName;
		} else {
			const emoji = fallbackEmojis[sectionName] || "📌";
			fieldName = `${emoji} ${sectionName}`;
		}

		let fieldValue = items.map((item) => `• ${item}`).join("\n");

		// Per-field limit (Discord rejects fields >1024 chars)
		if (fieldValue.length > 1024) {
			const truncateAt = fieldValue.lastIndexOf("\n", 1000);
			fieldValue = `${fieldValue.substring(0, truncateAt > 0 ? truncateAt : 1000)}\n... *(truncated)*`;
		}

		const fieldSize = fieldName.length + fieldValue.length;
		if (runningTotal + fieldSize > TOTAL_LIMIT - SAFETY_MARGIN) {
			truncatedSections = true;
			break;
		}

		runningTotal += fieldSize;
		fields.push({ name: fieldName, value: fieldValue, inline: false });
	}

	if (truncatedSections) {
		fields.push({
			name: "📋 More changes",
			value: `Some sections were omitted to fit Discord's 6000-char embed limit. See the [full release notes](${url}).`,
			inline: false,
		});
	}

	return {
		title,
		url,
		color,
		timestamp: new Date().toISOString(),
		footer: { text: footerText },
		fields,
	};
}

/**
 * Send embed payload to Discord webhook
 */
function sendToDiscord(embed) {
	const payload = {
		username: releaseType === "dev" ? "ClaudeKit Dev Release Bot" : "ClaudeKit Release Bot",
		avatar_url: "https://github.com/claudekit.png",
		embeds: [embed],
	};

	const url = new URL(webhookUrl);
	const options = {
		hostname: url.hostname,
		path: url.pathname + url.search,
		method: "POST",
		headers: { "Content-Type": "application/json" },
	};

	const req = https.request(options, (res) => {
		let data = "";
		res.on("data", (chunk) => {
			data += chunk;
		});
		res.on("end", () => {
			// Log status + response body excerpt in BOTH success and failure paths so
			// future debugging can distinguish "Discord accepted" from "stale webhook
			// returned 2xx but didn't deliver" or "rate limited".
			const bodyExcerpt = data ? data.slice(0, 500) : "(empty)";
			const rateLimitRemaining = res.headers["x-ratelimit-remaining"];
			const rateLimitInfo =
				rateLimitRemaining !== undefined ? ` rate-limit-remaining=${rateLimitRemaining}` : "";

			if (res.statusCode >= 200 && res.statusCode < 300) {
				console.log(`[OK] Discord webhook accepted: status=${res.statusCode}${rateLimitInfo}`);
				console.log(`[i] Response body: ${bodyExcerpt}`);
			} else {
				console.error(`[X] Discord webhook failed: status=${res.statusCode}${rateLimitInfo}`);
				console.error(`[X] Response body: ${bodyExcerpt}`);
				process.exit(1);
			}
		});
	});

	let timedOut = false;
	req.setTimeout(10000, () => {
		timedOut = true;
		console.error("[X] Discord webhook request timed out");
		req.destroy();
		process.exit(1);
	});

	req.on("error", (error) => {
		if (timedOut) return;
		console.error("[X] Error sending Discord notification:", error);
		process.exit(1);
	});

	req.write(JSON.stringify(payload));
	req.end();
}

// For dev releases, build release info from git log since previous tag.
// Parses conventional commits into sections matching .releaserc.js presetConfig.
function extractDevRelease() {
	const pkgPath = path.resolve(__dirname, "../package.json");
	const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
	const version = pkg.version;

	const { execSync } = require("node:child_process");

	// Find previous tag to scope commits (avoid repeating old entries).
	// In CI, the current release tag is already pushed before this script runs.
	// Use package.json version to identify current tag explicitly, then pick
	// the next most recent tag as the range base. Aligned with release-dev.yml logic.
	let range = "";
	try {
		const currentTag = `v${version}`;
		const allTags = execSync("git tag --sort=-v:refname", {
			encoding: "utf8",
		})
			.trim()
			.split("\n")
			.filter((t) => t?.startsWith("v") && t !== currentTag);
		const prevTag = allTags.length >= 1 ? allTags[0] : null;
		if (prevTag) range = `${prevTag}..HEAD`;
	} catch {
		/* fall back to last 20 commits */
	}

	let commits = [];
	try {
		// range is from git tag output (semver only, safe for shell)
		const cmd = range
			? `git log ${range} --no-merges --format="%h %s"`
			: 'git log --no-merges -20 --format="%h %s"';
		const log = execSync(cmd, { encoding: "utf8" });
		commits = log
			.trim()
			.split("\n")
			.filter((l) => l && !l.includes("[skip ci]"));
	} catch {
		/* ignore */
	}

	// Section mapping matching .releaserc.js presetConfig (emojis included to skip fallback lookup)
	const sectionMap = {
		feat: "🚀 Features",
		hotfix: "🔥 Hotfixes",
		fix: "🐞 Bug Fixes",
		perf: "⚡ Performance Improvements",
		refactor: "♻️ Code Refactoring",
		docs: "📚 Documentation",
		test: "✅ Tests",
		build: "🏗️ Build System",
		ci: "👷 CI",
		chore: "🔧 Chores",
	};

	// Desired display order for sections
	const sectionOrder = Object.values(sectionMap);

	const parsed = {};
	for (const line of commits) {
		// Parse: "<hash> <type>(<scope>): <description>" or "<hash> <type>: <description>"
		const match = line.match(/^([a-f0-9]+)\s+(\w+)(?:\(([^)]*)\))?!?:\s*(.+)/);
		if (match) {
			const [, hash, type, scope, description] = match;
			const section = sectionMap[type.toLowerCase()] || "📌 Other Changes";
			if (!parsed[section]) parsed[section] = [];
			const entry = scope ? `**${scope}:** ${description} (${hash})` : `${description} (${hash})`;
			parsed[section].push(entry);
		} else {
			// Non-conventional commit — extract hash and message
			const parts = line.match(/^([a-f0-9]+)\s+(.+)/);
			if (parts) {
				if (!parsed["📌 Other Changes"]) parsed["📌 Other Changes"] = [];
				parsed["📌 Other Changes"].push(`${parts[2]} (${parts[1]})`);
			}
		}
	}

	// Return sections in consistent order (Features first, then Hotfixes, Bug Fixes, etc.)
	const sections = {};
	for (const name of [...sectionOrder, "📌 Other Changes"]) {
		if (parsed[name]) sections[name] = parsed[name];
	}

	return { version, date: new Date().toISOString().split("T")[0], sections };
}

// Main
try {
	const isDev = releaseType === "dev";
	const release = isDev ? extractDevRelease() : extractLatestRelease();
	console.log(`[i] Preparing ${releaseType} release notification for v${release.version}`);

	const sectionCount = Object.values(release.sections).flat().length;
	if (sectionCount === 0) {
		console.log("[i] No changelog items found — skipping Discord notification");
		process.exit(0);
	}

	const embed = createEmbed(release);
	sendToDiscord(embed);
} catch (error) {
	console.error("[X] Error:", error);
	process.exit(1);
}
