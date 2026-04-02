/**
 * Statusline UI types — mirrors src/types/ck-config.ts StatuslineLayout schema.
 * Kept as plain TypeScript interfaces (no Zod) for UI bundle size.
 */

export type StatuslineSectionId =
	| "model"
	| "context"
	| "quota"
	| "directory"
	| "git"
	| "cost"
	| "changes"
	| "agents"
	| "todos";

export const ALL_SECTION_IDS: StatuslineSectionId[] = [
	"model",
	"context",
	"quota",
	"directory",
	"git",
	"cost",
	"changes",
	"agents",
	"todos",
];

export type StatuslineMode = "full" | "compact" | "minimal" | "none";

/** Per-section display overrides */
export interface SectionConfig {
	icon?: string;
	label?: string;
	color?: string;
	maxWidth?: number;
}

export interface StatuslineTheme {
	name?: string;
	contextLow: string;
	contextMid: string;
	contextHigh: string;
	accent: string;
	muted: string;
	separator: string;
	quotaLow: string;
	quotaHigh: string;
}

/** Full layout shape used by the builder and persisted to .ck.json */
export interface StatuslineBuilderLayout {
	baseMode: StatuslineMode;
	lines: string[][];
	sectionConfig: Record<string, SectionConfig>;
	theme: StatuslineTheme;
	responsiveBreakpoint: number;
	maxAgentRows: number;
	todoTruncation: number;
}

// Keep StatuslineLayout as legacy alias for settings panel compatibility
export interface StatuslineLayout {
	baseMode: StatuslineMode;
	lines?: string[][];
	sectionConfig?: Record<string, SectionConfig>;
	theme?: StatuslineTheme;
	responsiveBreakpoint: number;
	maxAgentRows: number;
	todoTruncation: number;
}

export const DEFAULT_STATUSLINE_THEME: StatuslineTheme = {
	contextLow: "green",
	contextMid: "yellow",
	contextHigh: "red",
	accent: "cyan",
	muted: "dim",
	separator: "dim",
	quotaLow: "green",
	quotaHigh: "yellow",
};

// UI-local copy synced from src/types/statusline-section-defaults.ts — keep in sync
export const DEFAULT_STATUSLINE_LINES: string[][] = [
	["model", "context", "quota"],
	["directory", "git", "cost", "changes"],
	["agents", "todos"],
];

export const DEFAULT_SECTION_CONFIG: Record<string, SectionConfig> = {
	model: { icon: "🤖" },
	quota: { icon: "⌛" },
	directory: { icon: "📁" },
	git: { icon: "🌿" },
	cost: { icon: "💰" },
	changes: { icon: "📝" },
	agents: { icon: "🔄" },
	todos: { icon: "✅" },
};

export const DEFAULT_STATUSLINE_LAYOUT: StatuslineBuilderLayout = {
	baseMode: "full",
	lines: DEFAULT_STATUSLINE_LINES,
	sectionConfig: DEFAULT_SECTION_CONFIG,
	theme: DEFAULT_STATUSLINE_THEME,
	responsiveBreakpoint: 0.85,
	maxAgentRows: 4,
	todoTruncation: 50,
};

// UI-local copy synced from src/types/statusline-section-defaults.ts — keep in sync
export const SECTION_LABELS: Record<StatuslineSectionId, string> = {
	model: "Model",
	context: "Context Window",
	quota: "Usage Quota",
	directory: "Directory",
	git: "Git Status",
	cost: "Cost",
	changes: "Changes",
	agents: "Agents",
	todos: "Tasks",
};

// UI-local copy synced from src/types/statusline-section-defaults.ts — keep in sync
export const SECTION_DESCRIPTIONS: Record<StatuslineSectionId, string> = {
	model: "AI model name and provider",
	context: "Context window usage bar",
	quota: "5-hour and weekly usage quota",
	directory: "Current working directory",
	git: "Git branch, staged/unstaged changes",
	cost: "Session cost estimate",
	changes: "Lines added and removed",
	agents: "Recent agent activity",
	todos: "Current task progress",
};

export const SECTION_MOCK_VALUES: Record<StatuslineSectionId, string> = {
	model: "claude-sonnet-4-6",
	context: "▓▓▓▓▓░░░░░ 52%",
	quota: "5h 31%  wk 33%",
	directory: "~/projects/myapp",
	git: "main ✓ +2 ~1",
	cost: "$0.042",
	changes: "+128 -34",
	agents: "planner researcher",
	todos: "[3/7] Implement auth",
};

/**
 * Shared ANSI color name → CSS hex map.
 * Used by both statusline-theme-picker (swatches) and statusline-terminal-preview (rendering).
 */
export const ANSI_COLOR_HEX_MAP: Record<string, string> = {
	// Standard
	green: "#4ade80",
	yellow: "#facc15",
	red: "#f87171",
	cyan: "#22d3ee",
	blue: "#60a5fa",
	magenta: "#e879f9",
	white: "#f1f5f9",
	dim: "#64748b",
	default: "#94a3b8",
	// Bright variants (supported by most modern terminals)
	brightGreen: "#86efac",
	brightYellow: "#fde68a",
	brightRed: "#fca5a5",
	brightCyan: "#67e8f9",
	brightBlue: "#93c5fd",
	brightMagenta: "#f0abfc",
	brightWhite: "#ffffff",
};

/** Per-section color map — distinct color for each section in a preset */
export type SectionColorMap = Record<string, string>;

/** Preset themes for the theme picker */
export interface ThemePreset {
	name: string;
	/** i18n translation key for the preset label */
	labelKey: string;
	theme: StatuslineTheme;
	/** Per-section colors applied when this preset is selected */
	sectionColors: SectionColorMap;
}

// Default per-section colors (used by Default preset and as fallback)
export const DEFAULT_SECTION_COLORS: SectionColorMap = {
	model: "cyan",
	directory: "blue",
	git: "magenta",
	cost: "dim",
	changes: "brightYellow",
	agents: "brightCyan",
	todos: "brightGreen",
};

export const THEME_PRESETS: ThemePreset[] = [
	{
		name: "Default",
		labelKey: "statuslinePresetDefault",
		theme: DEFAULT_STATUSLINE_THEME,
		sectionColors: DEFAULT_SECTION_COLORS,
	},
	{
		name: "Monochrome",
		labelKey: "statuslinePresetMonochrome",
		theme: {
			contextLow: "white",
			contextMid: "white",
			contextHigh: "white",
			accent: "white",
			muted: "dim",
			separator: "dim",
			quotaLow: "white",
			quotaHigh: "white",
		},
		sectionColors: {
			model: "white",
			directory: "white",
			git: "white",
			cost: "dim",
			changes: "white",
			agents: "white",
			todos: "white",
		},
	},
	{
		name: "Nord",
		labelKey: "statuslinePresetNord",
		theme: {
			contextLow: "brightCyan",
			contextMid: "blue",
			contextHigh: "magenta",
			accent: "brightCyan",
			muted: "dim",
			separator: "dim",
			quotaLow: "brightCyan",
			quotaHigh: "brightBlue",
		},
		sectionColors: {
			model: "brightCyan",
			directory: "brightBlue",
			git: "brightCyan",
			cost: "dim",
			changes: "brightYellow",
			agents: "blue",
			todos: "brightCyan",
		},
	},
	{
		name: "Dracula",
		labelKey: "statuslinePresetDracula",
		theme: {
			contextLow: "brightGreen",
			contextMid: "brightYellow",
			contextHigh: "brightRed",
			accent: "brightMagenta",
			muted: "dim",
			separator: "dim",
			quotaLow: "brightCyan",
			quotaHigh: "brightMagenta",
		},
		sectionColors: {
			model: "brightMagenta",
			directory: "brightCyan",
			git: "brightGreen",
			cost: "dim",
			changes: "brightYellow",
			agents: "brightMagenta",
			todos: "brightGreen",
		},
	},
	{
		name: "Catppuccin",
		labelKey: "statuslinePresetCatppuccin",
		theme: {
			contextLow: "brightGreen",
			contextMid: "brightYellow",
			contextHigh: "red",
			accent: "brightBlue",
			muted: "dim",
			separator: "dim",
			quotaLow: "brightBlue",
			quotaHigh: "brightMagenta",
		},
		sectionColors: {
			model: "brightBlue",
			directory: "brightYellow",
			git: "brightMagenta",
			cost: "dim",
			changes: "brightGreen",
			agents: "brightBlue",
			todos: "brightCyan",
		},
	},
	{
		name: "Gruvbox",
		labelKey: "statuslinePresetGruvbox",
		theme: {
			contextLow: "brightGreen",
			contextMid: "yellow",
			contextHigh: "red",
			accent: "brightYellow",
			muted: "dim",
			separator: "dim",
			quotaLow: "brightYellow",
			quotaHigh: "red",
		},
		sectionColors: {
			model: "brightYellow",
			directory: "brightGreen",
			git: "red",
			cost: "dim",
			changes: "yellow",
			agents: "brightYellow",
			todos: "brightGreen",
		},
	},
	{
		name: "Tokyo Night",
		labelKey: "statuslinePresetTokyoNight",
		theme: {
			contextLow: "cyan",
			contextMid: "brightBlue",
			contextHigh: "brightMagenta",
			accent: "brightBlue",
			muted: "dim",
			separator: "dim",
			quotaLow: "brightCyan",
			quotaHigh: "brightMagenta",
		},
		sectionColors: {
			model: "brightBlue",
			directory: "cyan",
			git: "brightMagenta",
			cost: "dim",
			changes: "brightCyan",
			agents: "brightBlue",
			todos: "brightGreen",
		},
	},
	{
		name: "Solarized",
		labelKey: "statuslinePresetSolarized",
		theme: {
			contextLow: "green",
			contextMid: "yellow",
			contextHigh: "red",
			accent: "blue",
			muted: "dim",
			separator: "dim",
			quotaLow: "cyan",
			quotaHigh: "yellow",
		},
		sectionColors: {
			model: "blue",
			directory: "cyan",
			git: "green",
			cost: "dim",
			changes: "yellow",
			agents: "blue",
			todos: "green",
		},
	},
	{
		name: "Rose Pine",
		labelKey: "statuslinePresetRosePine",
		theme: {
			contextLow: "brightGreen",
			contextMid: "brightYellow",
			contextHigh: "brightRed",
			accent: "magenta",
			muted: "dim",
			separator: "dim",
			quotaLow: "magenta",
			quotaHigh: "brightRed",
		},
		sectionColors: {
			model: "magenta",
			directory: "brightBlue",
			git: "brightMagenta",
			cost: "dim",
			changes: "brightYellow",
			agents: "magenta",
			todos: "brightGreen",
		},
	},
	{
		name: "One Dark",
		labelKey: "statuslinePresetOneDark",
		theme: {
			contextLow: "green",
			contextMid: "brightYellow",
			contextHigh: "brightRed",
			accent: "brightCyan",
			muted: "dim",
			separator: "dim",
			quotaLow: "brightCyan",
			quotaHigh: "brightRed",
		},
		sectionColors: {
			model: "brightCyan",
			directory: "blue",
			git: "brightRed",
			cost: "dim",
			changes: "brightYellow",
			agents: "brightCyan",
			todos: "green",
		},
	},
	{
		name: "Ayu",
		labelKey: "statuslinePresetAyu",
		theme: {
			contextLow: "brightGreen",
			contextMid: "brightYellow",
			contextHigh: "red",
			accent: "yellow",
			muted: "dim",
			separator: "white",
			quotaLow: "brightYellow",
			quotaHigh: "red",
		},
		sectionColors: {
			model: "yellow",
			directory: "brightCyan",
			git: "brightYellow",
			cost: "dim",
			changes: "brightGreen",
			agents: "yellow",
			todos: "brightGreen",
		},
	},
	{
		name: "Kanagawa",
		labelKey: "statuslinePresetKanagawa",
		theme: {
			contextLow: "cyan",
			contextMid: "brightYellow",
			contextHigh: "red",
			accent: "brightMagenta",
			muted: "dim",
			separator: "dim",
			quotaLow: "brightBlue",
			quotaHigh: "brightMagenta",
		},
		sectionColors: {
			model: "brightMagenta",
			directory: "cyan",
			git: "brightYellow",
			cost: "dim",
			changes: "brightBlue",
			agents: "brightMagenta",
			todos: "cyan",
		},
	},
	{
		name: "Stealth",
		labelKey: "statuslinePresetStealth",
		theme: {
			contextLow: "dim",
			contextMid: "dim",
			contextHigh: "brightRed",
			accent: "dim",
			muted: "dim",
			separator: "dim",
			quotaLow: "dim",
			quotaHigh: "brightRed",
		},
		sectionColors: {
			model: "dim",
			directory: "dim",
			git: "dim",
			cost: "dim",
			changes: "dim",
			agents: "dim",
			todos: "dim",
		},
	},
	{
		name: "Hacker",
		labelKey: "statuslinePresetHacker",
		theme: {
			contextLow: "green",
			contextMid: "brightGreen",
			contextHigh: "brightGreen",
			accent: "brightGreen",
			muted: "green",
			separator: "green",
			quotaLow: "green",
			quotaHigh: "brightGreen",
		},
		sectionColors: {
			model: "brightGreen",
			directory: "green",
			git: "brightGreen",
			cost: "green",
			changes: "brightGreen",
			agents: "green",
			todos: "brightGreen",
		},
	},
];
