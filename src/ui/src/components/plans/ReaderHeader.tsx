import { useI18n } from "../../i18n";
import type { PlanNavigationItem } from "../../types/plan-dashboard-types";
import PrevNextNav from "./PrevNextNav";

interface ReaderHeaderProps {
	planTitle: string;
	phaseTitle?: string | null;
	prev: PlanNavigationItem | null;
	next: PlanNavigationItem | null;
	onBack: () => void;
	onNavigate: (file: string) => void;
}

export default function ReaderHeader(props: ReaderHeaderProps) {
	const { t } = useI18n();
	return (
		<header className="flex flex-col gap-4 rounded-xl border border-dash-border bg-dash-surface p-4 lg:flex-row lg:items-center lg:justify-between">
			<div>
				<button type="button" onClick={props.onBack} className="text-sm text-dash-accent">
					{t("plansBackToPlan")}
				</button>
				<p className="mt-2 text-xs uppercase tracking-[0.2em] text-dash-text-muted">
					{t("plansNav")}
				</p>
				<h1 className="text-lg font-semibold text-dash-text">
					{props.planTitle}
					{props.phaseTitle ? ` / ${props.phaseTitle}` : ""}
				</h1>
			</div>
			<PrevNextNav prev={props.prev} next={props.next} onNavigate={props.onNavigate} />
		</header>
	);
}
