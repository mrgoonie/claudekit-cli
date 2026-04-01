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

export type StatuslineMode = "full" | "compact" | "minimal" | "none";

export interface StatuslineSection {
	id: StatuslineSectionId;
	enabled: boolean;
	order: number;
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
}

export interface StatuslineLayout {
	baseMode: StatuslineMode;
	sections?: StatuslineSection[];
	theme?: StatuslineTheme;
	responsiveBreakpoint: number;
	maxAgentRows: number;
	todoTruncation: number;
}

// UI-local copy synced from src/types/statusline-section-defaults.ts — keep in sync
export const DEFAULT_STATUSLINE_SECTIONS: StatuslineSection[] = [
	{ id: "model", enabled: true, order: 0, icon: "🤖" },
	{ id: "context", enabled: true, order: 1 },
	{ id: "quota", enabled: true, order: 2, icon: "⌛" },
	{ id: "directory", enabled: true, order: 3, icon: "📁" },
	{ id: "git", enabled: true, order: 4, icon: "🌿" },
	{ id: "cost", enabled: true, order: 5, icon: "💰" },
	{ id: "changes", enabled: true, order: 6, icon: "📝" },
	{ id: "agents", enabled: true, order: 7, icon: "🔄" },
	{ id: "todos", enabled: true, order: 8, icon: "✅" },
];

export const DEFAULT_STATUSLINE_THEME: StatuslineTheme = {
	contextLow: "green",
	contextMid: "yellow",
	contextHigh: "red",
	accent: "cyan",
	muted: "dim",
	separator: "dim",
};

export const DEFAULT_STATUSLINE_LAYOUT: StatuslineLayout = {
	baseMode: "full",
	sections: DEFAULT_STATUSLINE_SECTIONS,
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
	model: "claude-sonnet-4-5",
	context: "▓▓▓▓▓░░░░░ 52%",
	quota: "3.1h / 5h | 12.4h / wk",
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
	green: "#4ade80",
	yellow: "#facc15",
	red: "#f87171",
	cyan: "#22d3ee",
	blue: "#60a5fa",
	magenta: "#e879f9",
	white: "#f1f5f9",
	dim: "#64748b",
	default: "#94a3b8",
};

/** Preset themes for the theme picker */
export interface ThemePreset {
	name: string;
	/** i18n translation key for the preset label */
	labelKey: string;
	theme: StatuslineTheme;
}

export const THEME_PRESETS: ThemePreset[] = [
	{
		name: "Default",
		labelKey: "statuslinePresetDefault",
		theme: DEFAULT_STATUSLINE_THEME,
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
		},
	},
	{
		name: "Nord",
		labelKey: "statuslinePresetNord",
		theme: {
			contextLow: "cyan",
			contextMid: "blue",
			contextHigh: "magenta",
			accent: "cyan",
			muted: "dim",
			separator: "dim",
		},
	},
];
