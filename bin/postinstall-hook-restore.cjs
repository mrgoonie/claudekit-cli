#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const MAX_SETTINGS_BYTES = 5 * 1024 * 1024;
const SAFE_KIT_NAMES = new Set(["engineer", "marketing"]);
const COMPLETE_HOOK_SENTINELS = new Set(["session-init", "session-state", "subagent-init"]);
const LEGACY_SPARSE_HOOK_SENTINELS = new Set([
	"descriptive-name",
	"privacy-block",
	"scout-block",
	"simplify-gate",
]);

function getHomeDir() {
	return process.env.CK_TEST_HOME || os.homedir();
}

function readJsonFile(filePath) {
	try {
		if (!filePath || !fs.existsSync(filePath)) return null;
		const stat = fs.statSync(filePath);
		if (!stat.isFile() || stat.size > MAX_SETTINGS_BYTES) return null;
		return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
	} catch {
		return null;
	}
}

function normalizeCommand(command) {
	if (!command) return "";
	let normalized = String(command).replace(/"/g, "");
	normalized = normalized.replace(/~\//g, "$HOME/");
	normalized = normalized.replace(/\$\{HOME\}/g, "$HOME");
	normalized = normalized.replace(/\$CLAUDE_PROJECT_DIR/g, "$HOME");
	normalized = normalized.replace(/%USERPROFILE%/g, "$HOME");
	normalized = normalized.replace(/%CLAUDE_PROJECT_DIR%/g, "$HOME");
	normalized = normalized.replace(/(^|\s)(?:\.\/)?\.claude\//g, "$1$HOME/.claude/");
	normalized = normalized.replace(/\\/g, "/");
	return normalized.replace(/\s+/g, " ").trim();
}

function collectHookCommands(settings) {
	const commands = new Set();
	for (const entries of Object.values(settings?.hooks || {})) {
		if (!Array.isArray(entries)) continue;
		for (const entry of entries) {
			if (typeof entry?.command === "string") commands.add(normalizeCommand(entry.command));
			if (!Array.isArray(entry?.hooks)) continue;
			for (const hook of entry.hooks) {
				if (typeof hook?.command === "string") commands.add(normalizeCommand(hook.command));
			}
		}
	}
	return commands;
}

function extractCkHookName(command) {
	if (!String(command || "").trim().startsWith("node ")) return null;
	const normalized = String(command).replace(/\\/g, "/");
	const match = normalized.match(/\/hooks\/([^/"'\s]+)\.(?:cjs|mjs|js)(?:["'\s]|$)/);
	return match?.[1] || null;
}

function installedHookCommands(config) {
	return Object.values(config?.kits || {}).flatMap((entry) =>
		Array.isArray(entry?.installedSettings?.hooks) ? entry.installedSettings.hooks : [],
	);
}

function hasInstalledKit(config) {
	return Object.keys(config?.kits || {}).some((kitName) => normalizeKitName(kitName));
}

function hasLegacySparseCkHooks(settings, config) {
	if (!hasInstalledKit(config)) return false;

	const hookNames = new Set();
	for (const command of collectHookCommands(settings)) {
		const hookName = extractCkHookName(command);
		if (hookName) hookNames.add(hookName);
	}

	const hasKnownSparseHook = [...LEGACY_SPARSE_HOOK_SENTINELS].some((hookName) =>
		hookNames.has(hookName),
	);
	if (!hasKnownSparseHook) return false;

	const disabledHooks = new Set(
		Object.entries(config?.hooks || {})
			.filter(([, enabled]) => enabled === false)
			.map(([name]) => name),
	);

	return [...COMPLETE_HOOK_SENTINELS].some(
		(hookName) => !disabledHooks.has(hookName) && !hookNames.has(hookName),
	);
}

function countMissingCkHookRegistrations(claudeDir) {
	const settings = readJsonFile(path.join(claudeDir, "settings.json"));
	const config = readJsonFile(path.join(claudeDir, ".ck.json"));
	if (!settings || !config) return 0;

	const existingCommands = collectHookCommands(settings);
	const disabledHooks = new Set(
		Object.entries(config.hooks || {})
			.filter(([, enabled]) => enabled === false)
			.map(([name]) => name),
	);

	let missing = 0;
	for (const command of installedHookCommands(config)) {
		const hookName = extractCkHookName(command);
		if (hookName && disabledHooks.has(hookName)) continue;
		if (!existingCommands.has(normalizeCommand(command))) missing++;
	}

	if (missing === 0 && installedHookCommands(config).length === 0) {
		return hasLegacySparseCkHooks(settings, config) ? 1 : 0;
	}

	return missing;
}

function normalizeKitName(name) {
	const normalized = String(name || "").toLowerCase();
	if (normalized.includes("engineer")) return "engineer";
	if (normalized.includes("marketing")) return "marketing";
	return SAFE_KIT_NAMES.has(normalized) ? normalized : null;
}

function getInstalledKit(claudeDir) {
	const metadata = readJsonFile(path.join(claudeDir, "metadata.json"));
	const metadataKit = normalizeKitName(Object.keys(metadata?.kits || {})[0] || metadata?.name);
	if (metadataKit) {
		const kitVersion = metadata?.kits?.[metadataKit]?.version || metadata?.version || "";
		return { kit: metadataKit, isBeta: String(kitVersion).includes("beta") };
	}

	const config = readJsonFile(path.join(claudeDir, ".ck.json"));
	const configKit = normalizeKitName(Object.keys(config?.kits || {})[0]);
	return configKit ? { kit: configKit, isBeta: false } : null;
}

function collectCandidateClaudeDirs(settingsFiles) {
	const dirs = new Set();
	for (const settingsFile of settingsFiles) dirs.add(path.dirname(settingsFile));
	return [...dirs];
}

function resolveCkEntrypoint() {
	return process.env.CK_POSTINSTALL_CK_BIN || path.join(__dirname, "ck.js");
}

function restoreMissingHookRegistrations(settingsFiles) {
	if (process.env.CK_POSTINSTALL_SKIP_RESTORE_CK_HOOKS === "1") return 0;

	let restored = 0;
	for (const claudeDir of collectCandidateClaudeDirs(settingsFiles)) {
		const missing = countMissingCkHookRegistrations(claudeDir);
		if (missing <= 0) continue;

		const installedKit = getInstalledKit(claudeDir);
		if (!installedKit?.kit) continue;

		const homeDir = getHomeDir();
		const globalClaudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(homeDir, ".claude");
		const isGlobal = path.resolve(claudeDir) === path.resolve(globalClaudeDir);
		const args = [resolveCkEntrypoint(), "init"];
		if (isGlobal) args.push("-g");
		args.push("--kit", installedKit.kit, "--yes", "--restore-ck-hooks", "--install-skills");
		if (installedKit.isBeta) args.push("--beta");

		const result = spawnSync(process.execPath, args, {
			env: { ...process.env, CK_POSTINSTALL_SKIP_RESTORE_CK_HOOKS: "1" },
			stdio: process.env.CK_POSTINSTALL_DEBUG === "1" ? "inherit" : "ignore",
		});
		if (result.status === 0) restored += missing;
	}

	return restored;
}

module.exports = {
	countMissingCkHookRegistrations,
	restoreMissingHookRegistrations,
};
