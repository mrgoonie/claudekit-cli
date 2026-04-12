import { useI18n } from "../../i18n";
import type { PlanActionResult } from "../../types/plan-dashboard-types";
import type { PhaseStatus } from "../../types/plan-types";

export default function PhaseActions({
	planDir,
	phaseId,
	status,
	actions,
	onSuccess,
}: {
	planDir: string;
	phaseId: string;
	status: PhaseStatus;
	actions: PlanActionResult;
	onSuccess: () => void;
}) {
	const { t } = useI18n();
	const run = async (action: "start" | "complete" | "reset") => {
		await actions.trigger({ action, planDir, phaseId });
		onSuccess();
	};

	return (
		<div className="flex flex-wrap gap-2">
			<button
				type="button"
				onClick={() => void run("start")}
				className="rounded border border-dash-border px-2 py-1 text-xs text-dash-text"
			>
				{status === "in-progress" ? t("plansRestart") : t("plansStart")}
			</button>
			<button
				type="button"
				onClick={() => void run("complete")}
				className="rounded border border-dash-border px-2 py-1 text-xs text-dash-text"
			>
				{t("plansComplete")}
			</button>
			<button
				type="button"
				onClick={() => void run("reset")}
				className="rounded border border-dash-border px-2 py-1 text-xs text-dash-text-muted"
			>
				{t("plansReset")}
			</button>
		</div>
	);
}
