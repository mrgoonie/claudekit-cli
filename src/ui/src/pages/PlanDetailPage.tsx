import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import HeatmapPanel from "../components/plans/HeatmapPanel";
import PhaseList from "../components/plans/PhaseList";
import PlanHeader from "../components/plans/PlanHeader";
import PlanTimeline from "../components/plans/PlanTimeline";
import { encodePlanPath, toRelativePlanPath } from "../components/plans/plan-path-utils";
import { usePlanActions } from "../hooks/use-plan-actions";
import { useI18n } from "../i18n";
import type { PlanTimelineResponse } from "../types/plan-dashboard-types";

export default function PlanDetailPage() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const { planSlug = "" } = useParams();
	const [searchParams] = useSearchParams();
	const rootDir = searchParams.get("dir") ?? "plans";
	const actions = usePlanActions();
	const [data, setData] = useState<PlanTimelineResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const planDir = `${rootDir}/${planSlug}`;

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await fetch(`/api/plan/timeline?dir=${encodeURIComponent(planDir)}`);
			if (!response.ok) throw new Error(`Failed to load plan (${response.status})`);
			setData((await response.json()) as PlanTimelineResponse);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load plan");
		} finally {
			setLoading(false);
		}
	}, [planDir]);

	useEffect(() => {
		void load();
	}, [load]);

	if (loading) return <p className="text-sm text-dash-text-muted">{t("plansLoadingPlan")}</p>;
	if (error || !data) return <p className="text-sm text-red-300">{error ?? "Plan not found"}</p>;

	return (
		<div className="flex h-full flex-col gap-4 overflow-auto">
			<button
				type="button"
				onClick={() => navigate(`/plans?dir=${encodeURIComponent(rootDir)}`)}
				className="w-fit text-sm text-dash-accent"
			>
				{t("plansBackToPlans")}
			</button>
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
						`/plans/${encodeURIComponent(planSlug)}/read/${encodePlanPath(toRelativePlanPath(file, planDir))}?dir=${encodeURIComponent(rootDir)}`,
					)
				}
			/>
			<HeatmapPanel planDir={planDir} />
			<PhaseList
				planDir={planDir}
				phases={data.plan.phases}
				actions={actions}
				onRead={(file) =>
					navigate(
						`/plans/${encodeURIComponent(planSlug)}/read/${encodePlanPath(toRelativePlanPath(file, planDir))}?dir=${encodeURIComponent(rootDir)}`,
					)
				}
				onRefresh={() => void load()}
			/>
		</div>
	);
}
