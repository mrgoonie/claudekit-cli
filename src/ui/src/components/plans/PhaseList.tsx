import { useI18n } from "../../i18n";
import type { PlanActionResult } from "../../types/plan-dashboard-types";
import type { PlanPhase } from "../../types/plan-types";
import PhaseActions from "./PhaseActions";

export default function PhaseList({
	planDir,
	phases,
	actions,
	onRead,
	onRefresh,
}: {
	planDir: string;
	phases: PlanPhase[];
	actions: PlanActionResult;
	onRead: (file: string) => void;
	onRefresh: () => void;
}) {
	const { t } = useI18n();
	return (
		<section className="rounded-xl border border-dash-border bg-dash-surface p-5">
			<h2 className="mb-4 text-lg font-semibold text-dash-text">{t("plansPhases")}</h2>
			<div className="space-y-3">
				{phases.map((phase) => (
					<div key={phase.phaseId} className="rounded-lg border border-dash-border bg-dash-bg p-3">
						<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
							<div>
								<p className="text-xs uppercase tracking-[0.2em] text-dash-text-muted">
									{phase.phaseId}
								</p>
								<h3 className="text-sm font-semibold text-dash-text">{phase.name}</h3>
								<p className="text-xs text-dash-text-muted">{phase.status}</p>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<button
									type="button"
									onClick={() => onRead(phase.file)}
									className="rounded border border-dash-border px-2 py-1 text-xs text-dash-text"
								>
									{t("plansRead")}
								</button>
								<PhaseActions
									planDir={planDir}
									phaseId={phase.phaseId}
									status={phase.status}
									actions={actions}
									onSuccess={onRefresh}
								/>
							</div>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}
