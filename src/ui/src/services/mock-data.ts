/**
 * Mock data for development mode when backend API is unavailable
 */

import { HealthStatus, KitType, type Project, type Session, type Skill } from "@/types";

export const mockProjects: Project[] = [
	{
		id: "proj-1",
		name: ".claude",
		path: "/home/kai/.claude",
		health: HealthStatus.HEALTHY,
		kitType: KitType.ENGINEER,
		model: "claude-sonnet-4",
		activeHooks: 5,
		mcpServers: 3,
		skills: ["skill-1", "skill-2", "skill-3"],
	},
	{
		id: "proj-2",
		name: "claudekit-cli",
		path: "/home/kai/claudekit/claudekit-cli",
		health: HealthStatus.WARNING,
		kitType: KitType.ENGINEER,
		model: "claude-sonnet-4",
		activeHooks: 3,
		mcpServers: 2,
		skills: ["skill-1", "skill-4"],
	},
];

export const mockSkills: Skill[] = [
	{
		id: "skill-1",
		name: "chrome-devtools",
		description: "Browser automation via Puppeteer scripts with persistent sessions",
		category: "automation",
		isAvailable: true,
	},
	{
		id: "skill-2",
		name: "ai-multimodal",
		description: "Process audio, images, videos using Google Gemini API",
		category: "ai",
		isAvailable: true,
	},
	{
		id: "skill-3",
		name: "frontend-design",
		description: "Create distinctive, production-grade frontend interfaces",
		category: "development",
		isAvailable: true,
	},
	{
		id: "skill-4",
		name: "backend-development",
		description: "Build robust backend systems with modern technologies",
		category: "development",
		isAvailable: true,
	},
	{
		id: "skill-5",
		name: "databases",
		description: "Work with MongoDB and PostgreSQL databases",
		category: "data",
		isAvailable: true,
	},
	{
		id: "skill-6",
		name: "devops",
		description: "Deploy and manage cloud infrastructure",
		category: "infrastructure",
		isAvailable: true,
	},
	{
		id: "skill-7",
		name: "ui-styling",
		description: "Create beautiful UIs with shadcn/ui and Tailwind CSS",
		category: "design",
		isAvailable: true,
	},
	{
		id: "skill-8",
		name: "sequential-thinking",
		description: "Apply structured problem-solving for complex tasks",
		category: "reasoning",
		isAvailable: true,
	},
	{
		id: "skill-9",
		name: "research",
		description: "Research and plan technical solutions",
		category: "planning",
		isAvailable: true,
	},
	{
		id: "skill-10",
		name: "debugging",
		description: "Systematic debugging framework for root cause analysis",
		category: "development",
		isAvailable: true,
	},
	{
		id: "skill-11",
		name: "payment-integration",
		description: "Implement payment integrations with SePay and Polar",
		category: "integration",
		isAvailable: true,
	},
	{
		id: "skill-12",
		name: "threejs",
		description: "Build immersive 3D web experiences with Three.js",
		category: "graphics",
		isAvailable: true,
	},
];

export const mockSessions: Record<string, Session[]> = {
	"proj-1": [
		{
			id: "sess-1",
			timestamp: "2024-12-22 23:45",
			duration: "45m",
			summary: "Implemented Settings section in Sidebar component",
		},
		{
			id: "sess-2",
			timestamp: "2024-12-22 22:30",
			duration: "1h 15m",
			summary: "Fixed config editor validation and added error handling",
		},
		{
			id: "sess-3",
			timestamp: "2024-12-22 20:00",
			duration: "2h",
			summary: "Refactored API service layer and added type safety",
		},
	],
	"proj-2": [
		{
			id: "sess-4",
			timestamp: "2024-12-22 18:00",
			duration: "30m",
			summary: "Updated CLI help documentation",
		},
	],
};

export const mockConfig = {
	global: {
		codingLevel: 1,
		privacyBlock: true,
		plan: {
			namingFormat: "{date}-{issue}-{slug}",
			dateFormat: "YYMMDD-HHmm",
			issuePrefix: "GH-",
			reportsDir: "reports",
		},
		locale: {
			thinkingLanguage: "en",
			responseLanguage: null,
		},
	},
	local: {
		project: {
			type: "auto",
			packageManager: "pnpm",
			framework: "react",
		},
	},
	merged: {
		codingLevel: 1,
		privacyBlock: true,
		plan: {
			namingFormat: "{date}-{issue}-{slug}",
			dateFormat: "YYMMDD-HHmm",
			issuePrefix: "GH-",
			reportsDir: "reports",
		},
		locale: {
			thinkingLanguage: "en",
			responseLanguage: null,
		},
		project: {
			type: "auto",
			packageManager: "pnpm",
			framework: "react",
		},
	},
};

export const mockSettings = {
	model: "claude-sonnet-4",
	hookCount: 5,
	mcpServerCount: 3,
	permissions: {},
};
