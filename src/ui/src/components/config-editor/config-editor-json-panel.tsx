/**
 * ConfigEditorJsonPanel - Center panel with JSON editor and status bar
 */
import type React from "react";
import { useI18n } from "../../i18n";
import JsonEditor from "../JsonEditor";

export interface ConfigEditorJsonPanelProps {
	width: number;
	isLoading: boolean;
	jsonText: string;
	cursorLine: number;
	syntaxError: string | null;
	onChange: (text: string) => void;
	onCursorLineChange: (line: number) => void;
}

export const ConfigEditorJsonPanel: React.FC<ConfigEditorJsonPanelProps> = ({
	width,
	isLoading,
	jsonText,
	cursorLine,
	syntaxError,
	onChange,
	onCursorLineChange,
}) => {
	const { t } = useI18n();

	return (
		<div
			style={{ width: `${width}%` }}
			className="bg-dash-surface border border-dash-border rounded-xl overflow-hidden flex flex-col shadow-sm min-w-0"
		>
			<div className="p-3 border-b border-dash-border bg-dash-surface-hover/50 shrink-0">
				<h3 className="text-xs font-bold text-dash-text-secondary uppercase tracking-widest">
					{t("jsonTab")}
				</h3>
			</div>
			<div className="flex-1 min-h-0 overflow-auto">
				{isLoading ? (
					<div className="h-full flex items-center justify-center">
						<div className="animate-pulse text-dash-text-muted text-sm">{t("loading")}</div>
					</div>
				) : (
					<JsonEditor
						value={jsonText}
						onChange={onChange}
						onCursorLineChange={onCursorLineChange}
					/>
				)}
			</div>
			<div className="px-4 py-2 bg-dash-surface-hover/30 border-t border-dash-border text-[10px] text-dash-text-muted flex justify-between uppercase tracking-widest font-bold">
				<div className="flex gap-4">
					<span>UTF-8</span>
					<span>JSON</span>
					<span>L:{cursorLine + 1}</span>
				</div>
				<div className="flex items-center gap-2">
					{syntaxError ? (
						<>
							<div className="w-1.5 h-1.5 rounded-full bg-red-500" />
							<span className="text-red-500 normal-case">{syntaxError}</span>
						</>
					) : (
						<>
							<div className="w-1.5 h-1.5 rounded-full bg-dash-accent" />
							{t("syntaxValid")}
						</>
					)}
				</div>
			</div>
		</div>
	);
};
