/**
 * Control Center Domain - Public API
 * Exports all control center functionality for the dashboard
 */

// Project management
export {
	type ManagedProject,
	type ProjectSuggestion,
	loadProjects,
	saveProjects,
	addProject,
	removeProject,
	getSuggestions,
	decodeProjectSlug,
	encodeProjectSlug,
} from "./project-manager.js";

// Skill reading
export {
	type SkillInfo,
	listSkills,
	parseSkillMd,
} from "./skill-reader.js";

// Session reading
export {
	type SessionInfo,
	getRecentSessions,
	findProjectDir,
} from "./session-reader.js";

// Action execution
export {
	type ActionResult,
	openTerminal,
	openEditor,
	launchClaude,
	executeCcsCommand,
} from "./action-executor.js";

// Health checking
export {
	type IssueSeverity,
	type HealthIssue,
	type VersionInfo,
	type HealthStatus,
	checkHealth,
} from "./health-checker.js";
