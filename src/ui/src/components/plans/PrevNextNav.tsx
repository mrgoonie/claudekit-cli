import { useI18n } from "../../i18n";
import type { PlanNavigationItem } from "../../types/plan-dashboard-types";

interface PrevNextNavProps {
	prev: PlanNavigationItem | null;
	next: PlanNavigationItem | null;
	onNavigate: (file: string) => void;
}

function NavButton({
	label,
	item,
	onClick,
}: {
	label: string;
	item: PlanNavigationItem | null;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={!item}
			className="rounded-lg border border-dash-border px-3 py-2 text-sm text-dash-text transition hover:border-dash-accent/50 disabled:cursor-not-allowed disabled:opacity-40"
			title={item?.name}
		>
			{label}
		</button>
	);
}

export default function PrevNextNav(props: PrevNextNavProps) {
	const { t } = useI18n();
	return (
		<div className="flex items-center gap-2">
			<NavButton
				label={t("plansPrevious")}
				item={props.prev}
				onClick={() => props.prev && props.onNavigate(props.prev.file)}
			/>
			<NavButton
				label={t("plansNext")}
				item={props.next}
				onClick={() => props.next && props.onNavigate(props.next.file)}
			/>
		</div>
	);
}
