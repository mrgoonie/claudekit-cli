import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import {
	type HookDiagnosticsEntry,
	type HookDiagnosticsResponse,
	fetchHookDiagnostics,
	fetchProjects,
} from "../services/api";

const statusTone: Record<string, string> = {
	ok: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
	skip: "bg-slate-500/10 text-slate-300 border-slate-500/20",
	warn: "bg-amber-500/10 text-amber-400 border-amber-500/20",
	block: "bg-orange-500/10 text-orange-400 border-orange-500/20",
	error: "bg-red-500/10 text-red-400 border-red-500/20",
	crash: "bg-red-500/10 text-red-400 border-red-500/20",
};

function formatTs(ts: string | undefined, fallback: string): string {
	if (!ts) return fallback;
	try {
		return new Intl.DateTimeFormat(undefined, {
			month: "short",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		}).format(new Date(ts));
	} catch {
		return ts;
	}
}

const SystemHookDiagnosticsCard: React.FC = () => {
	const { t } = useI18n();
	const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
	const [selectedProjectId, setSelectedProjectId] = useState<string>("global");
	const [diagnostics, setDiagnostics] = useState<HookDiagnosticsResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const requestIdRef = useRef(0);
	const activeAbortRef = useRef<AbortController | null>(null);

	const loadDiagnostics = useCallback(
		async (projectId: string) => {
			requestIdRef.current += 1;
			const requestId = requestIdRef.current;
			activeAbortRef.current?.abort();
			const controller = new AbortController();
			activeAbortRef.current = controller;
			setLoading(true);
			setError(null);
			try {
				const data = await fetchHookDiagnostics(
					projectId === "global"
						? { scope: "global", limit: 40, signal: controller.signal }
						: { scope: "project", projectId, limit: 40, signal: controller.signal },
				);
				if (requestId !== requestIdRef.current) return;
				setDiagnostics(data);
			} catch (err) {
				if (controller.signal.aborted || requestId !== requestIdRef.current) return;
				setDiagnostics(null);
				setError(err instanceof Error ? err.message : t("hookDiagnosticsLoadFailed"));
			} finally {
				if (requestId === requestIdRef.current) {
					setLoading(false);
					activeAbortRef.current = null;
				}
			}
		},
		[t],
	);

	useEffect(() => {
		let cancelled = false;
		void fetchProjects()
			.then((items) => {
				if (cancelled) return;
				setProjects(items.map((item) => ({ id: item.id, name: item.name })));
			})
			.catch(() => {
				if (!cancelled) setProjects([]);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		void loadDiagnostics(selectedProjectId);
	}, [loadDiagnostics, selectedProjectId]);

	useEffect(
		() => () => {
			activeAbortRef.current?.abort();
		},
		[],
	);

	const summary = diagnostics?.summary;
	const statusCounts = summary?.statusCounts ?? {};
	const entries = diagnostics?.entries ?? [];
	const kpis = useMemo(
		() => [
			{ label: t("hookDiagnosticsEntries"), value: String(summary?.total ?? 0) },
			{
				label: t("hookDiagnosticsCrashes"),
				value: String(statusCounts.crash ?? 0),
			},
			{ label: t("hookDiagnosticsWarnings"), value: String(statusCounts.warn ?? 0) },
			{ label: t("hookDiagnosticsBlocks"), value: String(statusCounts.block ?? 0) },
		],
		[summary?.total, statusCounts.block, statusCounts.crash, statusCounts.warn, t],
	);

	return (
		<section className="dash-panel p-4 space-y-4">
			<div className="flex flex-col gap-3">
				<div className="space-y-1 min-w-0">
					<h3 className="text-sm font-semibold uppercase tracking-wide text-dash-text">
						{t("hookDiagnosticsTitle")}
					</h3>
					<p className="text-xs text-dash-text-secondary">{t("hookDiagnosticsDesc")}</p>
					<p className="mono text-[11px] text-dash-text-muted break-all">
						{diagnostics?.path ?? t("hookDiagnosticsPathPending")}
					</p>
				</div>

				<div className="flex items-center gap-2">
					<select
						value={selectedProjectId}
						onChange={(event) => setSelectedProjectId(event.target.value)}
						className="rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-xs text-dash-text"
					>
						<option value="global">{t("hookDiagnosticsScopeGlobal")}</option>
						{projects.map((project) => (
							<option key={project.id} value={project.id}>
								{project.name}
							</option>
						))}
					</select>
					<button
						type="button"
						onClick={() => void loadDiagnostics(selectedProjectId)}
						className="rounded-lg border border-dash-border bg-dash-surface px-3 py-2 text-xs font-semibold text-dash-text-secondary hover:bg-dash-surface-hover"
					>
						{t("refresh")}
					</button>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
				{kpis.map((item) => (
					<div
						key={item.label}
						className="rounded-lg border border-dash-border bg-dash-bg/60 px-3 py-2"
					>
						<p className="text-[11px] uppercase tracking-wide text-dash-text-muted">{item.label}</p>
						<p className="mono mt-1 text-lg font-semibold text-dash-text">{item.value}</p>
					</div>
				))}
			</div>

			{summary?.lastEventAt && (
				<p className="text-xs text-dash-text-muted">
					{t("hookDiagnosticsLastEvent")}:{" "}
					{formatTs(summary.lastEventAt, t("hookDiagnosticsUnknown"))}
				</p>
			)}

			{summary && (summary.parseErrors > 0 || summary.truncated) && (
				<div className="rounded-lg border border-amber-300 dark:border-amber-500/30 bg-amber-100 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-200">
					{summary.parseErrors > 0 && (
						<p>
							{t("hookDiagnosticsParseErrorsNotice").replace(
								"{count}",
								String(summary.parseErrors),
							)}
						</p>
					)}
					{summary.truncated && <p>{t("hookDiagnosticsTruncatedNotice")}</p>}
				</div>
			)}

			{loading && <p className="text-sm text-dash-text-muted">{t("hookDiagnosticsLoading")}</p>}
			{error && <p className="text-sm text-red-400">{error}</p>}
			{!loading && !error && diagnostics && !diagnostics.exists && (
				<p className="text-sm text-dash-text-muted">{t("hookDiagnosticsMissing")}</p>
			)}

			{!loading && !error && diagnostics?.exists && (
				<div className="space-y-2">
					{entries.length === 0 ? (
						<p className="text-sm text-dash-text-muted">{t("hookDiagnosticsEmpty")}</p>
					) : (
						entries.map((entry: HookDiagnosticsEntry, index) => (
							<div
								key={`${entry.ts}-${entry.hook}-${index}`}
								className="rounded-lg border border-dash-border bg-dash-bg/70 px-3 py-3"
							>
								<div className="flex flex-wrap items-center gap-2">
									<span className="mono text-[11px] text-dash-text-muted">
										{formatTs(entry.ts, t("hookDiagnosticsUnknown"))}
									</span>
									<span
										className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
											statusTone[entry.status] ??
											"bg-dash-surface text-dash-text border-dash-border"
										}`}
									>
										{entry.status}
									</span>
									<span className="text-sm font-medium text-dash-text">{entry.hook}</span>
									{entry.event && (
										<span className="text-xs text-dash-text-muted">{entry.event}</span>
									)}
									{entry.tool && (
										<span className="text-xs text-dash-text-muted">
											{t("hookDiagnosticsToolLabel")}: {entry.tool}
										</span>
									)}
								</div>
								{(entry.note || entry.target || entry.error) && (
									<div className="mt-2 space-y-1 text-xs text-dash-text-secondary">
										{entry.note && <p>{entry.note}</p>}
										{entry.target && (
											<p className="mono">
												{t("hookDiagnosticsTargetLabel")}: {entry.target}
											</p>
										)}
										{entry.error && <p className="text-red-400">{entry.error}</p>}
									</div>
								)}
							</div>
						))
					)}
				</div>
			)}
		</section>
	);
};

export default SystemHookDiagnosticsCard;
