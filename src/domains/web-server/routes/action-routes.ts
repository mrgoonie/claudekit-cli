/**
 * Action API routes — adaptive cross-platform open actions (terminal, editor, launch)
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { ProjectsRegistryManager } from "@/domains/claudekit-data/index.js";
import { ConfigManager } from "@/domains/config/config-manager.js";
import { isMacOS, isWindows } from "@/shared/environment.js";
import { logger } from "@/shared/logger.js";
import type { Config } from "@/types";
import type { Express, Request, Response } from "express";
import { z } from "zod";

const VALID_ACTIONS = ["terminal", "editor", "launch"] as const;
const GLOBAL_PREFERENCE_SENTINEL = "__global__";
const DEFAULT_DETECTION_CACHE_TTL_MS = 30_000;
const DETECTION_CACHE_TTL_MS = (() => {
	const raw = process.env.CK_ACTION_CACHE_TTL_MS || process.env.CK_ACTION_CACHE_TTL;
	if (!raw) return DEFAULT_DETECTION_CACHE_TTL_MS;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DETECTION_CACHE_TTL_MS;
	return parsed;
})();
type ActionKind = "terminal" | "editor";
type PreferenceSource = "project" | "global" | "system";
type DetectionConfidence = "high" | "medium" | "low";

type TerminalAppId =
	| "system-terminal"
	| "iterm2"
	| "warp"
	| "windows-terminal"
	| "termius"
	| "wezterm"
	| "kitty"
	| "alacritty"
	| "gnome-terminal"
	| "konsole"
	| "tilix"
	| "xfce4-terminal"
	| "terminator"
	| "conemu";
type EditorAppId =
	| "system-editor"
	| "vscode"
	| "cursor"
	| "windsurf"
	| "antigravity"
	| "zed"
	| "sublime-text"
	| "jetbrains-launcher"
	| "notepad-plus-plus";
type AppId = TerminalAppId | EditorAppId;

interface SpawnCommand {
	command: string;
	args: string[];
	cwd?: string;
}

interface ProjectActionPreferences {
	terminalApp?: string;
	editorApp?: string;
}

interface ActionAppDefinition {
	id: AppId;
	kind: ActionKind;
	label: string;
	supportedPlatforms: NodeJS.Platform[];
	openMode: "open-directory" | "open-directory-inferred" | "open-app";
	capabilities: string[];
	commands?: string[];
	macAppName?: string;
	macAppPaths?: string[];
	windowsAppPaths?: string[];
	linuxAppPaths?: string[];
	fallbackDetectionPaths?: string[];
}

interface DetectedActionOption {
	id: AppId;
	label: string;
	detected: boolean;
	available: boolean;
	confidence: DetectionConfidence | null;
	reason?: string;
	openMode: "open-directory" | "open-directory-inferred" | "open-app";
	capabilities: string[];
}

interface ActionOptionsPayload {
	platform: NodeJS.Platform;
	terminals: DetectedActionOption[];
	editors: DetectedActionOption[];
	defaults: {
		terminalApp: TerminalAppId;
		terminalSource: PreferenceSource;
		editorApp: EditorAppId;
		editorSource: PreferenceSource;
	};
	preferences: {
		project: ProjectActionPreferences;
		global: ProjectActionPreferences;
	};
}

const ActionOptionsQuerySchema = z.object({
	projectId: z.string().min(1).max(256).optional(),
});

const OpenActionRequestSchema = z
	.object({
		action: z.enum(VALID_ACTIONS),
		path: z.string().min(1).max(4096),
		appId: z
			.string()
			.min(1)
			.max(64)
			.regex(/^[a-z0-9-]+$/)
			.optional(),
		projectId: z.string().min(1).max(256).optional(),
	})
	.strict();

// Best-effort installation roots for Windows app discovery.
// Non-standard/custom installs still rely on PATH-based detection.
const WINDOWS_PATHS = {
	localAppData: process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"),
	programFiles: process.env.ProgramFiles || "C:\\Program Files",
	programFilesX86: process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)",
};

function getWindowsPaths(...relativePaths: string[]): string[] {
	const roots = [
		WINDOWS_PATHS.localAppData,
		WINDOWS_PATHS.programFiles,
		WINDOWS_PATHS.programFilesX86,
	];
	return roots.flatMap((root) => relativePaths.map((rel) => join(root, rel)));
}

/**
 * App registry for action launchers.
 * To add a new app:
 * - choose stable `id`
 * - set supported platforms and open mode
 * - include PATH commands first, then install-path fallbacks
 * - implement launch command in buildTerminalCommand/buildEditorCommand
 */
const ACTION_APPS: ActionAppDefinition[] = [
	{
		id: "system-terminal",
		kind: "terminal",
		label: "System Terminal",
		supportedPlatforms: ["darwin", "win32", "linux"],
		openMode: "open-directory",
		capabilities: ["open-directory"],
	},
	{
		id: "iterm2",
		kind: "terminal",
		label: "iTerm2",
		supportedPlatforms: ["darwin"],
		openMode: "open-directory",
		capabilities: ["open-directory", "run-command"],
		macAppName: "iTerm",
		macAppPaths: ["/Applications/iTerm.app", join(homedir(), "Applications", "iTerm.app")],
	},
	{
		id: "warp",
		kind: "terminal",
		label: "Warp",
		supportedPlatforms: ["darwin", "win32", "linux"],
		openMode: "open-directory",
		capabilities: ["open-directory", "uri-scheme"],
		commands: ["warp"],
		macAppName: "Warp",
		macAppPaths: ["/Applications/Warp.app", join(homedir(), "Applications", "Warp.app")],
		windowsAppPaths: getWindowsPaths("Warp\\Warp.exe"),
		linuxAppPaths: ["/usr/bin/warp", "/usr/local/bin/warp"],
	},
	{
		id: "windows-terminal",
		kind: "terminal",
		label: "Windows Terminal",
		supportedPlatforms: ["win32"],
		openMode: "open-directory",
		capabilities: ["open-directory", "run-command"],
		commands: ["wt"],
		windowsAppPaths: [join(WINDOWS_PATHS.localAppData, "Microsoft", "WindowsApps", "wt.exe")],
	},
	{
		id: "wezterm",
		kind: "terminal",
		label: "WezTerm",
		supportedPlatforms: ["darwin", "win32", "linux"],
		openMode: "open-directory",
		capabilities: ["open-directory"],
		commands: ["wezterm"],
		macAppName: "WezTerm",
		macAppPaths: ["/Applications/WezTerm.app", join(homedir(), "Applications", "WezTerm.app")],
		windowsAppPaths: getWindowsPaths("WezTerm\\wezterm-gui.exe", "WezTerm\\wezterm.exe"),
		linuxAppPaths: ["/usr/bin/wezterm", "/usr/local/bin/wezterm"],
	},
	{
		id: "kitty",
		kind: "terminal",
		label: "Kitty",
		supportedPlatforms: ["darwin", "win32", "linux"],
		openMode: "open-directory",
		capabilities: ["open-directory"],
		commands: ["kitty"],
		macAppName: "kitty",
		macAppPaths: ["/Applications/kitty.app", join(homedir(), "Applications", "kitty.app")],
		windowsAppPaths: getWindowsPaths("kitty\\kitty.exe"),
		linuxAppPaths: ["/usr/bin/kitty", "/usr/local/bin/kitty"],
	},
	{
		id: "alacritty",
		kind: "terminal",
		label: "Alacritty",
		supportedPlatforms: ["darwin", "win32", "linux"],
		openMode: "open-directory",
		capabilities: ["open-directory"],
		commands: ["alacritty"],
		macAppName: "Alacritty",
		macAppPaths: ["/Applications/Alacritty.app", join(homedir(), "Applications", "Alacritty.app")],
		windowsAppPaths: getWindowsPaths("Alacritty\\alacritty.exe"),
		linuxAppPaths: ["/usr/bin/alacritty", "/usr/local/bin/alacritty"],
	},
	{
		id: "gnome-terminal",
		kind: "terminal",
		label: "GNOME Terminal",
		supportedPlatforms: ["linux"],
		openMode: "open-directory",
		capabilities: ["open-directory"],
		commands: ["gnome-terminal"],
		linuxAppPaths: ["/usr/bin/gnome-terminal"],
	},
	{
		id: "konsole",
		kind: "terminal",
		label: "Konsole",
		supportedPlatforms: ["linux"],
		openMode: "open-directory",
		capabilities: ["open-directory"],
		commands: ["konsole"],
		linuxAppPaths: ["/usr/bin/konsole"],
	},
	{
		id: "tilix",
		kind: "terminal",
		label: "Tilix",
		supportedPlatforms: ["linux"],
		openMode: "open-directory",
		capabilities: ["open-directory"],
		commands: ["tilix"],
		linuxAppPaths: ["/usr/bin/tilix"],
	},
	{
		id: "xfce4-terminal",
		kind: "terminal",
		label: "Xfce Terminal",
		supportedPlatforms: ["linux"],
		openMode: "open-directory",
		capabilities: ["open-directory"],
		commands: ["xfce4-terminal"],
		linuxAppPaths: ["/usr/bin/xfce4-terminal"],
	},
	{
		id: "terminator",
		kind: "terminal",
		label: "Terminator",
		supportedPlatforms: ["linux"],
		openMode: "open-directory",
		capabilities: ["open-directory"],
		commands: ["terminator"],
		linuxAppPaths: ["/usr/bin/terminator"],
	},
	{
		id: "conemu",
		kind: "terminal",
		label: "ConEmu",
		supportedPlatforms: ["win32"],
		openMode: "open-directory",
		capabilities: ["open-directory"],
		commands: ["ConEmu64.exe", "ConEmu.exe"],
		windowsAppPaths: getWindowsPaths("ConEmu\\ConEmu64.exe", "ConEmu\\ConEmu.exe"),
	},
	{
		id: "termius",
		kind: "terminal",
		label: "Termius",
		supportedPlatforms: ["darwin", "win32", "linux"],
		openMode: "open-app",
		capabilities: ["open-app"],
		commands: ["termius"],
		macAppName: "Termius",
		macAppPaths: ["/Applications/Termius.app", join(homedir(), "Applications", "Termius.app")],
		windowsAppPaths: getWindowsPaths("Termius\\Termius.exe"),
		linuxAppPaths: ["/usr/bin/termius"],
	},
	{
		id: "system-editor",
		kind: "editor",
		label: "System Editor",
		supportedPlatforms: ["darwin", "win32", "linux"],
		openMode: "open-directory",
		capabilities: ["open-directory"],
	},
	{
		id: "vscode",
		kind: "editor",
		label: "VS Code",
		supportedPlatforms: ["darwin", "win32", "linux"],
		openMode: "open-directory",
		capabilities: ["open-directory"],
		commands: ["code"],
		macAppName: "Visual Studio Code",
		macAppPaths: [
			"/Applications/Visual Studio Code.app",
			join(homedir(), "Applications", "Visual Studio Code.app"),
		],
		windowsAppPaths: getWindowsPaths(
			"Programs\\Microsoft VS Code\\Code.exe",
			"Microsoft VS Code\\Code.exe",
		),
		linuxAppPaths: ["/usr/bin/code", "/snap/bin/code"],
	},
	{
		id: "cursor",
		kind: "editor",
		label: "Cursor",
		supportedPlatforms: ["darwin", "win32", "linux"],
		openMode: "open-directory",
		capabilities: ["open-directory"],
		commands: ["cursor"],
		macAppName: "Cursor",
		macAppPaths: ["/Applications/Cursor.app", join(homedir(), "Applications", "Cursor.app")],
		windowsAppPaths: getWindowsPaths("Programs\\Cursor\\Cursor.exe", "Cursor\\Cursor.exe"),
		linuxAppPaths: ["/usr/bin/cursor"],
	},
	{
		id: "windsurf",
		kind: "editor",
		label: "Windsurf",
		supportedPlatforms: ["darwin", "win32", "linux"],
		openMode: "open-directory-inferred",
		capabilities: ["open-directory"],
		commands: ["windsurf"],
		macAppName: "Windsurf",
		macAppPaths: ["/Applications/Windsurf.app", join(homedir(), "Applications", "Windsurf.app")],
		windowsAppPaths: getWindowsPaths("Programs\\Windsurf\\Windsurf.exe", "Windsurf\\Windsurf.exe"),
		linuxAppPaths: ["/usr/bin/windsurf"],
	},
	{
		id: "antigravity",
		kind: "editor",
		label: "Antigravity",
		supportedPlatforms: ["darwin", "win32", "linux"],
		openMode: "open-directory",
		capabilities: ["open-directory"],
		commands: ["agy", "antigravity"],
		macAppName: "Antigravity",
		macAppPaths: [
			"/Applications/Antigravity.app",
			join(homedir(), "Applications", "Antigravity.app"),
		],
		windowsAppPaths: getWindowsPaths("Programs\\Antigravity\\Antigravity.exe"),
		linuxAppPaths: ["/usr/bin/antigravity"],
		fallbackDetectionPaths: [join(homedir(), ".gemini", "antigravity")],
	},
	{
		id: "zed",
		kind: "editor",
		label: "Zed",
		supportedPlatforms: ["darwin", "win32", "linux"],
		openMode: "open-directory",
		capabilities: ["open-directory"],
		commands: ["zed"],
		macAppName: "Zed",
		macAppPaths: ["/Applications/Zed.app", join(homedir(), "Applications", "Zed.app")],
		windowsAppPaths: getWindowsPaths("Zed\\Zed.exe"),
		linuxAppPaths: ["/usr/bin/zed", "/usr/local/bin/zed"],
	},
	{
		id: "sublime-text",
		kind: "editor",
		label: "Sublime Text",
		supportedPlatforms: ["darwin", "win32", "linux"],
		openMode: "open-directory",
		capabilities: ["open-directory"],
		commands: ["subl"],
		macAppName: "Sublime Text",
		macAppPaths: [
			"/Applications/Sublime Text.app",
			join(homedir(), "Applications", "Sublime Text.app"),
		],
		windowsAppPaths: getWindowsPaths("Sublime Text\\sublime_text.exe"),
		linuxAppPaths: ["/usr/bin/subl", "/snap/bin/subl"],
	},
	{
		id: "jetbrains-launcher",
		kind: "editor",
		label: "JetBrains Launcher",
		supportedPlatforms: ["darwin", "win32", "linux"],
		openMode: "open-directory",
		capabilities: ["open-directory"],
		// `resolveCommand` picks the first available command from PATH.
		commands: [
			"idea",
			"webstorm",
			"pycharm",
			"goland",
			"phpstorm",
			"rubymine",
			"clion",
			"datagrip",
			"rider",
		],
	},
	{
		id: "notepad-plus-plus",
		kind: "editor",
		label: "Notepad++",
		supportedPlatforms: ["win32"],
		openMode: "open-directory",
		capabilities: ["open-directory"],
		commands: ["notepad++", "notepad++.exe"],
		windowsAppPaths: getWindowsPaths("Notepad++\\notepad++.exe"),
	},
];

const SYSTEM_TERMINAL_ID: TerminalAppId = "system-terminal";
const SYSTEM_EDITOR_ID: EditorAppId = "system-editor";
const APP_IDS = new Set<AppId>(ACTION_APPS.map((app) => app.id));
const detectionCache = new Map<AppId, { expiresAt: number; option: DetectedActionOption }>();

function isCommandAvailable(command: string): boolean {
	const checkCommand = isWindows() ? "where" : "which";
	const result = spawnSync(checkCommand, [command], { stdio: "ignore" });
	return result.status === 0;
}

function resolveCommandPath(command: string): string | undefined {
	const checkCommand = isWindows() ? "where" : "which";
	const result = spawnSync(checkCommand, [command], { encoding: "utf-8" });
	if (result.status !== 0) return undefined;
	const firstMatch = result.stdout
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find((line) => line.length > 0);
	return firstMatch;
}

function tokenizeCommandSpec(spec: string): string[] {
	const matches = spec.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
	return matches.map((token) => {
		if (
			(token.startsWith('"') && token.endsWith('"')) ||
			(token.startsWith("'") && token.endsWith("'"))
		) {
			return token.slice(1, -1);
		}
		return token;
	});
}

function isValidExecutableToken(command: string): boolean {
	return /^[a-zA-Z0-9._/:\\\- ()]+$/.test(command);
}

function firstExistingPath(paths: string[] = []): string | undefined {
	return paths.find((path) => existsSync(path));
}

function isAppId(value: string): value is AppId {
	return APP_IDS.has(value as AppId);
}

/**
 * @internal Exported for testing
 */
export function getDefinition(appId: AppId): ActionAppDefinition {
	const definition = ACTION_APPS.find((app) => app.id === appId);
	if (!definition) throw new Error(`Unsupported app: ${appId}`);
	return definition;
}

function supportsCurrentPlatform(definition: ActionAppDefinition): boolean {
	return definition.supportedPlatforms.includes(process.platform);
}

function detectDefinitionUncached(definition: ActionAppDefinition): DetectedActionOption {
	if (!supportsCurrentPlatform(definition)) {
		return {
			id: definition.id,
			label: definition.label,
			detected: false,
			available: false,
			confidence: null,
			reason: "Unsupported on this platform",
			openMode: definition.openMode,
			capabilities: definition.capabilities,
		};
	}

	if (definition.id === SYSTEM_TERMINAL_ID || definition.id === SYSTEM_EDITOR_ID) {
		return {
			id: definition.id,
			label: definition.label,
			detected: true,
			available: true,
			confidence: "high",
			reason: "Built-in fallback",
			openMode: definition.openMode,
			capabilities: definition.capabilities,
		};
	}

	for (const command of definition.commands || []) {
		if (isCommandAvailable(command)) {
			return {
				id: definition.id,
				label: definition.label,
				detected: true,
				available: true,
				confidence: "high",
				reason: `Found command on PATH: ${command}`,
				openMode: definition.openMode,
				capabilities: definition.capabilities,
			};
		}
	}

	const appPath = firstExistingPath([
		...(definition.macAppPaths || []),
		...(definition.windowsAppPaths || []),
		...(definition.linuxAppPaths || []),
	]);
	if (appPath) {
		return {
			id: definition.id,
			label: definition.label,
			detected: true,
			available: true,
			confidence: "medium",
			reason: `Found app path: ${appPath}`,
			openMode: definition.openMode,
			capabilities: definition.capabilities,
		};
	}

	const fallbackPath = firstExistingPath(definition.fallbackDetectionPaths);
	if (fallbackPath) {
		return {
			id: definition.id,
			label: definition.label,
			detected: true,
			available: true,
			confidence: "low",
			reason: `Detected config signature: ${fallbackPath}`,
			openMode: definition.openMode,
			capabilities: definition.capabilities,
		};
	}

	return {
		id: definition.id,
		label: definition.label,
		detected: false,
		available: false,
		confidence: null,
		reason: "Not detected",
		openMode: definition.openMode,
		capabilities: definition.capabilities,
	};
}

/**
 * @internal Exported for testing
 */
export function detectDefinition(definition: ActionAppDefinition): DetectedActionOption {
	const cached = detectionCache.get(definition.id);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.option;
	}

	const option = detectDefinitionUncached(definition);
	detectionCache.set(definition.id, {
		expiresAt: Date.now() + DETECTION_CACHE_TTL_MS,
		option,
	});
	return option;
}

function resolveAutoDefault(kind: ActionKind, options: DetectedActionOption[]): AppId {
	const byId = new Map(options.map((option) => [option.id, option]));
	if (kind === "terminal") {
		if (isWindows() && byId.get("windows-terminal")?.available) {
			return "windows-terminal";
		}
		if (isMacOS() && byId.get("iterm2")?.available) {
			return "iterm2";
		}
		return SYSTEM_TERMINAL_ID;
	}
	return SYSTEM_EDITOR_ID;
}

/**
 * @internal Exported for testing
 */
export function resolveDefaultApp(
	kind: ActionKind,
	options: DetectedActionOption[],
	projectValue: string | undefined,
	globalValue: string | undefined,
): { appId: AppId; source: PreferenceSource } {
	const byId = new Map(options.map((option) => [option.id, option]));

	if (projectValue && isAppId(projectValue) && byId.get(projectValue)?.available) {
		return { appId: projectValue, source: "project" };
	}
	if (
		globalValue &&
		globalValue !== GLOBAL_PREFERENCE_SENTINEL &&
		isAppId(globalValue) &&
		byId.get(globalValue)?.available
	) {
		return { appId: globalValue, source: "global" };
	}

	const autoAppId = resolveAutoDefault(kind, options);
	if (byId.get(autoAppId)?.available) {
		return { appId: autoAppId, source: "system" };
	}

	const firstAvailable = options.find((option) => option.available);
	if (firstAvailable) {
		return { appId: firstAvailable.id, source: "system" };
	}

	return {
		appId: kind === "terminal" ? SYSTEM_TERMINAL_ID : SYSTEM_EDITOR_ID,
		source: "system",
	};
}

async function loadPreferences(projectId?: string): Promise<{
	project: ProjectActionPreferences;
	global: ProjectActionPreferences;
}> {
	const projectPreferences: ProjectActionPreferences = {};
	if (projectId && !projectId.startsWith("discovered-")) {
		const registered = await ProjectsRegistryManager.getProject(projectId);
		if (registered?.preferences) {
			projectPreferences.terminalApp = registered.preferences.terminalApp;
			projectPreferences.editorApp = registered.preferences.editorApp;
		}
	}

	ConfigManager.setGlobalFlag(false);
	const globalConfig: Config = await ConfigManager.load();
	const globalPreferences: ProjectActionPreferences = {
		terminalApp: globalConfig.defaults?.terminalApp,
		editorApp: globalConfig.defaults?.editorApp,
	};

	return {
		project: projectPreferences,
		global: globalPreferences,
	};
}

async function buildActionOptionsPayload(projectId?: string): Promise<ActionOptionsPayload> {
	const preferences = await loadPreferences(projectId);
	const terminals = ACTION_APPS.filter(
		(app) => app.kind === "terminal" && supportsCurrentPlatform(app),
	).map(detectDefinition);
	const editors = ACTION_APPS.filter(
		(app) => app.kind === "editor" && supportsCurrentPlatform(app),
	).map(detectDefinition);

	const terminalDefault = resolveDefaultApp(
		"terminal",
		terminals,
		preferences.project.terminalApp,
		preferences.global.terminalApp,
	);
	const editorDefault = resolveDefaultApp(
		"editor",
		editors,
		preferences.project.editorApp,
		preferences.global.editorApp,
	);
	if (!isValidAppIdForKind(terminalDefault.appId, "terminal")) {
		throw new Error(`Invalid terminal app ID resolved: ${terminalDefault.appId}`);
	}
	if (!isValidAppIdForKind(editorDefault.appId, "editor")) {
		throw new Error(`Invalid editor app ID resolved: ${editorDefault.appId}`);
	}

	return {
		platform: process.platform,
		terminals,
		editors,
		defaults: {
			terminalApp: terminalDefault.appId as TerminalAppId,
			terminalSource: terminalDefault.source,
			editorApp: editorDefault.appId as EditorAppId,
			editorSource: editorDefault.source,
		},
		preferences,
	};
}

function resolveCommand(definition: ActionAppDefinition): string | undefined {
	for (const command of definition.commands || []) {
		if (isCommandAvailable(command)) {
			return command;
		}
	}
	return undefined;
}

function resolveBinaryPath(definition: ActionAppDefinition): string | undefined {
	const candidatePaths = [
		...(definition.windowsAppPaths || []),
		...(definition.linuxAppPaths || []),
	];
	return firstExistingPath(candidatePaths);
}

function buildNotDetectedError(definition: ActionAppDefinition): Error {
	const commandHints = definition.commands?.length
		? ` Ensure one of these commands is on PATH: ${definition.commands.join(", ")}.`
		: "";
	return new Error(`${definition.label} is not detected on this system.${commandHints}`);
}

function resolveLaunchBinary(definition: ActionAppDefinition): string {
	const command = resolveCommand(definition);
	if (command) return command;

	const executablePath = resolveBinaryPath(definition);
	if (executablePath) return executablePath;

	throw buildNotDetectedError(definition);
}

function buildOsaScriptCommand(scriptLines: string[], argv: string[] = []): SpawnCommand {
	const args: string[] = [];
	for (const line of scriptLines) {
		args.push("-e", line);
	}
	if (argv.length > 0) {
		args.push("--", ...argv);
	}
	return { command: "osascript", args };
}

/**
 * @internal Exported for testing
 */
export function isPathInsideBase(path: string, base: string): boolean {
	const normalizedPath = resolve(path);
	const normalizedBase = resolve(base);
	if (normalizedPath === normalizedBase) return true;
	return normalizedPath.startsWith(`${normalizedBase}${sep}`);
}

async function isActionPathAllowed(dirPath: string, projectId?: string): Promise<boolean> {
	if (projectId && !projectId.startsWith("discovered-")) {
		const project = await ProjectsRegistryManager.getProject(projectId);
		if (!project) return false;
		return resolve(project.path) === dirPath;
	}

	const registeredProjects = await ProjectsRegistryManager.listProjects();
	if (registeredProjects.some((project) => resolve(project.path) === dirPath)) {
		return true;
	}

	if (isPathInsideBase(dirPath, process.cwd())) {
		return true;
	}

	return isPathInsideBase(dirPath, homedir());
}

function buildSystemTerminalCommand(dirPath: string): SpawnCommand {
	if (isMacOS()) {
		return { command: "open", args: ["-a", "Terminal", dirPath] };
	}
	if (isWindows()) {
		return { command: "cmd.exe", args: ["/c", "start", "cmd", "/k"], cwd: dirPath };
	}
	return { command: "x-terminal-emulator", args: ["--working-directory", dirPath] };
}

/**
 * @internal Exported for testing
 */
export function buildSystemEditorCommand(dirPath: string): SpawnCommand {
	const editorSpec = (process.env.EDITOR || process.env.VISUAL || "code").trim();
	const [editorCommand, ...editorArgs] = tokenizeCommandSpec(editorSpec);
	if (!editorCommand) {
		throw new Error("System editor command is empty. Set EDITOR or VISUAL to an executable.");
	}
	if (!isValidExecutableToken(editorCommand)) {
		throw new Error(
			`Invalid system editor command: ${editorCommand}. Use only executable tokens in EDITOR/VISUAL.`,
		);
	}

	// Path-based commands are checked as files; bare commands must be resolvable on PATH.
	const isPathCommand =
		editorCommand.includes("/") || editorCommand.includes("\\") || editorCommand.includes(":");
	if (isPathCommand) {
		if (!existsSync(editorCommand)) {
			throw new Error(`System editor not found at path: ${editorCommand}`);
		}
	} else if (!isCommandAvailable(editorCommand)) {
		throw new Error(`System editor command not found on PATH: ${editorCommand}`);
	}

	return { command: editorCommand, args: [...editorArgs, dirPath] };
}

function buildOpenAppCommand(definition: ActionAppDefinition, dirPath?: string): SpawnCommand {
	if (dirPath && !existsSync(dirPath)) {
		throw new Error(`Target path does not exist: ${dirPath}`);
	}

	const command = resolveCommand(definition);
	if (command) {
		return { command, args: dirPath ? [dirPath] : [] };
	}

	if (isMacOS()) {
		const appName = definition.macAppName || definition.label;
		return { command: "open", args: ["-a", appName, ...(dirPath ? [dirPath] : [])] };
	}

	const executablePath = resolveBinaryPath(definition);
	if (!executablePath) throw buildNotDetectedError(definition);
	return { command: executablePath, args: dirPath ? [dirPath] : [] };
}

function buildUriOpenCommand(uri: string): SpawnCommand {
	if (isMacOS()) {
		return { command: "open", args: [uri] };
	}
	if (isWindows()) {
		return { command: "rundll32.exe", args: ["url.dll,FileProtocolHandler", uri] };
	}
	return { command: "xdg-open", args: [uri] };
}

function buildWarpDirectoryCommand(dirPath: string): SpawnCommand {
	const uri = `warp://action/new_tab?path=${encodeURIComponent(dirPath)}`;
	return buildUriOpenCommand(uri);
}

function buildTerminalCommand(appId: TerminalAppId, dirPath: string): SpawnCommand {
	switch (appId) {
		case "system-terminal":
			return buildSystemTerminalCommand(dirPath);
		case "windows-terminal": {
			const definition = getDefinition("windows-terminal");
			return { command: resolveLaunchBinary(definition), args: ["-d", dirPath], cwd: dirPath };
		}
		case "iterm2": {
			if (!isMacOS()) throw new Error("iTerm2 is only supported on macOS");
			return buildOsaScriptCommand(
				[
					"on run argv",
					"set targetDir to item 1 of argv",
					'tell application "iTerm"',
					"activate",
					'create window with default profile command ("cd " & quoted form of targetDir)',
					"end tell",
					"end run",
				],
				[dirPath],
			);
		}
		case "warp":
			return buildWarpDirectoryCommand(dirPath);
		case "wezterm": {
			const definition = getDefinition("wezterm");
			return {
				command: resolveLaunchBinary(definition),
				args: ["start", "--cwd", dirPath],
				cwd: dirPath,
			};
		}
		case "kitty": {
			const definition = getDefinition("kitty");
			return {
				command: resolveLaunchBinary(definition),
				args: ["--directory", dirPath],
				cwd: dirPath,
			};
		}
		case "alacritty": {
			const definition = getDefinition("alacritty");
			return {
				command: resolveLaunchBinary(definition),
				args: ["--working-directory", dirPath],
				cwd: dirPath,
			};
		}
		case "gnome-terminal": {
			const definition = getDefinition("gnome-terminal");
			return {
				command: resolveLaunchBinary(definition),
				args: [`--working-directory=${dirPath}`],
				cwd: dirPath,
			};
		}
		case "konsole": {
			const definition = getDefinition("konsole");
			return {
				command: resolveLaunchBinary(definition),
				args: ["--workdir", dirPath],
				cwd: dirPath,
			};
		}
		case "tilix": {
			const definition = getDefinition("tilix");
			return {
				command: resolveLaunchBinary(definition),
				args: [`--working-directory=${dirPath}`],
				cwd: dirPath,
			};
		}
		case "xfce4-terminal": {
			const definition = getDefinition("xfce4-terminal");
			return {
				command: resolveLaunchBinary(definition),
				args: [`--working-directory=${dirPath}`],
				cwd: dirPath,
			};
		}
		case "terminator": {
			const definition = getDefinition("terminator");
			return {
				command: resolveLaunchBinary(definition),
				args: [`--working-directory=${dirPath}`],
				cwd: dirPath,
			};
		}
		case "conemu": {
			const definition = getDefinition("conemu");
			return { command: resolveLaunchBinary(definition), args: ["-Dir", dirPath], cwd: dirPath };
		}
		case "termius":
			return buildOpenAppCommand(getDefinition("termius"));
	}
}

function buildEditorCommand(appId: EditorAppId, dirPath: string): SpawnCommand {
	switch (appId) {
		case "system-editor":
			return buildSystemEditorCommand(dirPath);
		case "vscode":
			return buildOpenAppCommand(getDefinition("vscode"), dirPath);
		case "cursor":
			return buildOpenAppCommand(getDefinition("cursor"), dirPath);
		case "windsurf":
			return buildOpenAppCommand(getDefinition("windsurf"), dirPath);
		case "antigravity":
			return buildOpenAppCommand(getDefinition("antigravity"), dirPath);
		case "zed":
			return buildOpenAppCommand(getDefinition("zed"), dirPath);
		case "sublime-text":
			return buildOpenAppCommand(getDefinition("sublime-text"), dirPath);
		case "jetbrains-launcher":
			return buildOpenAppCommand(getDefinition("jetbrains-launcher"), dirPath);
		case "notepad-plus-plus": {
			const definition = getDefinition("notepad-plus-plus");
			return {
				command: resolveLaunchBinary(definition),
				args: ["-openFoldersAsWorkspace", dirPath],
			};
		}
	}
}

/**
 * @internal Exported for testing
 */
export function buildLaunchCommand(dirPath: string): SpawnCommand {
	if (isMacOS()) {
		return buildOsaScriptCommand(
			[
				"on run argv",
				"set targetDir to item 1 of argv",
				'tell application "Terminal"',
				"activate",
				'do script ("cd " & quoted form of targetDir & " && claude")',
				"end tell",
				"end run",
			],
			[dirPath],
		);
	}
	if (isWindows()) {
		return {
			command: "cmd.exe",
			args: ["/c", "start", "cmd", "/k", "claude"],
			cwd: dirPath,
		};
	}
	const claudeCommand = resolveCommandPath("claude") || "claude";
	return {
		command: "x-terminal-emulator",
		args: ["-e", claudeCommand],
		cwd: dirPath,
	};
}

/**
 * @internal Exported for testing
 */
export function clearActionDetectionCacheForTesting(): void {
	detectionCache.clear();
}

function isValidAppIdForKind(appId: string, kind: ActionKind): boolean {
	if (!isAppId(appId)) return false;
	return ACTION_APPS.some(
		(app) => app.id === appId && app.kind === kind && supportsCurrentPlatform(app),
	);
}

export function registerActionRoutes(app: Express): void {
	app.get("/api/actions/options", async (req: Request, res: Response) => {
		try {
			const validation = ActionOptionsQuerySchema.safeParse({
				projectId: typeof req.query.projectId === "string" ? req.query.projectId : undefined,
			});
			if (!validation.success) {
				res.status(400).json({
					error: "Invalid request query",
					details: validation.error.issues,
				});
				return;
			}
			const payload = await buildActionOptionsPayload(validation.data.projectId);
			res.json(payload);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			res.status(500).json({ error: msg });
		}
	});

	// POST /api/actions/open — spawn external process (terminal, editor, claude)
	app.post("/api/actions/open", async (req: Request, res: Response) => {
		try {
			const validation = OpenActionRequestSchema.safeParse(req.body);
			if (!validation.success) {
				res.status(400).json({
					error: "Invalid request body",
					details: validation.error.issues,
				});
				return;
			}

			const { action, path: rawPath, appId, projectId } = validation.data;
			const dirPath = resolve(rawPath);
			if (!existsSync(dirPath)) {
				res.status(400).json({ error: "Path does not exist" });
				return;
			}

			const allowedPath = await isActionPathAllowed(dirPath, projectId);
			if (!allowedPath) {
				res.status(403).json({
					error: "Path is not allowed for this action. Use a registered project path.",
				});
				return;
			}

			let commandToRun: SpawnCommand;
			if (action === "terminal") {
				let terminalId: TerminalAppId;
				if (typeof appId === "string") {
					if (!isValidAppIdForKind(appId, "terminal")) {
						res.status(400).json({ error: `Invalid terminal appId: ${appId}` });
						return;
					}
					terminalId = appId as TerminalAppId;
				} else {
					const payload = await buildActionOptionsPayload(
						typeof projectId === "string" ? projectId : undefined,
					);
					terminalId = payload.defaults.terminalApp;
				}
				commandToRun = buildTerminalCommand(terminalId, dirPath);
			} else if (action === "editor") {
				let editorId: EditorAppId;
				if (typeof appId === "string") {
					if (!isValidAppIdForKind(appId, "editor")) {
						res.status(400).json({ error: `Invalid editor appId: ${appId}` });
						return;
					}
					editorId = appId as EditorAppId;
				} else {
					const payload = await buildActionOptionsPayload(
						typeof projectId === "string" ? projectId : undefined,
					);
					editorId = payload.defaults.editorApp;
				}
				commandToRun = buildEditorCommand(editorId, dirPath);
			} else {
				commandToRun = buildLaunchCommand(dirPath);
			}
			const spawnCwd = resolve(commandToRun.cwd || dirPath);
			if (spawnCwd !== dirPath) {
				const spawnCwdAllowed = await isActionPathAllowed(
					spawnCwd,
					typeof projectId === "string" ? projectId : undefined,
				);
				if (!spawnCwdAllowed) {
					res.status(403).json({
						error: "Spawn working directory is not allowed for this action.",
					});
					return;
				}
			}

			// Fire-and-forget: a success response means spawn was attempted.
			// Process startup failures can still happen asynchronously and are logged below.
			const child = spawn(commandToRun.command, commandToRun.args, {
				detached: true,
				stdio: "ignore",
				cwd: spawnCwd,
			});
			child.unref();

			child.on("error", (err) => {
				logger.error(`[actions] Spawn error for ${action}: ${err.message}`);
			});

			res.json({ success: true, action, path: dirPath, appId: appId || null });
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			res.status(500).json({ error: msg });
		}
	});
}
