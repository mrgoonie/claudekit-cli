/**
 * SystemSettingsJsonCard - Read-only viewer for ~/.claude/settings.json
 * Reuses Config tab JSON panel for consistent UX.
 */
import type React from "react";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { fetchSettingsFile, saveSettingsFile } from "../services/api";
import { ConfigEditorJsonPanel } from "./config-editor";

const SETTINGS_FALLBACK_PATH = "~/.claude/settings.json";
const EMPTY_JSON_TEXT = "{}";

const SystemSettingsJsonCard: React.FC = () => {
	const { t } = useI18n();
	const [isLoading, setIsLoading] = useState(true);
	const [settingsPath, setSettingsPath] = useState(SETTINGS_FALLBACK_PATH);
	const [originalJsonText, setOriginalJsonText] = useState(EMPTY_JSON_TEXT);
	const [settingsJsonText, setSettingsJsonText] = useState(EMPTY_JSON_TEXT);
	const [cursorLine, setCursorLine] = useState(0);
	const [exists, setExists] = useState(false);
	const [loadFailed, setLoadFailed] = useState(false);
	const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
	const [syntaxError, setSyntaxError] = useState<string | null>(null);
	const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		const loadSettings = async () => {
			setIsLoading(true);
			setLoadFailed(false);

			try {
				const data = await fetchSettingsFile();
				if (cancelled) return;
				const normalized = JSON.stringify(data.settings ?? {}, null, 2);
				setSettingsPath(data.path || SETTINGS_FALLBACK_PATH);
				setExists(Boolean(data.exists));
				setOriginalJsonText(normalized);
				setSettingsJsonText(normalized);
				setSyntaxError(null);
			} catch {
				if (cancelled) return;
				setLoadFailed(true);
				setExists(false);
				setSettingsPath(SETTINGS_FALLBACK_PATH);
				setOriginalJsonText(EMPTY_JSON_TEXT);
				setSettingsJsonText(EMPTY_JSON_TEXT);
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		};

		void loadSettings();

		return () => {
			cancelled = true;
		};
	}, []);

	const handleJsonChange = (text: string) => {
		setSettingsJsonText(text);
		setSaveFeedback(null);
		try {
			JSON.parse(text);
			setSyntaxError(null);
		} catch (error) {
			setSyntaxError(error instanceof Error ? error.message : "Invalid JSON");
		}
	};

	const handleReset = () => {
		setSettingsJsonText(originalJsonText);
		setSyntaxError(null);
		setSaveFeedback(null);
		setSaveStatus("idle");
	};

	const handleSave = async () => {
		if (isLoading || syntaxError) return;
		setSaveStatus("saving");
		setSaveFeedback(null);

		try {
			const parsed = JSON.parse(settingsJsonText) as Record<string, unknown>;
			const normalized = JSON.stringify(parsed, null, 2);
			const result = await saveSettingsFile(parsed);
			setOriginalJsonText(normalized);
			setSettingsJsonText(normalized);
			setExists(true);
			setSaveStatus("saved");
			setSaveFeedback(
				result.backupPath ? `${t("settingsBackupSaved")}: ${result.backupPath}` : t("saved"),
			);
			setTimeout(() => setSaveStatus("idle"), 2000);
		} catch (error) {
			setSaveStatus("error");
			setSaveFeedback(error instanceof Error ? error.message : t("saveFailed"));
			setTimeout(() => setSaveStatus("idle"), 3000);
		}
	};

	const hasChanges = settingsJsonText !== originalJsonText;

	return (
		<section className="h-full min-h-0 flex flex-col rounded-xl border border-dash-border bg-dash-surface p-3 shadow-sm">
			<div className="mb-2 flex items-end justify-between gap-3 px-1">
				<div className="min-w-0">
					<h3 className="text-sm font-semibold uppercase tracking-wide text-dash-text">
						{t("settingsJsonHeading")}
					</h3>
					<p className="mono text-[11px] text-dash-text-muted truncate">{settingsPath}</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={handleReset}
						disabled={isLoading || !hasChanges || saveStatus === "saving"}
						className="px-3 py-1.5 rounded-lg bg-dash-surface text-xs font-bold text-dash-text-secondary hover:bg-dash-surface-hover transition-colors border border-dash-border disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{t("discard")}
					</button>
					<button
						type="button"
						onClick={handleSave}
						disabled={isLoading || saveStatus === "saving" || !!syntaxError || !hasChanges}
						className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all tracking-widest uppercase disabled:opacity-50 disabled:cursor-not-allowed ${
							saveStatus === "saved"
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

			<div className="flex-1 min-h-0">
				<ConfigEditorJsonPanel
					width={100}
					isLoading={isLoading}
					jsonText={settingsJsonText}
					cursorLine={cursorLine}
					syntaxError={syntaxError}
					onChange={handleJsonChange}
					onCursorLineChange={setCursorLine}
				/>
			</div>

			{saveFeedback && (
				<p
					className={`mt-2 px-1 text-xs ${saveStatus === "error" ? "text-red-500" : "text-dash-text-muted"}`}
				>
					{saveFeedback}
				</p>
			)}

			{!isLoading && !loadFailed && !exists && (
				<p className="mt-2 px-1 text-xs text-dash-text-muted">{t("settingsJsonMissing")}</p>
			)}

			{!isLoading && loadFailed && (
				<p className="mt-2 px-1 text-xs text-red-500">{t("settingsJsonLoadFailed")}</p>
			)}
		</section>
	);
};

export default SystemSettingsJsonCard;
