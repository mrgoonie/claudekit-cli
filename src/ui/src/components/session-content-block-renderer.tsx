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

/** Detect skill invocation patterns in text and extract skill name */
function detectSkill(text: string): string | null {
	// Pattern: "<command-name>/skillname</command-name>" (skill invocation tags)
	const cmdName = text.match(/<command-name>\/?(.+?)<\/command-name>/);
	if (cmdName) return cmdName[1].trim();
	// Pattern: "### Skill: fix" or "### Skill: brainstorm"
	const skillHeader = text.match(/^###\s+Skill:\s+(.+?)$/m);
	if (skillHeader) return skillHeader[1].trim();
	// Pattern: "Base directory for this skill:" + "# SkillName"
	if (/Base directory for this skill:/i.test(text)) {
		const heading = text.match(/^#\s+(.+?)(?:\s*[-—]|$)/m);
		if (heading) return heading[1].trim();
	}
	return null;
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

/** Extract user prompt from a text block that contains skill invocation tags.
 *  Returns the <command-args> content (the user's actual prompt). */
function extractUserPrompt(text: string): string | null {
	const argsMatch = text.match(/<command-args>([\s\S]*?)<\/command-args>/);
	return argsMatch ? argsMatch[1].trim() : null;
}

/** Extract the skill definition content (everything after "Base directory for this skill:..." line) */
function extractSkillContent(text: string): string {
	const baseIdx = text.indexOf("Base directory for this skill:");
	if (baseIdx === -1) return cleanSkillText(text);
	// Skill content starts from "Base directory..." onward
	return cleanSkillText(text.slice(baseIdx));
}

// ─── Skill Block ─────────────────────────────────────────────────────────────

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

function SystemBlock({ text }: { text: string }) {
	const { t } = useI18n();
	// Check if system block also contains a skill invocation
	const skillName = detectSkill(text);
	if (skillName) return <SkillBlock name={skillName} text={text} />;

	return (
		<details className="rounded-lg border border-amber-500/20 bg-amber-500/5 overflow-hidden">
			<summary className="flex cursor-pointer select-none items-center gap-1.5 px-3 py-2 text-sm text-amber-400 hover:text-amber-300">
				<svg
					width="14"
					height="14"
					viewBox="0 0 16 16"
					fill="none"
					aria-hidden="true"
					className="shrink-0"
				>
					<circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
					<path
						d="M8 7v4.5M8 5.5v.5"
						stroke="currentColor"
						strokeWidth="1.4"
						strokeLinecap="round"
					/>
				</svg>
				<span>{t("sessionSystemContext")}</span>
			</summary>
			<div className="max-h-64 overflow-y-auto border-t border-amber-500/10 px-3 pb-3 pt-1">
				<MarkdownRenderer content={text} />
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
			// Detect skill invocations — split into visible prompt + collapsible skill
			const skillName = detectSkill(block.text);
			if (skillName) {
				const userPrompt = extractUserPrompt(block.text);
				const skillContent = extractSkillContent(block.text);
				return (
					<div className="flex flex-col gap-2">
						{userPrompt && (
							<p
								className="text-sm text-dash-text whitespace-pre-wrap break-words leading-relaxed"
								data-search-content
							>
								{userPrompt}
							</p>
						)}
						<SkillBlock name={skillName} text={skillContent} />
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
		case "tool_use":
			return (
				<SessionToolCallCard
					toolName={block.toolName ?? "Unknown"}
					toolInput={block.toolInput}
					result={block.result}
					isError={block.isError}
				/>
			);
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
