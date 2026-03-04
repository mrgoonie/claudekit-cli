/**
 * KanbanPage — Plan phase board with 3-column layout
 * URL: /kanban?file=<absolute-path-to-plan.md>
 * Fetches parsed phases from /api/plan/parse
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useI18n } from "../i18n";
import type { PlanPhase } from "../types/plan-types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParseResponse {
	file: string;
	frontmatter: Record<string, unknown>;
	phases: PlanPhase[];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PhaseCard({ phase }: { phase: PlanPhase }) {
	const borderColor =
		phase.status === "completed"
			? "border-green-500"
			: phase.status === "in-progress"
				? "border-blue-500"
				: "border-amber-400";

	return (
		<div className={`rounded border-l-4 ${borderColor} bg-white dark:bg-gray-800 p-3 shadow-sm`}>
			<div className="flex items-center gap-2">
				<span className="text-xs font-mono text-gray-400 dark:text-gray-500">{phase.phaseId}</span>
				<span className="text-sm font-medium text-gray-800 dark:text-gray-100">{phase.name}</span>
			</div>
		</div>
	);
}

function KanbanColumn({
	title,
	phases,
	borderColor,
}: {
	title: string;
	phases: PlanPhase[];
	borderColor: string;
}) {
	return (
		<div className="flex flex-1 flex-col gap-3 min-w-0">
			<div className={`rounded-t border-t-2 ${borderColor} bg-gray-50 dark:bg-gray-900 px-3 py-2`}>
				<span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</span>
				<span className="ml-2 text-xs text-gray-400">{phases.length}</span>
			</div>
			<div className="flex flex-col gap-2 px-1">
				{phases.map((p) => (
					<PhaseCard key={p.phaseId} phase={p} />
				))}
			</div>
		</div>
	);
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ completed, total }: { completed: number; total: number }) {
	const { t } = useI18n();
	const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
	return (
		<div className="flex flex-col gap-1">
			<div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
				<span>{t("kanbanProgress")}</span>
				<span>
					{completed}/{total} {t("kanbanPhases")} — {pct}% {t("kanbanComplete")}
				</span>
			</div>
			<div className="h-2 w-full rounded bg-gray-200 dark:bg-gray-700">
				<div className="h-2 rounded bg-green-500 transition-all" style={{ width: `${pct}%` }} />
			</div>
		</div>
	);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KanbanPage() {
	const { t } = useI18n();
	const [searchParams] = useSearchParams();
	const file = searchParams.get("file") ?? "";

	const [phases, setPhases] = useState<PlanPhase[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!file) return;
		setLoading(true);
		setError(null);
		setPhases([]); // Clear stale phases before re-fetch
		fetch(`/api/plan/parse?file=${encodeURIComponent(file)}`)
			.then((r) => {
				if (!r.ok) {
					const messages: Record<number, string> = {
						400: t("kanbanError400"),
						403: t("kanbanError403"),
						404: t("kanbanError404"),
					};
					throw new Error(messages[r.status] ?? `${t("error")}: HTTP ${r.status}`);
				}
				return r.json() as Promise<ParseResponse>;
			})
			.then((data) => setPhases(data.phases))
			.catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
			.finally(() => setLoading(false));
	}, [file, t]);

	if (!file) {
		return (
			<div className="flex h-full items-center justify-center text-gray-400 dark:text-gray-500">
				{t("kanbanNoFile")}
			</div>
		);
	}

	const pending = phases.filter((p) => p.status === "pending");
	const inProgress = phases.filter((p) => p.status === "in-progress");
	const completed = phases.filter((p) => p.status === "completed");

	return (
		<div className="flex h-full flex-col gap-4 p-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<h1 className="text-xl font-bold text-gray-900 dark:text-white">{t("kanbanTitle")}</h1>
				<span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-xs" title={file}>
					{file.replaceAll("\\", "/")}
				</span>
			</div>

			{/* Progress bar */}
			{phases.length > 0 && <ProgressBar completed={completed.length} total={phases.length} />}

			{/* Loading / Error states */}
			{loading && (
				<div className="flex flex-1 items-center justify-center text-gray-400">{t("loading")}</div>
			)}
			{error && (
				<div className="rounded border border-red-300 bg-red-50 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-400">
					{t("error")}: {error}
				</div>
			)}

			{/* Empty state */}
			{!loading && !error && phases.length === 0 && (
				<div className="flex flex-1 items-center justify-center text-gray-400 dark:text-gray-500">
					{t("kanbanNoPhases")}
				</div>
			)}

			{/* 3-column kanban board — stacks vertically on mobile, horizontal on md+ */}
			{!loading && !error && phases.length > 0 && (
				<div className="flex flex-1 flex-col gap-4 overflow-auto md:flex-row">
					<KanbanColumn
						title={t("kanbanStatus_pending")}
						phases={pending}
						borderColor="border-amber-400"
					/>
					<KanbanColumn
						title={t("kanbanStatus_in-progress")}
						phases={inProgress}
						borderColor="border-blue-500"
					/>
					<KanbanColumn
						title={t("kanbanStatus_completed")}
						phases={completed}
						borderColor="border-green-500"
					/>
				</div>
			)}
		</div>
	);
}
