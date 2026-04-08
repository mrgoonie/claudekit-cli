/**
 * Content block dispatcher — routes a typed ContentBlock to the appropriate
 * renderer sub-component. Consumed by session-message-timeline.tsx.
 */
import type React from "react";
import type { ContentBlock } from "../hooks/use-sessions";
import { useI18n } from "../i18n";
import MarkdownRenderer from "./markdown-renderer";
import SessionToolCallCard from "./session-tool-call-card";

// ─── Thinking block ───────────────────────────────────────────────────────────

function ThinkingBlock({ text }: { text: string }) {
	const { t } = useI18n();
	return (
		<details className="rounded-lg border border-dash-border bg-dash-bg/50">
			<summary className="flex cursor-pointer select-none items-center gap-1.5 px-3 py-2 text-sm text-dash-text-muted hover:text-dash-text">
				{/* Brain SVG */}
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

// ─── System block ─────────────────────────────────────────────────────────────

function SystemBlock({ text }: { text: string }) {
	const { t } = useI18n();
	return (
		<details className="rounded-lg border border-amber-500/20 bg-amber-500/5 overflow-hidden">
			<summary className="flex cursor-pointer select-none items-center gap-1.5 px-3 py-2 text-sm text-amber-400 hover:text-amber-300">
				{/* Info SVG */}
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
			<div className="px-3 pb-3 pt-1">
				<MarkdownRenderer content={text} />
			</div>
		</details>
	);
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export interface ContentBlockRendererProps {
	block: ContentBlock;
	/** Role passed from parent timeline — reserved for future role-based styling. */
	role?: string;
}

/** Dispatches a ContentBlock to the appropriate renderer. */
const ContentBlockRenderer: React.FC<ContentBlockRendererProps> = ({ block }) => {
	switch (block.type) {
		case "text":
			if (!block.text) return null;
			return (
				<div data-search-content>
					<MarkdownRenderer content={block.text} />
				</div>
			);

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
			// Results are already attached to their tool_use blocks — skip.
			return null;

		default:
			return null;
	}
};

export default ContentBlockRenderer;
