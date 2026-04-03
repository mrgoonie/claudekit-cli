/**
 * Default section registry for the statusline layout config.
 * Used when no statuslineLayout is configured in .ck.json (backward compat).
 * Also consumed by the dashboard UI drag-drop builder.
 */

import type { StatuslineSectionConfig, StatuslineSectionId } from "./ck-config.js";

// Default line layout — groups sections into terminal rows.
// Line 0: session info, Line 1: location + stats, Line 2: activity
export const DEFAULT_STATUSLINE_LINES: StatuslineSectionId[][] = [
	["model", "context", "quota"],
	["directory", "git", "cost", "changes"],
	["agents", "todos"],
];

// Default per-section icon overrides
export const DEFAULT_SECTION_CONFIG: Record<string, StatuslineSectionConfig> = {
	model: { icon: "🤖" },
	quota: { icon: "⌛" },
	directory: { icon: "📁" },
	git: { icon: "🌿" },
	cost: { icon: "💰" },
	changes: { icon: "📝" },
	agents: { icon: "🔄" },
	todos: { icon: "✅" },
};

// Human-readable labels for the dashboard UI
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

// Brief descriptions for the dashboard UI
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
