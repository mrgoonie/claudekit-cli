/**
 * SessionDetailPage — Level 3: read-only message timeline for one session.
 * Route: /sessions/:projectId/:sessionId
 * Read-only. No write/delete/export/copy operations.
 */
import type React from "react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSessionDetail } from "../hooks/use-sessions";
import type { SessionMessage } from "../hooks/use-sessions";
import { useI18n } from "../i18n";

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Collapsible tool call badge */
function ToolCallBadge({ name, result }: { name: string; result?: string }) {
	return (
		<details className="inline-block mt-1">
			<summary className="cursor-pointer text-[10px] font-semibold px-2 py-0.5 rounded bg-dash-surface-hover border border-dash-border text-dash-text-muted hover:text-dash-text transition-colors select-none">
				{name}
			</summary>
			{result && (
				<div className="mt-1 p-2 rounded bg-dash-surface border border-dash-border text-[10px] text-dash-text-muted font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
					{result}
				</div>
			)}
		</details>
	);
}

/** Role badge */
function RoleBadge({ role }: { role: string }) {
	const isUser = role === "user";
	return (
		<span
			className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
				isUser
					? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
					: "bg-dash-accent-subtle text-dash-accent"
			}`}
		>
			{role}
		</span>
	);
}

/** Single message row */
function MessageRow({ message }: { message: SessionMessage }) {
	const isUser = message.role === "user";
	return (
		<div
			className={`flex flex-col gap-1.5 p-3 rounded-lg border ${
				isUser
					? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30"
					: "bg-dash-surface border-dash-border"
			}`}
		>
			{/* Header row: role badge + timestamp */}
			<div className="flex items-center gap-2">
				<RoleBadge role={message.role} />
				{message.timestamp && (
					<span className="text-[10px] text-dash-text-muted">
						{new Date(message.timestamp).toLocaleTimeString()}
					</span>
				)}
			</div>

			{/* Content — render as plain text (markdown not available, keep simple) */}
			{message.content && (
				<p className="text-sm text-dash-text whitespace-pre-wrap break-words leading-relaxed">
					{message.content}
				</p>
			)}

			{/* Tool calls */}
			{message.toolCalls && message.toolCalls.length > 0 && (
				<div className="flex flex-wrap gap-1 mt-1">
					{message.toolCalls.map((tc, idx) => (
						<ToolCallBadge key={`${tc.name}-${idx}`} name={tc.name} result={tc.result} />
					))}
				</div>
			)}
		</div>
	);
}

/** Summary bar at top */
function SummaryBar({
	messageCount,
	toolCallCount,
	duration,
}: {
	messageCount: number;
	toolCallCount: number;
	duration?: string;
}) {
	const { t } = useI18n();
	return (
		<div className="flex items-center gap-4 px-3 py-2 rounded-lg bg-dash-surface border border-dash-border text-xs text-dash-text-muted">
			<span>
				<strong className="text-dash-text">{messageCount}</strong> {t("sessionMessages")}
			</span>
			<span>
				<strong className="text-dash-text">{toolCallCount}</strong> {t("sessionToolCalls")}
			</span>
			{duration && (
				<span>
					{t("sessionDuration")}: <strong className="text-dash-text">{duration}</strong>
				</span>
			)}
		</div>
	);
}

/** Pagination controls */
function PaginationBar({
	offset,
	limit,
	total,
	onPrev,
	onNext,
}: {
	offset: number;
	limit: number;
	total: number;
	onPrev: () => void;
	onNext: () => void;
}) {
	const start = offset + 1;
	const end = Math.min(offset + limit, total);
	const hasPrev = offset > 0;
	const hasNext = end < total;

	if (total <= limit) return null;

	return (
		<div className="flex items-center justify-between px-3 py-2 rounded-lg bg-dash-surface border border-dash-border text-xs text-dash-text-muted">
			<span>
				{start}–{end} / {total}
			</span>
			<div className="flex gap-2">
				<button
					type="button"
					onClick={onPrev}
					disabled={!hasPrev}
					className="px-2 py-1 rounded border border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
				>
					&larr;
				</button>
				<button
					type="button"
					onClick={onNext}
					disabled={!hasNext}
					className="px-2 py-1 rounded border border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
				>
					&rarr;
				</button>
			</div>
		</div>
	);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const MESSAGES_PER_PAGE = 50;

const SessionDetailPage: React.FC = () => {
	const { t } = useI18n();
	const navigate = useNavigate();
	const { projectId, sessionId } = useParams<{ projectId: string; sessionId: string }>();

	const [offset, setOffset] = useState(0);
	const { data, loading, error } = useSessionDetail(
		projectId,
		sessionId,
		MESSAGES_PER_PAGE,
		offset,
	);

	const total = data?.summary.messageCount ?? 0;

	return (
		<div className="flex flex-col h-full p-6 gap-4 max-w-3xl mx-auto w-full">
			{/* Header */}
			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={() => navigate(`/sessions/${encodeURIComponent(projectId ?? "")}`)}
					className="w-8 h-8 rounded-lg flex items-center justify-center text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors shrink-0"
					aria-label={t("sessionBack")}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						className="w-4 h-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M15 19l-7-7 7-7"
						/>
					</svg>
				</button>
				<div className="flex-1 min-w-0">
					<h1 className="text-xl font-bold text-dash-text">{t("sessionDetail")}</h1>
					<p className="text-[10px] text-dash-text-muted font-mono truncate">{sessionId}</p>
				</div>
				<span className="text-xs px-2 py-0.5 rounded bg-dash-accent-subtle text-dash-accent font-semibold shrink-0">
					{t("sessionReadOnly")}
				</span>
			</div>

			{/* Loading */}
			{loading && (
				<div className="flex flex-1 items-center justify-center text-dash-text-muted text-sm">
					{t("sessionLoading")}
				</div>
			)}

			{/* Error */}
			{!loading && error && (
				<div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-400 text-sm">
					{t("sessionError")}: {error}
				</div>
			)}

			{/* Empty */}
			{!loading && !error && data && data.messages.length === 0 && (
				<div className="flex flex-1 items-center justify-center text-dash-text-muted text-sm">
					{t("noSessionsData")}
				</div>
			)}

			{/* Content */}
			{!loading && !error && data && data.messages.length > 0 && (
				<>
					{/* Summary bar */}
					<SummaryBar
						messageCount={data.summary.messageCount}
						toolCallCount={data.summary.toolCallCount}
						duration={data.summary.duration}
					/>

					{/* Pagination (top) */}
					<PaginationBar
						offset={offset}
						limit={MESSAGES_PER_PAGE}
						total={total}
						onPrev={() => setOffset((o) => Math.max(0, o - MESSAGES_PER_PAGE))}
						onNext={() => setOffset((o) => o + MESSAGES_PER_PAGE)}
					/>

					{/* Message timeline */}
					<div className="flex flex-col gap-2 overflow-y-auto flex-1">
						{data.messages.map((msg, idx) => (
							<MessageRow key={`${msg.role}-${offset + idx}`} message={msg} />
						))}
					</div>

					{/* Pagination (bottom) */}
					<PaginationBar
						offset={offset}
						limit={MESSAGES_PER_PAGE}
						total={total}
						onPrev={() => setOffset((o) => Math.max(0, o - MESSAGES_PER_PAGE))}
						onNext={() => setOffset((o) => o + MESSAGES_PER_PAGE)}
					/>
				</>
			)}
		</div>
	);
};

export default SessionDetailPage;
