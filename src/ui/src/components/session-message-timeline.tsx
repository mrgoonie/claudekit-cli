/**
 * Session message timeline — renders conversation messages with markdown,
 * collapsible tool calls, and proper visual hierarchy.
 */
import type React from "react";
import { useState } from "react";
import type { SessionMessage } from "../hooks/use-sessions";
import { useI18n } from "../i18n";
import MarkdownRenderer from "./markdown-renderer";

// ─── Tool Call Card ──────────────────────────────────────────────────────────

function ToolCallCard({ name, input, result }: { name: string; input?: string; result?: string }) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const hasContent = Boolean(input || result);

	return (
		<div className="rounded-lg border border-dash-border bg-dash-bg/50 overflow-hidden">
			<button
				type="button"
				onClick={() => hasContent && setOpen(!open)}
				className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
					hasContent ? "cursor-pointer hover:bg-dash-surface-hover" : "cursor-default"
				}`}
			>
				{/* Chevron */}
				{hasContent && (
					<svg
						xmlns="http://www.w3.org/2000/svg"
						className={`w-3 h-3 text-dash-text-muted shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
					</svg>
				)}
				{/* Tool icon */}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					className="w-3.5 h-3.5 text-dash-accent shrink-0"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
					/>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					/>
				</svg>
				<span className="font-mono font-semibold text-dash-text">{name}</span>
				{result && !open && (
					<span className="text-dash-text-muted truncate ml-auto text-[10px]">
						{result.slice(0, 60)}
						{result.length > 60 ? "..." : ""}
					</span>
				)}
			</button>
			{open && (
				<div className="border-t border-dash-border">
					{input && (
						<div className="px-3 py-2 border-b border-dash-border/60">
							<p className="text-[10px] font-semibold text-dash-text-muted uppercase tracking-wider mb-1">
								{t("sessionToolInput")}
							</p>
							<pre className="text-[11px] font-mono text-dash-text-secondary whitespace-pre-wrap break-all max-h-48 overflow-y-auto bg-dash-surface rounded p-2">
								{input}
							</pre>
						</div>
					)}
					{result && (
						<div className="px-3 py-2">
							<p className="text-[10px] font-semibold text-dash-text-muted uppercase tracking-wider mb-1">
								{t("sessionToolResult")}
							</p>
							<pre className="text-[11px] font-mono text-dash-text-secondary whitespace-pre-wrap break-all max-h-64 overflow-y-auto bg-dash-surface rounded p-2">
								{result}
							</pre>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

// ─── Message Row ─────────────────────────────────────────────────────────────

function MessageRow({ message }: { message: SessionMessage }) {
	const { t } = useI18n();
	const isUser = message.role === "user";
	const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;

	return (
		<div
			className={`flex flex-col gap-2 p-4 rounded-lg border ${
				isUser
					? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200/60 dark:border-blue-800/40"
					: "bg-dash-surface border-dash-border"
			}`}
		>
			{/* Header: role + timestamp */}
			<div className="flex items-center gap-2">
				<span
					className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
						isUser
							? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
							: "bg-dash-accent-subtle text-dash-accent"
					}`}
				>
					{isUser ? t("sessionUser") : t("sessionAssistant")}
				</span>
				{message.timestamp && (
					<span className="text-[10px] text-dash-text-muted">
						{new Date(message.timestamp).toLocaleTimeString()}
					</span>
				)}
				{hasToolCalls && (
					<span className="text-[10px] text-dash-text-muted ml-auto">
						{message.toolCalls?.length} {t("sessionToolCalls")}
					</span>
				)}
			</div>

			{/* Content — markdown for assistant, plain for user */}
			{message.content ? (
				isUser ? (
					<p className="text-sm text-dash-text whitespace-pre-wrap break-words leading-relaxed">
						{message.content}
					</p>
				) : (
					<div className="text-sm">
						<MarkdownRenderer content={message.content} />
					</div>
				)
			) : (
				!hasToolCalls && (
					<p className="text-xs text-dash-text-muted italic">{t("sessionNoContent")}</p>
				)
			)}

			{/* Tool calls — collapsible cards */}
			{hasToolCalls && (
				<div className="flex flex-col gap-1.5 mt-1">
					{message.toolCalls?.map((tc, idx) => (
						<ToolCallCard
							key={`${tc.name}-${idx}`}
							name={tc.name}
							input={tc.input}
							result={tc.result}
						/>
					))}
				</div>
			)}
		</div>
	);
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export interface TimelineProps {
	messages: SessionMessage[];
}

/** Renders a vertical message timeline */
const SessionMessageTimeline: React.FC<TimelineProps> = ({ messages }) => {
	return (
		<div className="flex flex-col gap-2">
			{messages.map((msg, idx) => (
				<MessageRow key={msg.timestamp ?? `${msg.role}-${idx}`} message={msg} />
			))}
		</div>
	);
};

export default SessionMessageTimeline;
