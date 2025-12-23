export interface FieldDoc {
	path: string;
	type: string;
	default: string;
	validValues?: string[];
	description: string;
	effect?: string;
	example?: string;
}

export const CONFIG_FIELD_DOCS: Record<string, FieldDoc> = {
	codingLevel: {
		path: "codingLevel",
		type: "number",
		default: "-1",
		validValues: ["-1", "0", "1", "2", "3", "4", "5"],
		description:
			"Controls the communication style and depth of explanations based on user's coding experience level.",
		effect:
			"Loads corresponding output style and injects it into the session context. Changes how Claude explains code and structures responses.",
		example: '{\n  "codingLevel": 1\n}',
	},
	privacyBlock: {
		path: "privacyBlock",
		type: "boolean",
		default: "true",
		description:
			"Enables or disables the privacy protection hook that blocks access to sensitive files and domains.",
		effect:
			"When true, blocks reading files like .env, passwords, credentials, SSH keys, and API tokens.",
		example: '{\n  "privacyBlock": false\n}',
	},
	"plan.namingFormat": {
		path: "plan.namingFormat",
		type: "string",
		default: '"{date}-{issue}-{slug}"',
		description:
			"Template for naming plan directories. Uses placeholder tokens that get replaced at runtime.",
		effect:
			"{date} is replaced with formatted date, {issue} is extracted from branch, {slug} is for agent substitution.",
		example: '{\n  "plan": {\n    "namingFormat": "{date}-{slug}"\n  }\n}',
	},
	"plan.dateFormat": {
		path: "plan.dateFormat",
		type: "string",
		default: '"YYMMDD-HHmm"',
		description: "Date format string for {date} token in naming pattern.",
		example: '{\n  "plan": {\n    "dateFormat": "YYMMDD"\n  }\n}',
	},
	"plan.issuePrefix": {
		path: "plan.issuePrefix",
		type: "string | null",
		default: "null",
		description:
			"Prefix to prepend to extracted issue numbers in plan naming (e.g., 'GH-', 'JIRA-').",
		example: '{\n  "plan": {\n    "issuePrefix": "GH-"\n  }\n}',
	},
	"plan.reportsDir": {
		path: "plan.reportsDir",
		type: "string",
		default: '"reports"',
		description: "Subdirectory name within plan directory for storing reports.",
		example: '{\n  "plan": {\n    "reportsDir": "reports"\n  }\n}',
	},
	"plan.resolution.order": {
		path: "plan.resolution.order",
		type: "string[]",
		default: '["session", "branch"]',
		validValues: ["session", "branch"],
		description: "Order of resolution methods to try when finding the active plan.",
		example:
			'{\n  "plan": {\n    "resolution": {\n      "order": ["session", "branch"]\n    }\n  }\n}',
	},
	"plan.resolution.branchPattern": {
		path: "plan.resolution.branchPattern",
		type: "string (regex)",
		default: '"(?:feat|fix|chore|refactor|docs)/(?:[^/]+/)?(.+)"',
		description:
			"Regex pattern for extracting plan slug from git branch name. Capture group 1 is used as the slug.",
		example:
			'{\n  "plan": {\n    "resolution": {\n      "branchPattern": "(?:feat|fix)/(.+)"\n    }\n  }\n}',
	},
	"plan.validation.mode": {
		path: "plan.validation.mode",
		type: "string",
		default: '"prompt"',
		validValues: ["auto", "prompt", "off"],
		description: "Controls when plan validation interview runs.",
		example: '{\n  "plan": {\n    "validation": {\n      "mode": "auto"\n    }\n  }\n}',
	},
	"plan.validation.minQuestions": {
		path: "plan.validation.minQuestions",
		type: "number",
		default: "3",
		description: "Minimum number of validation questions to ask during plan review.",
		example: '{\n  "plan": {\n    "validation": {\n      "minQuestions": 5\n    }\n  }\n}',
	},
	"plan.validation.maxQuestions": {
		path: "plan.validation.maxQuestions",
		type: "number",
		default: "8",
		description: "Maximum number of validation questions to ask during plan review.",
		example: '{\n  "plan": {\n    "validation": {\n      "maxQuestions": 10\n    }\n  }\n}',
	},
	"plan.validation.focusAreas": {
		path: "plan.validation.focusAreas",
		type: "string[]",
		default: '["assumptions", "risks", "tradeoffs", "architecture"]',
		description: "Categories of questions to focus on during validation interview.",
		example:
			'{\n  "plan": {\n    "validation": {\n      "focusAreas": ["security", "performance"]\n    }\n  }\n}',
	},
	"paths.docs": {
		path: "paths.docs",
		type: "string",
		default: '"docs"',
		description: "Path to documentation directory (relative to project root or absolute).",
		example: '{\n  "paths": {\n    "docs": "docs"\n  }\n}',
	},
	"paths.plans": {
		path: "paths.plans",
		type: "string",
		default: '"plans"',
		description: "Path to plans directory (relative to project root or absolute).",
		example: '{\n  "paths": {\n    "plans": "plans"\n  }\n}',
	},
	"locale.thinkingLanguage": {
		path: "locale.thinkingLanguage",
		type: "string | null",
		default: "null",
		description: "Language for internal reasoning and logic. Recommended: 'en' for precision.",
		example: '{\n  "locale": {\n    "thinkingLanguage": "en"\n  }\n}',
	},
	"locale.responseLanguage": {
		path: "locale.responseLanguage",
		type: "string | null",
		default: "null",
		description: "Language for user-facing output (responses, explanations, comments).",
		example: '{\n  "locale": {\n    "responseLanguage": "fr"\n  }\n}',
	},
	"trust.enabled": {
		path: "trust.enabled",
		type: "boolean",
		default: "false",
		description: "Enables trusted execution mode. When enabled, bypasses certain security prompts.",
		example: '{\n  "trust": {\n    "enabled": true\n  }\n}',
	},
	"trust.passphrase": {
		path: "trust.passphrase",
		type: "string | null",
		default: "null",
		description: "Secret passphrase for testing context injection and trust verification.",
		example: '{\n  "trust": {\n    "passphrase": "super-secret-key"\n  }\n}',
	},
	"project.type": {
		path: "project.type",
		type: "string",
		default: '"auto"',
		validValues: ["auto", "single-repo", "monorepo", "library"],
		description: "Override automatic project type detection.",
		example: '{\n  "project": {\n    "type": "monorepo"\n  }\n}',
	},
	"project.packageManager": {
		path: "project.packageManager",
		type: "string",
		default: '"auto"',
		validValues: ["auto", "npm", "yarn", "pnpm", "bun"],
		description: "Override automatic package manager detection.",
		example: '{\n  "project": {\n    "packageManager": "pnpm"\n  }\n}',
	},
	"project.framework": {
		path: "project.framework",
		type: "string",
		default: '"auto"',
		validValues: [
			"auto",
			"next",
			"nuxt",
			"astro",
			"remix",
			"svelte",
			"vue",
			"react",
			"express",
			"fastify",
			"hono",
			"elysia",
		],
		description: "Override automatic framework detection.",
		example: '{\n  "project": {\n    "framework": "next"\n  }\n}',
	},
	assertions: {
		path: "assertions",
		type: "string[]",
		default: "[]",
		description: "List of user-defined assertions that are injected at the start of every session.",
		example: '{\n  "assertions": ["Use strict mode", "No console.logs"]\n}',
	},
};
