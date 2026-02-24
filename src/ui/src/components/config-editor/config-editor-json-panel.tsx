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
	readOnly?: boolean;
	headerTitle?: string;
	headerPath?: string;
	headerActions?: React.ReactNode;
}

export const ConfigEditorJsonPanel: React.FC<ConfigEditorJsonPanelProps> = ({
	width,
	isLoading,
	jsonText,
	cursorLine,
	syntaxError,
	onChange,
	onCursorLineChange,
	readOnly = false,
	headerTitle,
	headerPath,
	headerActions,
}) => {
	const { t } = useI18n();
	const handleEditorWheelCapture = (event: React.WheelEvent<HTMLDivElement>) => {
		if (readOnly) return;
		const target = event.target as HTMLElement;
		if (!target.closest(".cm-editor")) return;
		const container = event.currentTarget;
		if (container.scrollHeight <= container.clientHeight) return;
		container.scrollTop += event.deltaY;
	};

	return (
		<div
			style={{ width: `${width}%` }}
			className="bg-dash-surface border border-dash-border rounded-xl overflow-hidden flex flex-col shadow-sm min-w-0 h-full"
		>
			<div className="p-3 border-b border-dash-border bg-dash-surface-hover/50 shrink-0">
				<div className="flex items-end justify-between gap-3">
					<div className="min-w-0">
						<h3 className="text-xs font-bold text-dash-text-secondary uppercase tracking-widest">
							{headerTitle ?? t("jsonTab")}
						</h3>
						{headerPath && (
							<p className="mt-1 mono text-[11px] text-dash-text-muted truncate">{headerPath}</p>
						)}
					</div>
					{headerActions && <div className="flex items-center gap-2 shrink-0">{headerActions}</div>}
				</div>
			</div>
			<div className="flex-1 min-h-0 overflow-auto" onWheelCapture={handleEditorWheelCapture}>
				{isLoading ? (
					<div className="h-full flex items-center justify-center">
						<div className="animate-pulse text-dash-text-muted text-sm">{t("loading")}</div>
					</div>
				) : readOnly ? (
					<pre className="h-full overflow-auto p-4 font-mono text-xs leading-4 text-dash-text whitespace-pre m-0">
						{jsonText}
					</pre>
				) : (
					<JsonEditor
						value={jsonText}
						onChange={onChange}
						onCursorLineChange={onCursorLineChange}
						readOnly={readOnly}
						className="[&_.cm-content]:text-xs [&_.cm-content]:leading-4 [&_.cm-gutters]:text-xs [&_.cm-gutters]:leading-4"
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
					{readOnly && <span>{t("readOnly")}</span>}
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
