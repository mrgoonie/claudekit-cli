/**
 * Auto-fix button for individual health checks
 */
import type React from "react";
import { useI18n } from "../../i18n";

interface HealthFixButtonProps {
	checkId: string;
	isFixing: boolean;
	onFix: (checkIds: string[]) => void;
}

const HealthFixButton: React.FC<HealthFixButtonProps> = ({ checkId, isFixing, onFix }) => {
	const { t } = useI18n();

	return (
		<button
			type="button"
			onClick={(e) => {
				e.stopPropagation();
				onFix([checkId]);
			}}
			disabled={isFixing}
			className="px-2.5 py-1 text-[11px] font-medium bg-dash-accent text-white rounded hover:bg-dash-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 flex items-center gap-1.5"
		>
			{isFixing ? (
				<>
					<div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
					{t("healthFixing")}
				</>
			) : (
				<>
					<svg className="w-3 h-3 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2}>
						<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
					</svg>
					{t("healthFix")}
				</>
			)}
		</button>
	);
};

export default HealthFixButton;
