import { useI18n } from "../../i18n";
import type { TranslationKey } from "../../i18n";
import type { PlanListItem } from "../../types/plan-dashboard-types";
import type { PlanBoardStatus } from "../../types/plan-types";

const STATUS_CLASSES: Record<string, string> = {
	pending: "bg-amber-500/10 text-amber-400/90 border border-amber-500/20",
	"in-progress": "bg-sky-500/10 text-sky-400/90 border border-sky-500/20",
	"in-review": "bg-violet-500/10 text-violet-400/90 border border-violet-500/20",
	done: "bg-emerald-500/10 text-emerald-400/90 border border-emerald-500/20",
	cancelled: "bg-rose-500/10 text-rose-400/90 border border-rose-500/20",
};

const STATUS_LABELS: Record<PlanBoardStatus, TranslationKey> = {
	pending: "plansStatusPending",
	"in-progress": "plansStatusInProgress",
	"in-review": "plansStatusInReview",
	done: "plansStatusDone",
	cancelled: "plansStatusCancelled",
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
	const { t } = useI18n();
	const summary = plan.summary;
	const status = summary.status ?? "pending";
	const tags = summary.tags ?? [];

	return (
		<button
			type="button"
			onClick={onClick}
			className="group relative w-full rounded-[2rem] bg-dash-border/20 p-1 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-dash-accent/10 active:scale-[0.98]"
		>
			<div className="flex h-full flex-col rounded-[calc(2rem-0.25rem)] border border-white/5 bg-dash-surface p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] transition-colors duration-500 group-hover:bg-dash-surface-hover">
				<div className="mb-4 flex items-start justify-between gap-3">
					<div className="flex-1">
						<div className="mb-1 flex items-center gap-2">
							<span className="text-[10px] font-bold uppercase tracking-[0.2em] text-dash-accent/80">
								{plan.slug.split("-")[0]}
							</span>
							<span className="h-1 w-1 rounded-full bg-dash-border" />
							<span className="text-[10px] font-medium uppercase tracking-[0.1em] text-dash-text-muted">
								{t("plansPhaseCountCompact").replace("{count}", String(summary.totalPhases))}
							</span>
						</div>
						{plan.projectName && (
							<div className="mb-2">
								<span className="inline-flex rounded-full border border-dash-accent/20 bg-dash-accent/10 px-2 py-0.5 text-[10px] font-medium text-dash-accent">
									{plan.projectName}
								</span>
							</div>
						)}
						<h3 className="text-base font-semibold tracking-tight text-dash-text group-hover:text-dash-accent transition-colors">
							{summary.title ?? plan.name}
						</h3>
						{summary.description && !compact && (
							<p className="mt-2 text-xs leading-relaxed text-dash-text-muted line-clamp-2">
								{summary.description}
							</p>
						)}
					</div>
					<div className="flex flex-col items-end gap-2">
						<span
							className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_CLASSES[status]}`}
						>
							{t(STATUS_LABELS[status])}
						</span>
						<div className="flex h-8 w-8 items-center justify-center rounded-full bg-dash-bg/50 border border-white/5 text-dash-text-muted transition-all duration-500 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:bg-dash-accent group-hover:text-white">
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="h-4 w-4"
							>
								<line x1="7" y1="17" x2="17" y2="7" />
								<polyline points="7 7 17 7 17 17" />
							</svg>
						</div>
					</div>
				</div>

				<div className="mt-auto space-y-4">
					<div className="group/progress relative">
						<div className="flex items-center justify-between mb-1.5">
							<span className="text-[10px] font-medium text-dash-text-muted uppercase tracking-wider">
								{t("kanbanProgress")}
							</span>
							<span className="text-[10px] font-bold text-dash-text">{summary.progressPct}%</span>
						</div>
						<div className="h-1.5 w-full overflow-hidden rounded-full bg-dash-bg shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]">
							<div
								className="h-full rounded-full bg-gradient-to-r from-dash-accent/80 to-dash-accent transition-all duration-1000 ease-[cubic-bezier(0.32,0.72,0,1)]"
								style={{ width: `${summary.progressPct}%` }}
							/>
						</div>
					</div>

					<div className="flex items-center justify-between border-t border-white/5 pt-4">
						<div className="flex gap-4">
							<div className="flex flex-col">
								<span className="text-[9px] uppercase tracking-widest text-dash-text-muted">
									{t("plansPriority")}
								</span>
								<span className="text-xs font-semibold text-dash-text">
									{summary.priority ?? "—"}
								</span>
							</div>
							<div className="flex flex-col">
								<span className="text-[9px] uppercase tracking-widest text-dash-text-muted">
									{t("plansUpdated")}
								</span>
								<span className="text-xs font-semibold text-dash-text">
									{formatDate(summary.lastModified)}
								</span>
							</div>
						</div>
						{!compact && tags.length > 0 && (
							<div className="flex -space-x-2">
								{tags.slice(0, 3).map((tag, i) => (
									<div
										key={tag}
										className="flex h-5 items-center rounded-full border border-dash-border bg-dash-surface px-2 text-[9px] font-medium text-dash-text-muted ring-2 ring-dash-surface"
										style={{ zIndex: 10 - i }}
									>
										{tag}
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</button>
	);
}
