/**
 * SessionDetailPage — Level 3: read-only message timeline for one session.
 * Route: /sessions/:projectId/:sessionId
 * Read-only. No write/delete/export/copy operations.
 */
import type React from "react";
import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SessionMessageTimeline from "../components/session-message-timeline";
import SessionSearchBar from "../components/session-search-bar";
import { useSessionDetail } from "../hooks/use-sessions";
import { useI18n } from "../i18n";

const MESSAGES_PER_PAGE = 50;

/** Summary bar: message count, tool calls, duration */
function SummaryBar({
	messageCount,
	toolCallCount,
	duration,
}: { messageCount: number; toolCallCount: number; duration?: string }) {
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

/** Pagination: prev/next with range display */
function PaginationBar({
	offset,
	limit,
	total,
	onPrev,
	onNext,
}: { offset: number; limit: number; total: number; onPrev: () => void; onNext: () => void }) {
	const start = offset + 1;
	const end = Math.min(offset + limit, total);
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
					disabled={offset <= 0}
					className="px-2 py-1 rounded border border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
				>
					&larr;
				</button>
				<button
					type="button"
					onClick={onNext}
					disabled={end >= total}
					className="px-2 py-1 rounded border border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
				>
					&rarr;
				</button>
			</div>
		</div>
	);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const SessionDetailPage: React.FC = () => {
	const { t } = useI18n();
	const navigate = useNavigate();
	const { projectId, sessionId } = useParams<{ projectId: string; sessionId: string }>();
	const timelineRef = useRef<HTMLDivElement>(null);
	const [searchVisible, setSearchVisible] = useState(false);

	const [offset, setOffset] = useState(0);
	const { data, loading, error } = useSessionDetail(
		projectId,
		sessionId,
		MESSAGES_PER_PAGE,
		offset,
	);

	const total = data?.summary.messageCount ?? 0;
	const hasContent = !loading && !error && data && data.messages.length > 0;

	return (
		<div className="flex flex-col h-full p-6 gap-4 max-w-4xl mx-auto w-full">
			{/* Header */}
			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={() => navigate(`/project/${encodeURIComponent(projectId ?? "")}`)}
					className="w-8 h-8 rounded-lg flex items-center justify-center text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors shrink-0"
					aria-label={t("sessionBack")}
				>
					<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
				{/* Search toggle */}
				{hasContent && (
					<button
						type="button"
						onClick={() => setSearchVisible((v) => !v)}
						className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
							searchVisible
								? "bg-dash-accent/10 text-dash-accent"
								: "text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text"
						}`}
						aria-label="Search"
					>
						<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
					</button>
				)}
				<span className="text-xs px-2 py-0.5 rounded bg-dash-accent-subtle text-dash-accent font-semibold shrink-0">
					{t("sessionReadOnly")}
				</span>
			</div>

			{loading && (
				<div className="flex flex-1 items-center justify-center text-dash-text-muted text-sm">
					{t("sessionLoading")}
				</div>
			)}
			{!loading && error && (
				<div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-400 text-sm">
					{t("sessionError")}: {error}
				</div>
			)}
			{!loading && !error && data && data.messages.length === 0 && (
				<div className="flex flex-1 items-center justify-center text-dash-text-muted text-sm">
					{t("noSessionsData")}
				</div>
			)}

			{hasContent && (
				<>
					<SummaryBar
						messageCount={data.summary.messageCount}
						toolCallCount={data.summary.toolCallCount}
						duration={data.summary.duration}
					/>
					<SessionSearchBar containerRef={timelineRef} visible={searchVisible} />
					<PaginationBar
						offset={offset}
						limit={MESSAGES_PER_PAGE}
						total={total}
						onPrev={() => setOffset((o) => Math.max(0, o - MESSAGES_PER_PAGE))}
						onNext={() => setOffset((o) => o + MESSAGES_PER_PAGE)}
					/>
					<div ref={timelineRef} className="overflow-y-auto flex-1">
						<SessionMessageTimeline messages={data.messages} />
					</div>
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
