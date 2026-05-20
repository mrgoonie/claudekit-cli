/**
 * ModeToggle — segmented control for Reconcile / Install mode switch.
 *
 * Accessibility: role="tablist" / role="tab" per ARIA spec.
 * Dirty-state confirm: if caller signals pending changes exist, a native
 * <dialog> confirm fires before the switch completes. Escape dismisses the
 * dialog (cancel). Focus is trapped inside the dialog while open.
 */

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n";

export type MigrateMode = "reconcile" | "install";

interface ModeToggleProps {
	/** Currently active mode. */
	mode: MigrateMode;
	/** Number of pending flips/resolutions in the current session. */
	pendingCount: number;
	/** Whether a fetch/execute is in flight — toggle disabled when true. */
	disabled?: boolean;
	/** Called when the user confirms a mode switch. */
	onModeChange: (next: MigrateMode) => void;
}

/** Confirm dialog for dirty-state mode switch. */
const ModeConfirmDialog: React.FC<{
	pendingCount: number;
	nextMode: MigrateMode;
	onConfirm: () => void;
	onCancel: () => void;
}> = ({ pendingCount, nextMode, onConfirm, onCancel }) => {
	const { t } = useI18n();
	const dialogRef = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		if (!dialog.open) {
			dialog.showModal();
		}
		// Escape key handled natively by <dialog>; intercept to call onCancel
		const handleCancel = (event: Event) => {
			event.preventDefault();
			onCancel();
		};
		dialog.addEventListener("cancel", handleCancel);
		return () => {
			dialog.removeEventListener("cancel", handleCancel);
			if (dialog.open) {
				dialog.close();
			}
		};
	}, [onCancel]);

	const modeLabel = nextMode === "install" ? t("migrateModeInstall") : t("migrateModeReconcile");

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby="mode-confirm-title"
			aria-describedby="mode-confirm-body"
			onClick={(event) => {
				if (event.target === event.currentTarget) onCancel();
			}}
			className="fixed inset-0 z-50 m-auto h-auto max-w-sm rounded-xl border border-dash-border bg-dash-surface p-6 shadow-2xl backdrop:bg-black/50"
		>
			<h2 id="mode-confirm-title" className="mb-2 text-base font-semibold text-dash-text">
				{t("migrateModeConfirmTitle")}
			</h2>
			<p id="mode-confirm-body" className="mb-5 text-sm text-dash-text-secondary">
				{/* Inline interpolation: template has {count} and {mode} placeholders */}
				{t("migrateModeConfirmBody")
					.replace("{count}", String(pendingCount))
					.replace("{mode}", modeLabel)}
			</p>
			<div className="flex justify-end gap-3">
				<button
					type="button"
					onClick={onCancel}
					className="dash-focus-ring px-4 py-2 text-sm font-medium rounded-md border border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover"
				>
					{t("cancel")}
				</button>
				<button
					type="button"
					// biome-ignore lint/a11y/noAutofocus: confirm button must receive focus in modal for accessibility
					autoFocus
					onClick={onConfirm}
					className="dash-focus-ring px-4 py-2 text-sm font-semibold rounded-md bg-dash-accent text-white hover:bg-dash-accent/90"
				>
					{t("migrateModeConfirmSwitch")}
				</button>
			</div>
		</dialog>
	);
};

export const ModeToggle: React.FC<ModeToggleProps> = ({
	mode,
	pendingCount,
	disabled = false,
	onModeChange,
}) => {
	const { t } = useI18n();
	const [pendingNext, setPendingNext] = useState<MigrateMode | null>(null);

	const handleTabClick = useCallback(
		(next: MigrateMode) => {
			if (next === mode || disabled) return;
			if (pendingCount > 0) {
				setPendingNext(next);
			} else {
				onModeChange(next);
			}
		},
		[mode, disabled, pendingCount, onModeChange],
	);

	const handleConfirm = useCallback(() => {
		if (pendingNext) {
			onModeChange(pendingNext);
			setPendingNext(null);
		}
	}, [pendingNext, onModeChange]);

	const handleCancel = useCallback(() => {
		setPendingNext(null);
	}, []);

	return (
		<>
			<div
				role="tablist"
				aria-label={t("migrateModeLabel")}
				className="inline-flex rounded-lg border border-dash-border bg-dash-bg overflow-hidden"
			>
				{(["reconcile", "install"] as MigrateMode[]).map((tabMode) => {
					const isActive = mode === tabMode;
					const labelKey = tabMode === "reconcile" ? "migrateModeReconcile" : "migrateModeInstall";
					const descKey =
						tabMode === "reconcile" ? "migrateModeReconcileDesc" : "migrateModeInstallDesc";
					return (
						<button
							key={tabMode}
							type="button"
							role="tab"
							aria-selected={isActive}
							aria-controls={`migrate-${tabMode}-panel`}
							id={`migrate-${tabMode}-tab`}
							disabled={disabled}
							onClick={() => handleTabClick(tabMode)}
							className={`px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent disabled:opacity-50 disabled:cursor-not-allowed ${
								isActive
									? "bg-dash-accent-subtle text-dash-accent"
									: "text-dash-text-secondary hover:bg-dash-surface-hover hover:text-dash-text"
							}`}
						>
							<span className="block">{t(labelKey)}</span>
							<span className="block text-[10px] font-normal opacity-70">{t(descKey)}</span>
						</button>
					);
				})}
			</div>

			{pendingNext && (
				<ModeConfirmDialog
					pendingCount={pendingCount}
					nextMode={pendingNext}
					onConfirm={handleConfirm}
					onCancel={handleCancel}
				/>
			)}
		</>
	);
};
