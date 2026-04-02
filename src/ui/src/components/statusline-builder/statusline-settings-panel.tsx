import type { StatuslineMode } from "@/types/statusline-types";
/**
 * General settings panel for statusline builder.
 * Controls baseMode, responsiveBreakpoint, maxAgentRows, todoTruncation.
 * Save button persists to .ck.json via PATCH /api/ck-config/field.
 */
import type React from "react";
import { useI18n } from "../../i18n";
import type { TranslationKey } from "../../i18n/translations";

/** Minimal layout shape this panel needs — compatible with StatuslineBuilderLayout */
interface SettingsPanelLayout {
	baseMode: StatuslineMode;
	responsiveBreakpoint: number;
	maxAgentRows: number;
	todoTruncation: number;
}

interface StatuslineSettingsPanelProps {
	layout: SettingsPanelLayout;
	onChange: (layout: SettingsPanelLayout) => void;
	onSave: () => Promise<void>;
	onReset: () => void;
	saving: boolean;
	saveError: string | null;
	saveSuccess: boolean;
	saveDisabled?: boolean;
}

const BASE_MODES: StatuslineMode[] = ["full", "compact", "minimal", "none"];

const BASE_MODE_DESC_KEYS: Record<StatuslineMode, TranslationKey> = {
	full: "statuslineModeFullDesc",
	compact: "statuslineModeCompactDesc",
	minimal: "statuslineModeMinimalDesc",
	none: "statuslineModeNoneDesc",
};

export const StatuslineSettingsPanel: React.FC<StatuslineSettingsPanelProps> = ({
	layout,
	onChange,
	onSave,
	onReset,
	saving,
	saveError,
	saveSuccess,
	saveDisabled = false,
}) => {
	const { t } = useI18n();

	const handleBaseMode = (mode: StatuslineMode) => {
		onChange({ ...layout, baseMode: mode });
	};

	const handleBreakpoint = (e: React.ChangeEvent<HTMLInputElement>) => {
		onChange({ ...layout, responsiveBreakpoint: Number.parseFloat(e.target.value) });
	};

	const handleMaxAgentRows = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number.parseInt(e.target.value, 10);
		if (!Number.isNaN(val)) onChange({ ...layout, maxAgentRows: val });
	};

	const handleTodoTruncation = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number.parseInt(e.target.value, 10);
		if (!Number.isNaN(val)) onChange({ ...layout, todoTruncation: val });
	};

	return (
		<div className="space-y-5">
			{/* Base mode */}
			<div>
				<p className="block text-xs font-medium text-dash-text-muted mb-2 uppercase tracking-wider">
					{t("statuslineBaseMode")}
				</p>
				<div className="grid grid-cols-2 gap-2">
					{BASE_MODES.map((mode) => (
						<button
							key={mode}
							type="button"
							onClick={() => handleBaseMode(mode)}
							className={`text-xs px-3 py-2 rounded border transition-colors text-left ${
								layout.baseMode === mode
									? "border-dash-accent bg-dash-accent/10 text-dash-accent"
									: "border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover hover:text-dash-text"
							}`}
						>
							<div className="font-medium capitalize">{mode}</div>
							<div className="text-[10px] opacity-70 mt-0.5">{t(BASE_MODE_DESC_KEYS[mode])}</div>
						</button>
					))}
				</div>
			</div>

			{/* Responsive breakpoint */}
			<div>
				<div className="flex items-center justify-between mb-1">
					<label
						htmlFor="sl-breakpoint"
						className="text-xs font-medium text-dash-text-muted uppercase tracking-wider"
					>
						{t("statuslineBreakpoint")}
					</label>
					<span className="text-xs font-mono text-dash-accent">
						{Math.round(layout.responsiveBreakpoint * 100)}%
					</span>
				</div>
				<input
					id="sl-breakpoint"
					type="range"
					min="0.5"
					max="1.0"
					step="0.05"
					value={layout.responsiveBreakpoint}
					onChange={handleBreakpoint}
					className="w-full accent-dash-accent"
				/>
				<div className="flex justify-between text-[10px] text-dash-text-muted mt-0.5">
					<span>50%</span>
					<span>100%</span>
				</div>
			</div>

			{/* Max agent rows */}
			<div>
				<div className="flex items-center justify-between mb-1">
					<label
						htmlFor="sl-max-agents"
						className="text-xs font-medium text-dash-text-muted uppercase tracking-wider"
					>
						{t("statuslineMaxAgents")}
					</label>
					<span className="text-xs font-mono text-dash-accent">{layout.maxAgentRows}</span>
				</div>
				<input
					id="sl-max-agents"
					type="range"
					min="1"
					max="10"
					step="1"
					value={layout.maxAgentRows}
					onChange={handleMaxAgentRows}
					className="w-full accent-dash-accent"
				/>
				<div className="flex justify-between text-[10px] text-dash-text-muted mt-0.5">
					<span>1</span>
					<span>10</span>
				</div>
			</div>

			{/* Todo truncation */}
			<div>
				<div className="flex items-center justify-between mb-1">
					<label
						htmlFor="sl-todo-trunc"
						className="text-xs font-medium text-dash-text-muted uppercase tracking-wider"
					>
						{t("statuslineTodoTruncation")}
					</label>
					<span className="text-xs font-mono text-dash-accent">{layout.todoTruncation}</span>
				</div>
				<input
					id="sl-todo-trunc"
					type="range"
					min="20"
					max="100"
					step="5"
					value={layout.todoTruncation}
					onChange={handleTodoTruncation}
					className="w-full accent-dash-accent"
				/>
				<div className="flex justify-between text-[10px] text-dash-text-muted mt-0.5">
					<span>20</span>
					<span>100</span>
				</div>
			</div>

			{/* Save error */}
			{saveError && (
				<div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
					{t("statuslineSaveError")}: {saveError}
				</div>
			)}

			{/* Save success */}
			{saveSuccess && (
				<div className="text-xs text-green-400 bg-green-400/10 border border-green-400/20 rounded px-3 py-2">
					{t("statuslineSaved")}
				</div>
			)}

			{/* Action buttons */}
			<div className="flex gap-2 pt-1">
				<button
					type="button"
					onClick={onReset}
					className="flex-1 text-xs px-3 py-2 rounded border border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover hover:text-dash-text transition-colors"
				>
					{t("statuslineResetDefaults")}
				</button>
				<button
					type="button"
					onClick={onSave}
					disabled={saving || saveDisabled}
					className="flex-1 text-xs px-3 py-2 rounded border border-dash-accent bg-dash-accent/10 text-dash-accent hover:bg-dash-accent/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
				>
					{saving ? `${t("saving")}…` : t("statuslineSave")}
				</button>
			</div>
		</div>
	);
};
