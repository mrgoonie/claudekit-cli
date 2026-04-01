/**
 * Default section registry for the statusline layout config.
 * Used when no statuslineLayout is configured in .ck.json (backward compat).
 * Also consumed by the dashboard UI drag-drop builder.
 */

import type { StatuslineSection, StatuslineSectionId } from "./ck-config.js";

// Default icons use emoji for terminal rendering. The dashboard UI displays these as-is.
// Terminal output respects the statuslineColors config for ANSI color support.
// Default sections in order (used when no statuslineLayout is configured)
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
