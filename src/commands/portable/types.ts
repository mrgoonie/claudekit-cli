/**
 * Shared types for portable items (agents, commands, skills)
 * Used across all three CLI commands: ck agents, ck commands, ck skills
 */
import { z } from "zod";

/** Type of portable item */
export type PortableType = "agent" | "command" | "skill" | "config" | "rules";

/** Supported coding agent/provider identifiers */
export const ProviderType = z.enum([
	"claude-code",
	"cursor",
	"codex",
	"opencode",
	"goose",
	"gemini-cli",
	"antigravity",
	"github-copilot",
	"amp",
	"kilo",
	"roo",
	"windsurf",
	"cline",
	"openhands",
]);
export type ProviderType = z.infer<typeof ProviderType>;

/** Conversion format used to transform source files */
export type ConversionFormat =
	| "direct-copy" // OpenCode, Codex commands
	| "fm-to-fm" // Copilot, Cursor, Codex agents
	| "fm-to-yaml" // Roo, Kilo
	| "fm-strip" // Windsurf, Goose, Gemini CLI, Amp, Antigravity
	| "fm-to-json" // Cline
	| "md-to-toml" // Gemini CLI commands
	| "skill-md" // OpenHands
	| "md-strip" // Config/rules: strip Claude-specific refs
	| "md-to-mdc"; // Config/rules: Cursor MDC format

/** Write strategy for target files */
export type WriteStrategy =
	| "per-file" // One output file per source file
	| "merge-single" // Merge all sources into one file (e.g., AGENTS.md)
	| "json-merge" // Merge into JSON config (Cline modes)
	| "yaml-merge" // Merge into YAML config (Roo/Kilo modes)
	| "single-file"; // Write single output file (config)

/** Provider path configuration for a specific portable type */
export interface ProviderPathConfig {
	projectPath: string | null; // Relative path for project-level install (null = unsupported)
	globalPath: string | null; // Absolute path for global install (null = unsupported)
	format: ConversionFormat;
	writeStrategy: WriteStrategy;
	fileExtension: string; // e.g., ".md", ".mdc", ".toml"
	charLimit?: number; // Max characters per file (e.g., Windsurf 6K)
	totalCharLimit?: number; // Max aggregate characters across all files of this type (e.g., Windsurf 12K)
	nestedCommands?: boolean; // false = flatten nested paths with "-" separator (default: true)
}

/** Provider's level of subagent/delegation support */
export type SubagentSupport = "full" | "partial" | "none" | "planned";

/** Full provider configuration */
export interface ProviderConfig {
	name: ProviderType;
	displayName: string;
	subagents: SubagentSupport;
	agents: ProviderPathConfig | null; // null = does not support agents
	commands: ProviderPathConfig | null; // null = does not support commands
	skills: ProviderPathConfig | null; // null = does not support skills
	config: ProviderPathConfig | null; // null = does not support config porting
	rules: ProviderPathConfig | null; // null = does not support rules porting
	detect: () => Promise<boolean>;
}

/** Parsed frontmatter data from a source file */
export interface ParsedFrontmatter {
	name?: string;
	description?: string;
	model?: string;
	tools?: string;
	memory?: string;
	argumentHint?: string;
	[key: string]: unknown;
}

/** Result of frontmatter parsing */
export interface FrontmatterParseResult {
	frontmatter: ParsedFrontmatter;
	body: string;
	warnings: string[];
}

/** A portable item (agent or command) discovered from source */
export interface PortableItem {
	name: string; // Identifier (from filename)
	displayName?: string; // From frontmatter name field
	description: string;
	type: PortableType;
	sourcePath: string; // Full path to source file
	frontmatter: ParsedFrontmatter;
	body: string; // Markdown body without frontmatter
	/** For nested commands: relative path segments (e.g., ["docs", "init"]) */
	segments?: string[];
}

/** Result of converting a portable item for a target provider */
export interface ConversionResult {
	content: string; // Converted file content
	filename: string; // Target filename (may differ from source)
	warnings: string[]; // Non-fatal warnings (e.g., truncation)
	error?: string; // Fatal conversion error (installer should treat as failure)
}

/** Result of installing a portable item to a provider */
export interface PortableInstallResult {
	provider: ProviderType;
	providerDisplayName: string;
	success: boolean;
	path: string;
	error?: string;
	overwritten?: boolean;
	skipped?: boolean;
	skipReason?: string;
	warnings?: string[];
}

/** Command options schema for ck agents / ck commands */
export const PortableCommandOptionsSchema = z.object({
	name: z.string().optional(),
	agent: z.array(z.string()).optional(),
	global: z.boolean().optional(),
	yes: z.boolean().optional(),
	list: z.boolean().optional(),
	installed: z.boolean().optional(),
	all: z.boolean().optional(),
	uninstall: z.boolean().optional(),
	force: z.boolean().optional(),
	sync: z.boolean().optional(),
});
export type PortableCommandOptions = z.infer<typeof PortableCommandOptionsSchema>;

/** Context for multi-phase install flow */
export interface PortableContext {
	options: PortableCommandOptions;
	type: PortableType;
	cancelled: boolean;
	selectedItems: PortableItem[];
	selectedProviders: ProviderType[];
	installGlobally: boolean;
	availableItems: PortableItem[];
	detectedProviders: ProviderType[];
}
