/**
 * ConfigEditorHeader - Header with back button, title, badge, and save/reset buttons
 */
import type React from "react";
import { useI18n } from "../../i18n";

export interface ConfigEditorHeaderProps {
	title: string;
	filePath: string;
	onBack: () => void;
	onSave: () => void;
	onReset: () => void;
	saveStatus: "idle" | "saving" | "saved" | "error";
	syntaxError: string | null;
	showResetConfirm: boolean;
	setShowResetConfirm: (show: boolean) => void;
	badge?: React.ReactNode;
}

export const ConfigEditorHeader: React.FC<ConfigEditorHeaderProps> = ({
	title,
	filePath,
	onBack,
	onSave,
	onReset,
	saveStatus,
	syntaxError,
	showResetConfirm,
	setShowResetConfirm,
	badge,
}) => {
	const { t } = useI18n();

	return (
		<div className="flex items-center justify-between mb-3 shrink-0">
			<div className="flex items-center gap-3">
				<button
					onClick={onBack}
					className="px-2 py-1 rounded-lg bg-dash-surface hover:bg-dash-surface-hover border border-dash-border text-sm text-dash-text-secondary hover:text-dash-text flex items-center group transition-all font-medium shadow-sm"
					title={t("backToDashboard")}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M15 19l-7-7 7-7"
						/>
					</svg>
				</button>
				<h1 className="text-xl font-bold tracking-tight text-dash-text">{title}</h1>
				{badge}
				<span className="text-xs text-dash-text-muted mono">{filePath}</span>
			</div>

			<div className="flex items-center gap-2 relative">
				{showResetConfirm ? (
					<div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-2 py-1 animate-in fade-in duration-200">
						<span className="text-xs text-red-500 font-medium">{t("confirmReset")}</span>
						<button
							onClick={onReset}
							className="px-2 py-0.5 rounded bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors"
						>
							{t("confirm")}
						</button>
						<button
							onClick={() => setShowResetConfirm(false)}
							className="px-2 py-0.5 rounded bg-dash-surface text-dash-text-secondary text-xs font-bold hover:bg-dash-surface-hover transition-colors border border-dash-border"
						>
							{t("cancel")}
						</button>
					</div>
				) : (
					<button
						onClick={() => setShowResetConfirm(true)}
						className="px-3 py-1.5 rounded-lg bg-dash-surface text-xs font-bold text-dash-text-secondary hover:bg-dash-surface-hover transition-colors border border-dash-border"
					>
						{t("resetToDefault")}
					</button>
				)}

				<button
					onClick={onSave}
					disabled={!!syntaxError || saveStatus === "saving"}
					className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all tracking-widest uppercase ${
						syntaxError
							? "bg-dash-surface text-dash-text-muted cursor-not-allowed border border-dash-border"
							: saveStatus === "saved"
								? "bg-green-500 text-white shadow-lg shadow-green-500/20"
								: saveStatus === "error"
									? "bg-red-500 text-white"
									: "bg-dash-accent text-dash-bg hover:bg-dash-accent-hover shadow-lg shadow-dash-accent/20"
					}`}
				>
					{saveStatus === "saving"
						? t("saving")
						: saveStatus === "saved"
							? t("saved")
							: saveStatus === "error"
								? t("saveFailed")
								: t("saveChanges")}
				</button>
			</div>
		</div>
	);
};
