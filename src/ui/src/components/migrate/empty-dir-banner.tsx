/**
 * EmptyDirBanner — renders a ReconcileBanner of kind "empty-dir" or "empty-dir-respected"
 * as an info card above the reconcile tab strip.
 *
 * Copy is sourced from the banner object itself (banner.message) with i18n overlay
 * for structured parts (title, body, CTA).
 *
 * "empty-dir-respected" variant shows a "Reinstall these items" CTA that calls
 * onRespectDeletionsOverride when clicked — this flips respectDeletions off for the session.
 */

import type React from "react";
import { useI18n } from "../../i18n";
import type { ReconcileBanner } from "../../types/reconcile-types";

export interface EmptyDirBannerProps {
	banner: ReconcileBanner;
	/** Called by "Reinstall these items" CTA on empty-dir-respected banners */
	onRespectDeletionsOverride?: () => void;
}

export const EmptyDirBanner: React.FC<EmptyDirBannerProps> = ({
	banner,
	onRespectDeletionsOverride,
}) => {
	const { t } = useI18n();
	const isRespected = banner.kind === "empty-dir-respected";

	return (
		<output
			aria-live="polite"
			className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${
				isRespected
					? "bg-dash-surface border-dash-border text-dash-text-secondary"
					: "bg-blue-500/5 border-blue-500/20 text-blue-300"
			}`}
		>
			{/* Info icon */}
			<svg
				className={`w-4 h-4 mt-0.5 shrink-0 ${isRespected ? "text-dash-text-muted" : "text-blue-400"}`}
				fill="currentColor"
				viewBox="0 0 20 20"
				aria-hidden="true"
			>
				<path
					fillRule="evenodd"
					d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
					clipRule="evenodd"
				/>
			</svg>

			<div className="flex-1 min-w-0">
				{isRespected ? (
					<>
						<p className="text-xs font-medium">
							{t("migrateBanner_emptyDirRespected_title")} —{" "}
							<span className="font-mono">{banner.path}</span>{" "}
							{t("migrateBanner_emptyDirRespected_body")}
						</p>
						{onRespectDeletionsOverride && (
							<button
								type="button"
								onClick={onRespectDeletionsOverride}
								className="dash-focus-ring mt-1.5 text-xs font-medium text-dash-accent hover:underline"
							>
								{t("migrateBanner_reinstallCta")} →
							</button>
						)}
					</>
				) : (
					<p className="text-xs font-medium">
						{t("migrateBanner_emptyDir_title")} — <span className="font-mono">{banner.path}</span>:{" "}
						<span className="font-semibold">{banner.itemCount}</span>{" "}
						{t("migrateBanner_emptyDir_body")}
					</p>
				)}
			</div>
		</output>
	);
};
