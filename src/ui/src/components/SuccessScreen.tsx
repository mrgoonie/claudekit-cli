/**
 * Success screen shown after successful ClaudeKit installation
 * Provides next steps and navigation options
 */
import type React from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import { KitType } from "../types";

interface SuccessScreenProps {
	kit: KitType;
	onGetStarted: () => void;
}

const SuccessScreen: React.FC<SuccessScreenProps> = ({ kit, onGetStarted }) => {
	const { t } = useI18n();
	const navigate = useNavigate();

	const kitName =
		kit === KitType.ENGINEER
			? "kitEngineerName"
			: kit === KitType.MARKETING
				? "kitMarketingName"
				: "kitEngineerName";

	return (
		<div className="text-center py-12 space-y-6" data-testid="success-screen">
			{/* Success icon */}
			<div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
				<svg
					className="w-10 h-10 text-green-600"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
			</div>

			{/* Success message */}
			<h2 className="text-2xl font-bold text-[var(--dash-text)]">{t("installSuccess")}</h2>
			<p className="text-[var(--dash-text-muted)] max-w-md mx-auto">
				{t("installSuccessDesc").replace("{kit}", t(kitName))}
			</p>

			{/* Action buttons */}
			<div className="flex gap-4 justify-center pt-4">
				<button
					onClick={onGetStarted}
					className="px-6 py-2.5 text-sm font-medium text-white bg-[var(--dash-accent)] rounded-lg hover:opacity-90 transition-opacity"
					data-testid="get-started-btn"
				>
					{t("getStarted")}
				</button>
				<button
					onClick={() => navigate("/")}
					className="px-6 py-2.5 text-sm font-medium text-[var(--dash-text)] bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-lg hover:bg-[var(--dash-surface-hover)] transition-colors"
					data-testid="dashboard-btn"
				>
					{t("goToDashboard")}
				</button>
			</div>
		</div>
	);
};

export default SuccessScreen;
