/**
 * Send Release Notification to Discord using Embeds
 *
 * Usage:
 *   node send-discord-release.cjs <type> <webhook-url>
 *
 * Args:
 *   type: 'production' or 'dev'
 *   webhook-url: Discord webhook URL
 *
 * Reads CHANGELOG.md to extract the latest release notes and formats them
 * as a structured Discord embed with section-based fields.
 */

const fs = require("fs");
const https = require("https");
const { URL } = require("url");

const releaseType = process.argv[2]; // 'production' or 'dev'
const webhookUrl = process.argv[3];

if (!releaseType || !webhookUrl) {
	console.error("Usage: node send-discord-release.cjs <type> <webhook-url>");
	process.exit(1);
}

/**
 * Extract the latest release entry from CHANGELOG.md
 * Parses version header, date, and section/item structure
 */
function extractLatestRelease() {
	const changelogPath = "CHANGELOG.md";

	if (!fs.existsSync(changelogPath)) {
		return {
			version: "Unknown",
			date: new Date().toISOString().split("T")[0],
			sections: {},
		};
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
			// Found next version header — stop collecting
			break;
		}

		if (!collecting) continue;

		// Match section headers: ### 🚀 Features, ### Bug Fixes, etc.
		const sectionMatch = line.match(/^### (.+)/);
		if (sectionMatch) {
			currentSection = sectionMatch[1];
			sections[currentSection] = [];
			continue;
		}

		// Collect bullet points
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
 * Create Discord embed from parsed release data
 *
 * Section names from CHANGELOG may already include emojis (e.g., "🚀 Features").
 * If a section name starts with an emoji, we use it as-is.
 * If not, we look up in the fallback map.
 */
function createEmbed(release) {
	const isDev = releaseType === "dev";
	const color = isDev ? 0xf5a623 : 0x10b981; // Orange for dev, Green for production
	const title = isDev
		? `Dev Release ${release.version}`
		: `Release ${release.version}`;
	const repoUrl = "https://github.com/mrgoonie/claudekit-cli";
	const url = `${repoUrl}/releases/tag/v${release.version}`;

	// Fallback emoji map for section names WITHOUT embedded emojis
	const fallbackEmojis = {
		Features: "🚀",
		Hotfixes: "🔥",
		"Bug Fixes": "🐞",
		Documentation: "📚",
		"Code Refactoring": "♻️",
		"Performance Improvements": "⚡",
		Tests: "✅",
		"Build System": "🏗️",
		CI: "👷",
		Chores: "🔧",
	};

	// Regex to detect leading emoji (Unicode emoji range)
	const startsWithEmoji =
		/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/u;

	const fields = [];

	for (const [sectionName, items] of Object.entries(release.sections)) {
		if (items.length === 0) continue;

		// If section name already has an emoji prefix, use as-is
		// Otherwise, look up in fallback map
		let fieldName;
		if (startsWithEmoji.test(sectionName)) {
			fieldName = sectionName;
		} else {
			const emoji = fallbackEmojis[sectionName] || "📌";
			fieldName = `${emoji} ${sectionName}`;
		}

		let fieldValue = items.map((item) => `• ${item}`).join("\n");

		// Discord field value max is 1024 characters
		if (fieldValue.length > 1024) {
			const truncateAt = fieldValue.lastIndexOf("\n", 1000);
			fieldValue =
				fieldValue.substring(0, truncateAt > 0 ? truncateAt : 1000) +
				"\n... *(truncated)*";
		}

		fields.push({
			name: fieldName,
			value: fieldValue,
			inline: false,
		});
	}

	// If no sections found, add a simple message
	if (fields.length === 0) {
		fields.push({
			name: "📋 Release Notes",
			value: "Release completed successfully. See full changelog on GitHub.",
			inline: false,
		});
	}

	return {
		title,
		url,
		color,
		timestamp: new Date().toISOString(),
		footer: {
			text: isDev ? "Dev Release • Pre-release" : "Production Release • Latest",
		},
		fields,
	};
}

/**
 * Send embed payload to Discord webhook
 */
function sendToDiscord(embed) {
	const botName =
		releaseType === "dev" ? "ClaudeKit Release Bot" : "ClaudeKit Release Bot";

	const payload = {
		username: botName,
		avatar_url: "https://github.com/claudekit.png",
		embeds: [embed],
	};

	const url = new URL(webhookUrl);
	const options = {
		hostname: url.hostname,
		path: url.pathname + url.search,
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
	};

	const req = https.request(options, (res) => {
		let data = "";
		res.on("data", (chunk) => {
			data += chunk;
		});
		res.on("end", () => {
			if (res.statusCode >= 200 && res.statusCode < 300) {
				console.log("[OK] Discord notification sent successfully");
			} else {
				console.error(`[X] Discord webhook failed with status ${res.statusCode}`);
				console.error(data);
				process.exit(1);
			}
		});
	});

	req.on("error", (error) => {
		console.error("[X] Error sending Discord notification:", error);
		process.exit(1);
	});

	req.write(JSON.stringify(payload));
	req.end();
}

// Main
try {
	const release = extractLatestRelease();
	console.log(
		`[i] Preparing ${releaseType} release notification for v${release.version}`,
	);

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
