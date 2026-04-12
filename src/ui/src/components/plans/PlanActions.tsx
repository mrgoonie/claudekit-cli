import { useI18n } from "../../i18n";
import type { PlanActionResult } from "../../types/plan-dashboard-types";

export default function PlanActions({
	planDir,
	actions,
	onSuccess,
}: {
	planDir: string;
	actions: PlanActionResult;
	onSuccess: () => void;
}) {
	const { t } = useI18n();
	const run = async (action: "validate" | "start-next") => {
		await actions.trigger({ action, planDir });
		onSuccess();
	};

	return (
		<div className="flex flex-wrap gap-2">
			<button
				type="button"
				onClick={() => void run("validate")}
				className="rounded-lg border border-dash-border px-3 py-2 text-sm text-dash-text"
			>
				{t("plansValidate")}
			</button>
			<button
				type="button"
				onClick={() => void run("start-next")}
				className="rounded-lg bg-dash-accent px-3 py-2 text-sm font-medium text-dash-bg"
			>
				{t("plansStartNext")}
			</button>
		</div>
	);
}
