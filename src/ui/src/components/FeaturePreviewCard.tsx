/**
 * Feature preview card for kit comparison
 * Shows individual features with included/excluded status
 */
import type React from "react";
import { useI18n } from "../i18n";
import type { TranslationKey } from "../i18n";

interface FeaturePreviewCardProps {
	featureId: string;
	name: TranslationKey;
	description: TranslationKey;
	included: boolean;
}

const FeaturePreviewCard: React.FC<FeaturePreviewCardProps> = ({
	featureId,
	name,
	description,
	included,
}) => {
	const { t } = useI18n();

	return (
		<div
			data-testid={`feature-card-${featureId}`}
			className={`p-4 rounded-lg border transition-all ${
				included
					? "border-[var(--dash-accent)] bg-[var(--dash-surface)] shadow-sm"
					: "border-[var(--dash-border)] bg-[var(--dash-bg)] opacity-50"
			}`}
		>
			<div className="flex items-center gap-2 mb-2">
				{included ? (
					<svg
						className="w-5 h-5 text-[var(--dash-accent)]"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
					</svg>
				) : (
					<svg
						className="w-5 h-5 text-[var(--dash-text-muted)]"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				)}
				<h4 className="font-medium text-[var(--dash-text)]">{t(name)}</h4>
			</div>
			<p className="text-sm text-[var(--dash-text-muted)] leading-relaxed">{t(description)}</p>
		</div>
	);
};

export default FeaturePreviewCard;
