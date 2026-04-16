import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import DesktopModeNotice from "../components/desktop-mode-notice";
import HeatmapPanel from "../components/plans/HeatmapPanel";
import PhaseList from "../components/plans/PhaseList";
import PlanHeader from "../components/plans/PlanHeader";
import PlanTimeline from "../components/plans/PlanTimeline";
import { encodePlanPath, toRelativePlanPath } from "../components/plans/plan-path-utils";
import { usePlanActions } from "../hooks/use-plan-actions";
import { isTauri } from "../hooks/use-tauri";
import { useI18n } from "../i18n";
import type { TranslationKey } from "../i18n";
import type { PlanTimelineResponse } from "../types/plan-dashboard-types";
import type { PlanBoardStatus } from "../types/plan-types";

const STATUS_LABELS: Record<PlanBoardStatus, TranslationKey> = {
	pending: "plansStatusPending",
	"in-progress": "plansStatusInProgress",
	"in-review": "plansStatusInReview",
	done: "plansStatusDone",
	cancelled: "plansStatusCancelled",
};

function PlanDetailPageContent() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const { planSlug = "" } = useParams();
	const [searchParams] = useSearchParams();
	const rootDir = searchParams.get("dir") ?? "plans";
	const projectId = searchParams.get("projectId");
	const origin = searchParams.get("origin");
	const actions = usePlanActions(projectId);
	const [data, setData] = useState<PlanTimelineResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const planDir = `${rootDir}/${planSlug}`;

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const params = new URLSearchParams({ dir: planDir });
			if (projectId) params.set("projectId", projectId);
			const response = await fetch(`/api/plan/timeline?${params.toString()}`);
			if (!response.ok) {
				throw new Error(t("plansLoadPlanFailed").replace("{status}", String(response.status)));
			}
			setData((await response.json()) as PlanTimelineResponse);
		} catch (err) {
			setError(err instanceof Error ? err.message : t("plansLoadPlanFallback"));
		} finally {
			setLoading(false);
		}
	}, [planDir, projectId, t]);

	useEffect(() => {
		void load();
	}, [load]);

	if (loading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="flex flex-col items-center gap-4 animate-pulse">
					<div className="h-12 w-12 rounded-full border-2 border-dash-accent border-t-transparent animate-spin" />
					<p className="text-[10px] font-bold uppercase tracking-[0.3em] text-dash-accent/60">
						{t("plansLoadingPlan")}
					</p>
				</div>
			</div>
		);
	}

	if (error || !data) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
				<div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 backdrop-blur-md">
					<h2 className="text-sm font-bold uppercase tracking-widest text-red-400">{t("error")}</h2>
					<p className="mt-2 text-sm text-red-300/80">{error ?? t("plansNotFound")}</p>
					<button
						type="button"
						onClick={() => void load()}
						className="mt-6 rounded-full bg-red-500 px-6 py-2 text-xs font-bold uppercase tracking-widest text-white transition-all hover:scale-105 active:scale-95"
					>
						{t("refresh")}
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col overflow-hidden bg-dash-bg">
			{/* Header Navigation */}
			<div className="flex items-center gap-4 border-b border-white/5 bg-dash-surface/30 px-6 py-3 backdrop-blur-xl">
				<button
					type="button"
					onClick={() =>
						navigate(
							origin === "global"
								? "/plans"
								: `/plans?dir=${encodeURIComponent(rootDir)}${
										projectId ? `&projectId=${encodeURIComponent(projectId)}` : ""
									}`,
						)
					}
					className="group flex items-center gap-2 rounded-full border border-white/5 bg-dash-surface px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-dash-text transition-all hover:bg-dash-accent hover:text-white"
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="3"
						className="h-3 w-3 transition-transform group-hover:-translate-x-1"
					>
						<polyline points="15 18 9 12 15 6" />
					</svg>
					{t("plansBackToPlans")}
				</button>
				<div className="h-4 w-px bg-dash-border/50" />
				<span className="text-[10px] font-bold uppercase tracking-[0.2em] text-dash-text-muted">
					{data.plan.title ?? planSlug.toUpperCase()}
				</span>
			</div>

			<div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
				<div className="mx-auto max-w-[1600px] p-6 lg:p-10">
					{actions.error && (
						<div className="mb-6 rounded-[1.5rem] border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200 backdrop-blur-md">
							<p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-300">
								{t("actionFailed")}
							</p>
							<p className="mt-2 leading-relaxed">{actions.error}</p>
						</div>
					)}
					<div className="grid gap-10 lg:grid-cols-12 lg:items-start">
						{/* Main Content Column */}
						<div className="space-y-10 lg:col-span-8">
							<PlanHeader
								plan={data.plan}
								planDir={planDir}
								actions={actions}
								onActionSuccess={() => void load()}
							/>

							<PlanTimeline
								timeline={data.timeline}
								onOpenPhase={(file) =>
									navigate(
										`/plans/${encodeURIComponent(planSlug)}/read/${encodePlanPath(toRelativePlanPath(file, planDir))}?dir=${encodeURIComponent(rootDir)}${
											projectId ? `&projectId=${encodeURIComponent(projectId)}` : ""
										}${origin ? `&origin=${encodeURIComponent(origin)}` : ""}`,
									)
								}
							/>

							<PhaseList
								planDir={planDir}
								phases={data.plan.phases}
								actions={actions}
								onRead={(file) =>
									navigate(
										`/plans/${encodeURIComponent(planSlug)}/read/${encodePlanPath(toRelativePlanPath(file, planDir))}?dir=${encodeURIComponent(rootDir)}${
											projectId ? `&projectId=${encodeURIComponent(projectId)}` : ""
										}${origin ? `&origin=${encodeURIComponent(origin)}` : ""}`,
									)
								}
								onRefresh={() => void load()}
							/>
						</div>

						{/* Sidebar Column */}
						<div className="space-y-10 lg:col-span-4 lg:sticky lg:top-0">
							<div
								className="rounded-[2.5rem] bg-dash-accent/5 p-1 backdrop-blur-3xl"
								style={{
									animation: "fade-in 1s cubic-bezier(0.32,0.72,0,1) 0.6s both",
								}}
							>
								<HeatmapPanel planDir={planDir} projectId={projectId} />
							</div>

							{/* Quick Info Card */}
							<div
								className="rounded-[2rem] border border-white/5 bg-dash-surface/50 p-6 backdrop-blur-md"
								style={{
									animation: "fade-in 1s cubic-bezier(0.32,0.72,0,1) 0.8s both",
								}}
							>
								<h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-dash-accent">
									{t("plansQuickInfoTitle")}
								</h3>
								<div className="mt-4 space-y-4">
									<p className="text-xs leading-relaxed text-dash-text-muted">
										{t("plansQuickInfoDescription")}
									</p>
									<div className="flex items-center gap-3 rounded-2xl bg-dash-bg/50 p-4 border border-white/5">
										<div className="h-10 w-10 flex items-center justify-center rounded-full bg-dash-accent/10 border border-dash-accent/20">
											<svg
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												className="h-5 w-5 text-dash-accent"
												strokeWidth="2.5"
											>
												<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
											</svg>
										</div>
										<div>
											<p className="text-[9px] uppercase tracking-widest text-dash-text-muted">
												{t("plansCurrentStatus")}
											</p>
											<p className="text-sm font-bold text-dash-text">
												{data.plan.status
													? t(STATUS_LABELS[data.plan.status])
													: t("plansStatusUnknown")}
											</p>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default function PlanDetailPage() {
	if (isTauri()) {
		return (
			<DesktopModeNotice
				titleKey="desktopModePlanDetailTitle"
				descriptionKey="desktopModePlanDetailDescription"
				commandHintKey="desktopModePlanDetailHint"
			/>
		);
	}

	return <PlanDetailPageContent />;
}
