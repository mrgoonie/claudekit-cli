import type { PlanListItem } from "../../types/plan-dashboard-types";

const STATUS_CLASSES: Record<string, string> = {
	pending: "bg-amber-500/15 text-amber-300",
	"in-progress": "bg-sky-500/15 text-sky-300",
	"in-review": "bg-violet-500/15 text-violet-300",
	done: "bg-emerald-500/15 text-emerald-300",
	cancelled: "bg-rose-500/15 text-rose-300",
};

function formatDate(value?: string): string {
	if (!value) return "—";
	return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function PlanCard({
	plan,
	onClick,
	compact = false,
}: {
	plan: PlanListItem;
	onClick: () => void;
	compact?: boolean;
}) {
	const summary = plan.summary;
	return (
		<button
			type="button"
			onClick={onClick}
			className="w-full rounded-xl border border-dash-border bg-dash-surface p-4 text-left transition hover:border-dash-accent/40 hover:bg-dash-surface-hover"
		>
			<div className="mb-3 flex items-start justify-between gap-3">
				<div>
					<h3 className="text-sm font-semibold text-dash-text">{summary.title ?? plan.name}</h3>
					{summary.description && (
						<p className="mt-1 text-xs text-dash-text-muted line-clamp-2">{summary.description}</p>
					)}
				</div>
				<span
					className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${STATUS_CLASSES[summary.status ?? "pending"]}`}
				>
					{summary.status ?? "pending"}
				</span>
			</div>
			<div className="mb-2 h-2 rounded-full bg-dash-bg">
				<div
					className="h-2 rounded-full bg-dash-accent transition-all"
					style={{ width: `${summary.progressPct}%` }}
				/>
			</div>
			<div className="grid gap-2 text-xs text-dash-text-muted sm:grid-cols-2">
				<span>{summary.progressPct}% complete</span>
				<span>{summary.totalPhases} phases</span>
				<span>Priority {summary.priority ?? "—"}</span>
				<span>{formatDate(summary.lastModified)}</span>
			</div>
			{!compact && summary.tags.length > 0 && (
				<div className="mt-3 flex flex-wrap gap-2">
					{summary.tags.slice(0, 4).map((tag) => (
						<span
							key={tag}
							className="rounded-full border border-dash-border px-2 py-1 text-[11px] text-dash-text-muted"
						>
							{tag}
						</span>
					))}
				</div>
			)}
		</button>
	);
}
