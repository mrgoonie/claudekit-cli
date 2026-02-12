/**
 * md-strip converter — Strips Claude Code-specific references from markdown content.
 * Used by 12 of 14 providers (all except Claude Code and Cursor).
 */
import { providers } from "../provider-registry.js";
import type { ConversionResult, PortableItem, ProviderType } from "../types.js";

/** Maximum content size for regex processing (500KB) */
const MAX_CONTENT_SIZE = 512_000;

/** Options for md-strip conversion */
export interface MdStripOptions {
	provider: ProviderType;
	charLimit?: number; // e.g., 6000 for Windsurf
}

/**
 * Strip Claude-specific references from markdown content
 */
export function stripClaudeRefs(
	content: string,
	options?: MdStripOptions,
): { content: string; warnings: string[]; removedSections: string[] } {
	const warnings: string[] = [];
	const removedSections: string[] = [];
	let result = content;

	// Guard against extremely large content that could cause regex performance issues
	if (content.length > MAX_CONTENT_SIZE) {
		warnings.push(`Content exceeds ${MAX_CONTENT_SIZE} chars; stripping skipped for safety`);
		return { content, warnings, removedSections: [] };
	}

	// Find all code blocks to preserve them during replacement
	const codeBlockRanges: Array<[number, number]> = [];
	for (const match of content.matchAll(/```[\s\S]*?```/g)) {
		if (match.index !== undefined) {
			codeBlockRanges.push([match.index, match.index + match[0].length]);
		}
	}

	// Helper to check if a position is inside a code block
	const isInCodeBlock = (pos: number): boolean => {
		return codeBlockRanges.some(([start, end]) => pos >= start && pos < end);
	};

	// 1. Replace tool name references (skip code blocks)
	const toolReplacements: Array<[RegExp, string]> = [
		[/\b(the\s+)?Read\s+tool\b/gi, "file reading"],
		[/\buse\s+Read\b/gi, "use file reading"],
		[/\b(the\s+)?Write\s+tool\b/gi, "file writing"],
		[/\buse\s+Write\b/gi, "use file writing"],
		[/\b(the\s+)?Edit\s+tool\b/gi, "file editing"],
		[/\buse\s+Edit\b/gi, "use file editing"],
		[/\b(the\s+)?Bash\s+tool\b/gi, "terminal/shell"],
		[/\buse\s+Bash\b/gi, "use terminal/shell"],
		[/\b(the\s+)?Grep\s+tool\b/gi, "code search"],
		[/\buse\s+Grep\b/gi, "use code search"],
		[/\b(the\s+)?Glob\s+tool\b/gi, "file search"],
		[/\buse\s+Glob\b/gi, "use file search"],
		[/\b(the\s+)?Task\s+tool\b/gi, "subtask delegation"],
		[/\buse\s+Task\b/gi, "use subtask delegation"],
		[/\bWebFetch\b/g, "web access"],
		[/\bWebSearch\b/g, "web access"],
		[/\bNotebookEdit\b/g, "notebook editing"],
	];

	for (const [regex, replacement] of toolReplacements) {
		result = result.replace(regex, (matched, ...args) => {
			// Get the match offset (last numeric argument before groups object)
			const offset = args[args.length - 2] as number;
			return isInCodeBlock(offset) ? matched : replacement;
		});
	}

	// 2. Remove slash command references (preserve URLs and paths)
	result = result.replace(/(?<!\w)(\/[a-z][a-z0-9/._:-]+)/g, (matched, ...args) => {
		const offset = args[args.length - 2] as number;
		if (isInCodeBlock(offset)) return matched;

		const slashCmd = matched;
		// Preserve URLs
		const beforeMatch = result.slice(Math.max(0, offset - 10), offset);
		if (/https?:\/\/$/.test(beforeMatch)) return slashCmd;

		// Preserve common file system paths
		if (
			slashCmd.startsWith("/api/") ||
			slashCmd.startsWith("/src/") ||
			slashCmd.startsWith("/home/") ||
			slashCmd.startsWith("/Users/") ||
			slashCmd.startsWith("/var/") ||
			slashCmd.startsWith("/etc/") ||
			slashCmd.startsWith("/opt/") ||
			slashCmd.startsWith("/tmp/")
		) {
			return slashCmd;
		}

		// Preserve paths with file extensions (e.g., /path/to/file.ts)
		if (/\.\w+$/.test(slashCmd)) {
			return slashCmd;
		}

		// Preserve paths with 3+ segments (likely a real path, not a slash command)
		if ((slashCmd.match(/\//g) || []).length >= 3) {
			return slashCmd;
		}

		// Remove slash command
		return "";
	});

	// 3. Replace Claude-specific path references (skip code blocks)
	const pathReplacements: Array<[RegExp, string]> = [
		[/\.claude\/rules\//gi, "project rules directory"],
		[/\.claude\/agents\//gi, "project agents directory"],
		[/\.claude\/commands\//gi, "project commands directory"],
		[/\.claude\/skills\//gi, "project skills directory"],
		[/\bCLAUDE\.md\b/g, "project configuration file"],
	];

	for (const [regex, replacement] of pathReplacements) {
		result = result.replace(regex, (matched, ...args) => {
			const offset = args[args.length - 2] as number;
			return isInCodeBlock(offset) ? matched : replacement;
		});
	}

	// Remove .claude/hooks/ references entirely
	result = result
		.split("\n")
		.filter((line) => !line.includes(".claude/hooks/"))
		.join("\n");

	// 4. Remove agent delegation patterns
	const delegationPatterns = [
		/^.*\bdelegate\s+to\s+`[^`]+`\s+agent.*$/gim,
		/^.*\bspawn.*agent.*$/gim,
		/^.*\buse.*subagent.*$/gim,
		/^.*\bactivate.*skill.*$/gim,
	];

	for (const pattern of delegationPatterns) {
		result = result.replace(pattern, "");
	}

	// 5. Remove Hook-related sections
	const lines = result.split("\n");
	const filteredLines: string[] = [];
	let skipUntilHeading = false;
	let skipHeadingLevel = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

		if (headingMatch) {
			const level = headingMatch[1].length;
			const title = headingMatch[2];

			// Check if this heading should trigger section removal
			if (
				/hook/i.test(title) ||
				/agent\s+team/i.test(title) ||
				/SendMessage|TaskCreate|TaskUpdate/i.test(title)
			) {
				skipUntilHeading = true;
				skipHeadingLevel = level;
				removedSections.push(title.trim());
				continue;
			}

			// If we're skipping, check if this heading ends the skip
			if (skipUntilHeading && level <= skipHeadingLevel) {
				skipUntilHeading = false;
			}
		}

		// Skip lines in removed sections or containing agent coordination tools
		if (skipUntilHeading || /SendMessage|TaskCreate|TaskUpdate/.test(line)) {
			continue;
		}

		filteredLines.push(line);
	}

	result = filteredLines.join("\n");

	// 6. Clean up
	// Remove consecutive blank lines (max 2)
	result = result.replace(/\n{3,}/g, "\n\n");
	// Trim trailing whitespace from each line
	result = result
		.split("\n")
		.map((line) => line.trimEnd())
		.join("\n");
	// Trim start and end
	result = result.trim();

	// 7. Handle char limit truncation
	if (options?.charLimit && result.length > options.charLimit) {
		result = result.slice(0, options.charLimit);
		warnings.push(`Content truncated to ${options.charLimit} characters for ${options.provider}`);
	}

	// 8. Check if all content was removed
	if (!result || result.length === 0) {
		warnings.push("All content was Claude-specific");
	}

	return { content: result, warnings, removedSections };
}

/**
 * Convert a portable item for a target provider using md-strip format
 */
export function convertMdStrip(item: PortableItem, provider: ProviderType): ConversionResult {
	const providerConfig = providers[provider];
	// Check config or rules path for charLimit
	const pathConfig = providerConfig.config ?? providerConfig.rules;
	const charLimit = pathConfig?.charLimit;

	const result = stripClaudeRefs(item.body, { provider, charLimit });

	return {
		content: result.content,
		filename: `${item.name}.md`,
		warnings: result.warnings,
	};
}
