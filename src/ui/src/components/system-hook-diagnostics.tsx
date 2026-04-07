/**
 * SystemHookDiagnostics — per-event-type hook execution diagnostics panel.
 *
 * Shows a table of hook event types (PreToolUse, PostToolUse, etc.) with:
 * - execution count, average latency, failure rate, last run timestamp
 * - amber warning when avg latency exceeds 500 ms
 * - collapsible last-N executions log per event type
 *
 * Data source: GET /api/system/hook-diagnostics (existing endpoint)
 */
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import {
	type HookDiagnosticsEntry,
	type HookDiagnosticsResponse,
	fetchHookDiagnostics,
} from "../services/api";

const LATENCY_WARN_MS = 500;
const MAX_RECENT_LOG = 10;

/** Groups entries by their hook field (event type). */
function groupByHook(entries: HookDiagnosticsEntry[]): Map<string, HookDiagnosticsEntry[]> {
	const map = new Map<string, HookDiagnosticsEntry[]>();
	for (const entry of entries) {
		const key = entry.hook || "unknown";
		const list = map.get(key) ?? [];
		list.push(entry);
		map.set(key, list);
	}
	return map;
}

function calcAvgLatency(entries: HookDiagnosticsEntry[]): number | null {
	const withDur = entries.filter((e) => typeof e.dur === "number");
	if (withDur.length === 0) return null;
	const sum = withDur.reduce((acc, e) => acc + (e.dur ?? 0), 0);
	return sum / withDur.length;
}

function calcFailureRate(entries: HookDiagnosticsEntry[]): number {
	if (entries.length === 0) return 0;
	const failures = entries.filter((e) => e.status === "error" || e.status === "crash").length;
	return (failures / entries.length) * 100;
}

function formatLatency(ms: number | null): string {
	if (ms === null) return "—";
	if (ms < 1000) return `${Math.round(ms)}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

function formatTs(ts: string | undefined, fallback: string): string {
	if (!ts) return fallback;
	try {
		return new Intl.DateTimeFormat(undefined, {
			month: "short",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		}).format(new Date(ts));
	} catch {
		return ts;
	}
}

interface HookRowProps {
	hookName: string;
	entries: HookDiagnosticsEntry[];
	expanded: boolean;
	onToggle: () => void;
}

const HookRow: React.FC<HookRowProps> = ({ hookName, entries, expanded, onToggle }) => {
	const { t } = useI18n();
	const avgLatency = calcAvgLatency(entries);
	const failureRate = calcFailureRate(entries);
	const lastEntry = entries.length > 0 ? entries[entries.length - 1] : undefined;
	const isLatencyWarn = avgLatency !== null && avgLatency > LATENCY_WARN_MS;
	const recent = entries.slice(-MAX_RECENT_LOG).reverse();

	return (
		<div className="rounded-lg border border-dash-border bg-dash-bg/60">
			{/* Row header — clickable to expand */}
			<button
				type="button"
				onClick={onToggle}
				className="w-full text-left px-3 py-2.5 grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center hover:bg-dash-surface-hover transition-colors rounded-lg"
				aria-expanded={expanded}
			>
				<span className="text-xs font-semibold text-dash-text truncate">{hookName}</span>

				{/* Executions */}
				<span className="mono text-xs text-dash-text-secondary text-right">{entries.length}</span>

				{/* Avg latency — warn if > 500ms */}
				<span
					className={`mono text-xs text-right flex items-center gap-1 ${
						isLatencyWarn ? "text-amber-400" : "text-dash-text-secondary"
					}`}
				>
					{isLatencyWarn && (
						<span
							className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"
							title={t("hookLatencyWarning")}
						/>
					)}
					{formatLatency(avgLatency)}
				</span>

				{/* Failure rate */}
				<span
					className={`mono text-xs text-right ${
						failureRate > 0 ? "text-red-400" : "text-dash-text-secondary"
					}`}
				>
					{failureRate.toFixed(0)}%
				</span>

				{/* Last run */}
				<span className="text-[11px] text-dash-text-muted text-right whitespace-nowrap">
					{formatTs(lastEntry?.ts, "—")}
				</span>
			</button>

			{/* Expanded log */}
			{expanded && (
				<div className="px-3 pb-3 space-y-1.5 border-t border-dash-border/60 pt-2.5">
					{recent.map((entry, i) => (
						<div
							key={`${entry.ts}-${i}`}
							className="rounded border border-dash-border/50 bg-dash-surface/40 px-2.5 py-1.5 text-xs"
						>
							<div className="flex flex-wrap items-center gap-2">
								<span className="mono text-dash-text-muted">
									{formatTs(entry.ts, t("hookDiagnosticsUnknown"))}
								</span>
								<StatusBadge status={entry.status} />
								{entry.event && <span className="text-dash-text-secondary">{entry.event}</span>}
								{entry.tool && (
									<span className="text-dash-text-muted">
										{t("hookDiagnosticsToolLabel")}: {entry.tool}
									</span>
								)}
								{typeof entry.dur === "number" && (
									<span
										className={`mono ${entry.dur > LATENCY_WARN_MS ? "text-amber-400" : "text-dash-text-muted"}`}
									>
										{formatLatency(entry.dur)}
									</span>
								)}
							</div>
							{(entry.note || entry.error) && (
								<div className="mt-1 space-y-0.5 text-dash-text-secondary">
									{entry.note && <p>{entry.note}</p>}
									{entry.error && <p className="text-red-400">{entry.error}</p>}
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
	const toneMap: Record<string, string> = {
		ok: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
		skip: "bg-slate-500/10 text-slate-300 border-slate-500/20",
		warn: "bg-amber-500/10 text-amber-400 border-amber-500/20",
		block: "bg-orange-500/10 text-orange-400 border-orange-500/20",
		error: "bg-red-500/10 text-red-400 border-red-500/20",
		crash: "bg-red-500/10 text-red-400 border-red-500/20",
	};
	const cls = toneMap[status] ?? "bg-dash-surface text-dash-text-muted border-dash-border";
	return (
		<span
			className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${cls}`}
		>
			{status}
		</span>
	);
};

const SystemHookDiagnostics: React.FC = () => {
	const { t } = useI18n();
	const [data, setData] = useState<HookDiagnosticsResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [expandedHooks, setExpandedHooks] = useState<Set<string>>(new Set());
	const requestIdRef = useRef(0);

	const load = useCallback(async () => {
		requestIdRef.current += 1;
		const id = requestIdRef.current;
		setLoading(true);
		setError(null);
		try {
			const result = await fetchHookDiagnostics({ scope: "global", limit: 200 });
			if (id !== requestIdRef.current) return;
			setData(result);
		} catch (err) {
			if (id !== requestIdRef.current) return;
			setError(err instanceof Error ? err.message : t("hookDiagnosticsLoadFailed"));
			setData(null);
		} finally {
			if (id === requestIdRef.current) setLoading(false);
		}
	}, [t]);

	useEffect(() => {
		void load();
	}, [load]);

	const grouped = useMemo(
		() => (data?.entries ? groupByHook(data.entries) : new Map<string, HookDiagnosticsEntry[]>()),
		[data],
	);

	const hookNames = useMemo(() => Array.from(grouped.keys()).sort(), [grouped]);

	const toggleHook = (name: string) => {
		setExpandedHooks((prev) => {
			const next = new Set(prev);
			if (next.has(name)) {
				next.delete(name);
			} else {
				next.add(name);
			}
			return next;
		});
	};

	return (
		<section className="dash-panel p-4 space-y-3">
			<div className="flex items-center justify-between gap-2">
				<h3 className="text-sm font-semibold uppercase tracking-wide text-dash-text">
					{t("hookDiagnostics")}
				</h3>
				<button
					type="button"
					onClick={() => void load()}
					disabled={loading}
					className="rounded-lg border border-dash-border bg-dash-surface px-2.5 py-1.5 text-xs font-semibold text-dash-text-secondary hover:bg-dash-surface-hover disabled:opacity-50 transition-colors"
				>
					{loading ? t("checking") : t("refresh")}
				</button>
			</div>

			{/* Column header */}
			{hookNames.length > 0 && (
				<div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-3 text-[10px] uppercase tracking-wide text-dash-text-muted">
					<span>{t("hookEvent")}</span>
					<span className="text-right">{t("hookExecutions")}</span>
					<span className="text-right">{t("hookAvgLatency")}</span>
					<span className="text-right">{t("hookFailureRate")}</span>
					<span className="text-right">{t("hookLastRun")}</span>
				</div>
			)}

			{loading && (
				<p className="text-sm text-dash-text-muted py-2">{t("hookDiagnosticsLoading")}</p>
			)}

			{!loading && error && <p className="text-sm text-red-400">{error}</p>}

			{!loading && !error && data && !data.exists && (
				<p className="text-sm text-dash-text-muted">{t("hookDiagnosticsMissing")}</p>
			)}

			{!loading && !error && data?.exists && hookNames.length === 0 && (
				<p className="text-sm text-dash-text-muted">{t("hookDiagnosticsEmpty")}</p>
			)}

			{!loading && !error && hookNames.length > 0 && (
				<div className="space-y-1.5">
					{hookNames.map((name) => (
						<HookRow
							key={name}
							hookName={name}
							entries={grouped.get(name) ?? []}
							expanded={expandedHooks.has(name)}
							onToggle={() => toggleHook(name)}
						/>
					))}
				</div>
			)}

			{/* Latency warning legend */}
			{hookNames.length > 0 && (
				<p className="flex items-center gap-1.5 text-[11px] text-dash-text-muted">
					<span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
					{t("hookLatencyWarning")}
				</p>
			)}
		</section>
	);
};

export default SystemHookDiagnostics;
