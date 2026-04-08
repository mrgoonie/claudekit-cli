/**
 * Content block dispatcher — routes a typed ContentBlock to the appropriate
 * renderer sub-component. Consumed by session-message-timeline.tsx.
 *
 * Detects skill invocations in text blocks and renders them as labeled
 * collapsible panels instead of raw text dumps.
 */
import type React from "react";
import { useState } from "react";
import type { ContentBlock } from "../hooks/use-sessions";
import { useI18n } from "../i18n";
import MarkdownRenderer from "./markdown-renderer";
import SessionToolCallCard from "./session-tool-call-card";

// ─── Skill Detection ─────────────────────────────────────────────────────────

/** Detect ALL skill invocation patterns in text and extract skill names */
function detectSkills(text: string): string[] {
	const names: string[] = [];
	// Pattern 1: all "<command-name>/skillname</command-name>" tags (multiple invocations)
	for (const m of text.matchAll(/<command-name>\/?(.+?)<\/command-name>/g)) {
		names.push(m[1].trim());
	}
	// Pattern 2: "### Skill: fix" markdown headers
	for (const m of text.matchAll(/^###\s+Skill:\s+(.+?)$/gm)) {
		names.push(m[1].trim());
	}
	// Pattern 3: "Launching skill: cook" in command output
	for (const m of text.matchAll(/Launching skill:\s+(\S+)/g)) {
		names.push(m[1].trim());
	}
	// Pattern 4: "Base directory for this skill:" + "# SkillName" (one per block)
	if (/Base directory for this skill:/i.test(text)) {
		const heading = text.match(/^#\s+(.+?)(?:\s*[-—]|$)/m);
		if (heading) names.push(heading[1].trim());
	}
	// Deduplicate (case-insensitive), preserve first occurrence
	const seen = new Set<string>();
	return names.filter((n) => {
		const key = n.toLowerCase();
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/** Strip <command-*> tags and "Base directory" lines from skill text for cleaner display */
function cleanSkillText(text: string): string {
	return text
		.replace(/<command-message>[\s\S]*?<\/command-message>\s*/g, "")
		.replace(/<command-name>[\s\S]*?<\/command-name>\s*/g, "")
		.replace(/<command-args>[\s\S]*?<\/command-args>\s*/g, "")
		.replace(/^Base directory for this skill:.*$/gm, "")
		.replace(/^<!--.*?-->\s*$/gm, "")
		.replace(/^\n+/, "")
		.trim();
}

/**
 * Split a text block containing skill invocation into [userPrompt, skillContent].
 * The user prompt is extracted from <command-args> tags.
 * The skill content is everything from "Base directory for this skill:" onward (cleaned).
 * Returns [prompt | null, skillContent].
 */
function splitSkillText(text: string): [string | null, string] {
	// Extract the user's actual prompt from <command-args>
	const argsMatch = text.match(/<command-args>([\s\S]*?)<\/command-args>/);
	const prompt = argsMatch ? argsMatch[1].trim() : null;
	// Skill definition starts at "Base directory" line
	const baseIdx = text.indexOf("Base directory for this skill:");
	const skillRaw = baseIdx !== -1 ? text.slice(baseIdx) : text;
	return [prompt, cleanSkillText(skillRaw)];
}

/** Try to extract skill name from Skill tool_use input JSON string */
function parseSkillFromToolInput(toolInput?: string): string | null {
	if (!toolInput) return null;
	try {
		const parsed = JSON.parse(toolInput);
		return typeof parsed.skill === "string" ? parsed.skill : null;
	} catch {
		return null;
	}
}

// ─── Skill Badge (inline chip) ───────────────────────────────────────────────

function SkillBadge({ name }: { name: string }) {
	return (
		<span className="inline-flex items-center gap-1 px-2 py-0.5 mr-2 rounded border border-pink-500/30 bg-pink-500/10 text-pink-600 dark:text-pink-400 text-xs font-semibold align-middle">
			<svg
				width="12"
				height="12"
				viewBox="0 0 16 16"
				fill="none"
				aria-hidden="true"
				className="shrink-0"
			>
				<path
					d="M8.5 1.5L3 9h4.5l-1 5.5L13 7H8.5l1-5.5z"
					stroke="currentColor"
					strokeWidth="1.2"
					strokeLinejoin="round"
				/>
			</svg>
			Skill: {name}
		</span>
	);
}

// ─── Skill Block (collapsible detail) ────────────────────────────────────────

function SkillBlock({ name, text }: { name: string; text: string }) {
	const lineCount = text.split("\n").length;

	return (
		<details className="rounded-lg border border-pink-500/20 bg-pink-500/5 dark:bg-pink-500/5 overflow-hidden">
			<summary className="flex cursor-pointer select-none items-center gap-1.5 px-3 py-2 text-sm text-pink-600 dark:text-pink-400 hover:text-pink-500 dark:hover:text-pink-300">
				<svg
					width="14"
					height="14"
					viewBox="0 0 16 16"
					fill="none"
					aria-hidden="true"
					className="shrink-0"
				>
					<path
						d="M8.5 1.5L3 9h4.5l-1 5.5L13 7H8.5l1-5.5z"
						stroke="currentColor"
						strokeWidth="1.2"
						strokeLinejoin="round"
					/>
				</svg>
				<span className="font-semibold">Skill:</span>
				<span className="font-mono">{name}</span>
				<span className="ml-auto shrink-0 text-[10px] text-pink-500/50 dark:text-pink-400/40">
					{lineCount} lines
				</span>
			</summary>
			<div className="max-h-64 overflow-y-auto border-t border-pink-500/10 px-3 pb-3 pt-2">
				<MarkdownRenderer content={text} />
			</div>
		</details>
	);
}

// ─── Thinking block ──────────────────────────────────────────────────────────

function ThinkingBlock({ text }: { text: string }) {
	const { t } = useI18n();
	return (
		<details className="rounded-lg border border-dash-border bg-dash-bg/50">
			<summary className="flex cursor-pointer select-none items-center gap-1.5 px-3 py-2 text-sm text-dash-text-muted hover:text-dash-text">
				<svg
					width="14"
					height="14"
					viewBox="0 0 16 16"
					fill="none"
					aria-hidden="true"
					className="shrink-0 opacity-60"
				>
					<path
						d="M8 2C5.8 2 4 3.8 4 6c0 .8.2 1.5.6 2.1C3.6 8.6 3 9.7 3 11c0 1.7 1.1 3 2.5 3H8h2.5c1.4 0 2.5-1.3 2.5-3 0-1.3-.6-2.4-1.6-2.9.4-.6.6-1.3.6-2.1 0-2.2-1.8-4-4-4z"
						fill="currentColor"
						opacity="0.5"
					/>
				</svg>
				<span>{t("sessionThinking")}</span>
			</summary>
			<pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words px-3 pb-3 pt-1 text-sm text-dash-text-muted">
				{text}
			</pre>
		</details>
	);
}

// ─── System block ────────────────────────────────────────────────────────────

/** Split system block text on "### Skill:" headers into individual skill entries */
function extractSkillsFromSystem(text: string): Array<{ name: string; content: string }> {
	const parts = text.split(/^###\s+Skill:\s+/m);
	if (parts.length <= 1) return [];
	// First part is preamble (before first skill), skip it
	return parts.slice(1).map((part) => {
		const newline = part.indexOf("\n");
		const name = newline !== -1 ? part.slice(0, newline).trim() : part.trim();
		const content = newline !== -1 ? cleanSkillText(part.slice(newline + 1)) : "";
		return { name, content };
	});
}

/** Parse [tag-name] prefix from system block text */
function parseSystemTag(text: string): { tag: string; content: string } {
	const match = text.match(/^\[([a-z-]+)\]\n([\s\S]*)$/);
	if (match) return { tag: match[1], content: match[2] };
	return { tag: "", content: text };
}

/** Map system tag names to display labels */
const SYSTEM_TAG_LABELS: Record<string, string> = {
	"task-notification": "Task Notification",
	"system-reminder": "System Context",
	"local-command-stdout": "Command Output",
	"local-command-caveat": "Command Note",
	"antml:thinking": "Thinking",
};

function SystemBlock({ text }: { text: string }) {
	const { t } = useI18n();
	const { tag, content } = parseSystemTag(text);

	// Skill definitions inside system blocks (### Skill: headers)
	const skills = extractSkillsFromSystem(content);
	if (skills.length > 0) {
		return (
			<div className="flex flex-col gap-1.5">
				{skills.map((s) => (
					<SkillBlock key={s.name} name={s.name} text={s.content} />
				))}
			</div>
		);
	}

	// "Launching skill: X" in command output — render as minimal skill badge
	if (tag === "local-command-stdout") {
		const launchMatch = content.match(/Launching skill:\s+(\S+)/);
		if (launchMatch) {
			return (
				<div className="flex items-center gap-1.5 px-2 py-1 text-xs text-pink-500/70 dark:text-pink-400/60">
					<svg
						width="10"
						height="10"
						viewBox="0 0 16 16"
						fill="none"
						aria-hidden="true"
						className="shrink-0"
					>
						<path
							d="M8.5 1.5L3 9h4.5l-1 5.5L13 7H8.5l1-5.5z"
							stroke="currentColor"
							strokeWidth="1.2"
							strokeLinejoin="round"
						/>
					</svg>
					<span>
						Launching skill: <span className="font-mono font-semibold">{launchMatch[1]}</span>
					</span>
				</div>
			);
		}
	}

	const label = SYSTEM_TAG_LABELS[tag] || t("sessionSystemContext");

	return (
		<details className="rounded-lg border border-dash-border/60 bg-dash-bg/30 overflow-hidden">
			<summary className="flex cursor-pointer select-none items-center gap-1.5 px-3 py-1.5 text-xs text-dash-text-muted hover:text-dash-text">
				<svg
					width="12"
					height="12"
					viewBox="0 0 16 16"
					fill="none"
					aria-hidden="true"
					className="shrink-0 opacity-50"
				>
					<circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
					<path
						d="M8 7v4.5M8 5.5v.5"
						stroke="currentColor"
						strokeWidth="1.4"
						strokeLinecap="round"
					/>
				</svg>
				<span>{label}</span>
			</summary>
			<div className="max-h-48 overflow-y-auto border-t border-dash-border/40 px-3 pb-2 pt-1">
				<pre className="text-[11px] text-dash-text-muted whitespace-pre-wrap break-words font-mono">
					{content}
				</pre>
			</div>
		</details>
	);
}

// ─── Long text block ─────────────────────────────────────────────────────────

const COLLAPSE_LINE_THRESHOLD = 20;

function CollapsibleTextBlock({ text }: { text: string }) {
	const [expanded, setExpanded] = useState(false);
	const lines = text.split("\n");
	const preview = lines.slice(0, 6).join("\n");
	return (
		<div data-search-content>
			<MarkdownRenderer content={expanded ? text : preview} />
			{!expanded && (
				<div className="mt-1 text-[10px] text-dash-text-muted">
					...{lines.length - 6} more lines
				</div>
			)}
			<button
				type="button"
				onClick={() => setExpanded((v) => !v)}
				className="mt-1 text-[11px] font-semibold text-dash-accent hover:text-dash-accent-hover transition-colors"
			>
				{expanded ? "Collapse" : "Expand all"}
			</button>
		</div>
	);
}

// ─── Main dispatcher ─────────────────────────────────────────────────────────

export interface ContentBlockRendererProps {
	block: ContentBlock;
	role?: string;
}

const ContentBlockRenderer: React.FC<ContentBlockRendererProps> = ({ block }) => {
	switch (block.type) {
		case "text": {
			if (!block.text) return null;
			// Detect skill invocations — inline badges + prompt, then collapsible detail below
			const skills = detectSkills(block.text);
			if (skills.length > 0) {
				const [userPrompt, skillContent] = splitSkillText(block.text);
				// No user prompt → just show collapsible skill block(s) (injected skill context)
				if (!userPrompt) {
					return skillContent ? (
						<div className="flex flex-col gap-1.5">
							{skills.map((name) => (
								<SkillBlock key={name} name={name} text={skillContent} />
							))}
						</div>
					) : null;
				}
				// Has prompt → inline badges for ALL skills + prompt text, then collapsible detail
				return (
					<div className="flex flex-col gap-2">
						<p className="text-sm text-dash-text leading-relaxed" data-search-content>
							{skills.map((name) => (
								<SkillBadge key={name} name={name} />
							))}
							<span className="whitespace-pre-wrap break-words">{userPrompt}</span>
						</p>
						{skillContent && <SkillBlock name={skills[0]} text={skillContent} />}
					</div>
				);
			}
			// Long non-skill text — collapsible with preview
			if (block.text.split("\n").length > COLLAPSE_LINE_THRESHOLD) {
				return <CollapsibleTextBlock text={block.text} />;
			}
			return (
				<div data-search-content>
					<MarkdownRenderer content={block.text} />
				</div>
			);
		}
		case "thinking":
			if (!block.text) return null;
			return <ThinkingBlock text={block.text} />;
		case "tool_use": {
			// Skill tool calls get enhanced display with skill name in header
			const skillName =
				block.toolName === "Skill" ? parseSkillFromToolInput(block.toolInput) : null;
			return (
				<SessionToolCallCard
					toolName={block.toolName ?? "Unknown"}
					toolInput={block.toolInput}
					result={block.result}
					isError={block.isError}
					skillName={skillName ?? undefined}
				/>
			);
		}
		case "system":
			if (!block.text) return null;
			return <SystemBlock text={block.text} />;
		case "tool_result":
			return null;
		default:
			return null;
	}
};

export default ContentBlockRenderer;
