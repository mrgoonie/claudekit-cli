#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const MAX_SETTINGS_BYTES = 5 * 1024 * 1024;

function isLegacyDescriptiveNamePrompt(entry) {
	if (!entry || entry.type !== "prompt" || typeof entry.prompt !== "string") return false;

	const prompt = entry.prompt;
	const lowerPrompt = prompt.toLowerCase();
	const isOriginalLegacyPrompt =
		prompt.includes("Use kebab-case file naming") &&
		prompt.includes("self-documenting") &&
		prompt.includes("Grep, Glob, Search");
	const isDescriptiveNameKebabPrompt =
		lowerPrompt.includes("descriptive-name") &&
		lowerPrompt.includes("kebab-case") &&
		(lowerPrompt.includes("file") || lowerPrompt.includes("filename"));

	return isOriginalLegacyPrompt || isDescriptiveNameKebabPrompt;
}

function pruneHooks(settings) {
	if (!settings || typeof settings !== "object" || !settings.hooks) return 0;

	let pruned = 0;
	for (const [eventName, entries] of Object.entries(settings.hooks)) {
		if (!Array.isArray(entries)) continue;

		const keptEntries = [];
		for (const entry of entries) {
			if (isLegacyDescriptiveNamePrompt(entry)) {
				pruned++;
				continue;
			}

			if (Array.isArray(entry?.hooks)) {
				const keptHooks = entry.hooks.filter((hook) => {
					if (isLegacyDescriptiveNamePrompt(hook)) {
						pruned++;
						return false;
					}
					return true;
				});
				if (keptHooks.length > 0) keptEntries.push({ ...entry, hooks: keptHooks });
				continue;
			}

			keptEntries.push(entry);
		}

		if (keptEntries.length === 0) {
			delete settings.hooks[eventName];
		} else {
			settings.hooks[eventName] = keptEntries;
		}
	}

	if (Object.keys(settings.hooks).length === 0) settings.hooks = undefined;
	return pruned;
}

function pruneSettingsFile(filePath) {
	try {
		if (!filePath || !fs.existsSync(filePath)) return 0;
		const stat = fs.statSync(filePath);
		if (!stat.isFile() || stat.size > MAX_SETTINGS_BYTES) return 0;

		const settings = JSON.parse(fs.readFileSync(filePath, "utf8"));
		const pruned = pruneHooks(settings);
		if (pruned > 0) {
			fs.writeFileSync(filePath, `${JSON.stringify(settings, null, 2)}\n`);
		}
		return pruned;
	} catch {
		return 0;
	}
}

function getHomeDir() {
	return process.env.CK_TEST_HOME || os.homedir();
}

function addIfSettingsFile(files, filePath) {
	if (!filePath) return;
	const base = path.basename(filePath);
	if (
		base === "settings.json" ||
		base === "settings.local.json" ||
		base.endsWith(".settings.json")
	) {
		files.add(path.resolve(filePath));
	}
}

function collectCandidateSettingsFiles() {
	const files = new Set();
	const initCwd = process.env.INIT_CWD;
	if (initCwd && path.isAbsolute(initCwd)) {
		addIfSettingsFile(files, path.join(initCwd, ".claude", "settings.json"));
		addIfSettingsFile(files, path.join(initCwd, ".claude", "settings.local.json"));
	}

	const homeDir = getHomeDir();
	const globalClaudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(homeDir, ".claude");
	addIfSettingsFile(files, path.join(globalClaudeDir, "settings.json"));
	addIfSettingsFile(files, path.join(globalClaudeDir, "settings.local.json"));

	const ccsDir = process.env.CK_TEST_CCS_DIR || path.join(homeDir, ".ccs");
	try {
		for (const dirent of fs.readdirSync(ccsDir, { withFileTypes: true })) {
			if (dirent.isFile()) addIfSettingsFile(files, path.join(ccsDir, dirent.name));
		}
	} catch {
		// Optional compatibility directory; skip when absent or unreadable.
	}

	return [...files];
}

function main() {
	let pruned = 0;
	for (const filePath of collectCandidateSettingsFiles()) {
		pruned += pruneSettingsFile(filePath);
	}

	if (pruned > 0 && process.env.CK_POSTINSTALL_DEBUG === "1") {
		console.warn(`[claudekit-cli] Pruned ${pruned} legacy hook prompt(s)`);
	}
}

main();

module.exports = {
	collectCandidateSettingsFiles,
	isLegacyDescriptiveNamePrompt,
	pruneHooks,
	pruneSettingsFile,
};
