import { HealthStatus, KitType, type Project, type Session, type Skill } from "../types";

export const MOCK_SKILLS: Skill[] = [
	{
		id: "1",
		name: "frontend-design",
		description: "Expert UI/UX design with Tailwind and React patterns.",
		category: "Development",
		isAvailable: true,
	},
	{
		id: "2",
		name: "debugging",
		description: "Deep trace analysis and automated bug detection.",
		category: "Development",
		isAvailable: true,
	},
	{
		id: "3",
		name: "ai-multimodal",
		description: "Integration with vision and audio processing models.",
		category: "AI",
		isAvailable: true,
	},
	{
		id: "4",
		name: "research",
		description: "Scientific paper summarization and web browsing.",
		category: "Analysis",
		isAvailable: true,
	},
	{
		id: "5",
		name: "database-optimization",
		description: "SQL query tuning and indexing strategies.",
		category: "Development",
		isAvailable: false,
	},
	{
		id: "6",
		name: "security-audit",
		description: "OWASP vulnerability scanning and dependency checks.",
		category: "DevOps",
		isAvailable: true,
	},
];

export const MOCK_SESSIONS: Session[] = [
	{
		id: "s1",
		timestamp: "Today 14:32",
		duration: "2h 15min",
		summary: "Implemented authentication flow using JWT and cookies.",
	},
	{
		id: "s2",
		timestamp: "Today 09:15",
		duration: "45min",
		summary: "Fixed database connection leak in the reporting microservice.",
	},
	{
		id: "s3",
		timestamp: "Dec 21 18:20",
		duration: "1h 30min",
		summary: "Added dashboard visualization for token usage metrics.",
	},
	{
		id: "s4",
		timestamp: "Dec 20 11:05",
		duration: "3h 10min",
		summary: "Refactored the entire project navigator logic for better performance.",
	},
];

export const MOCK_PROJECTS: Project[] = [
	{
		id: "p1",
		name: "ClaudeKit UI",
		path: "~/projects/claude-kit-ui",
		health: HealthStatus.HEALTHY,
		kitType: KitType.ENGINEER,
		model: "gemini-3-pro-preview",
		activeHooks: 5,
		mcpServers: 3,
		skills: ["1", "2", "3"],
	},
	{
		id: "p2",
		name: "Backend API",
		path: "~/work/api-server",
		health: HealthStatus.WARNING,
		kitType: KitType.ARCHITECT,
		model: "gemini-3-flash-preview",
		activeHooks: 2,
		mcpServers: 1,
		skills: ["2", "6"],
	},
	{
		id: "p3",
		name: "Data Processor",
		path: "~/research/data-engine",
		health: HealthStatus.ERROR,
		kitType: KitType.RESEARCHER,
		model: "gemini-3-flash-preview",
		activeHooks: 8,
		mcpServers: 4,
		skills: ["4"],
	},
	{
		id: "p4",
		name: "Mobile App",
		path: "~/dev/native-app",
		health: HealthStatus.HEALTHY,
		kitType: KitType.ENGINEER,
		model: "gemini-3-pro-preview",
		activeHooks: 3,
		mcpServers: 2,
		skills: ["1", "2"],
	},
];
