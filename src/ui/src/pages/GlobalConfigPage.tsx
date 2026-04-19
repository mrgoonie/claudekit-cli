/**
 * Global config editor page - unified 3-column layout: Form | JSON | Help
 * Edits ~/.claude/.ck.json with bidirectional sync between form and JSON
 */
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ResizeHandle from "../components/ResizeHandle";
import {
	ConfigEditorFormPanel,
	ConfigEditorHeader,
	ConfigEditorHelpPanel,
	ConfigEditorJsonPanel,
} from "../components/config-editor";
import ModelTaxonomyEditor from "../components/model-taxonomy-editor";
import type { SectionConfig } from "../components/schema-form";
import { useConfigEditor } from "../hooks/use-config-editor";
import { usePanelSizes } from "../hooks/use-panel-sizes-for-resizable-columns";
import { useI18n } from "../i18n";
import { fetchCkConfig, fetchCkConfigSchema, saveCkConfig } from "../services/ck-config-api";

/** Vertical resize between two panels (percentage-based, persisted) */
function useVerticalResize(
	storageKey: string,
	defaultTop: number,
	minTop: number,
	minBottom: number,
) {
	const [topPct, setTopPct] = useState(() => {
		if (typeof window === "undefined") return defaultTop;
		const saved = localStorage.getItem(storageKey);
		if (saved) {
			const n = Number.parseFloat(saved);
			if (!Number.isNaN(n) && n >= minTop && n <= 100 - minBottom) return n;
		}
		return defaultTop;
	});
	const [isDragging, setIsDragging] = useState(false);

	const startDrag = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			setIsDragging(true);
			const container = (e.target as HTMLElement).closest(
				"[data-vresize-container]",
			) as HTMLElement;
			if (!container) return;

			const handleMouseMove = (moveEvent: MouseEvent) => {
				const rect = container.getBoundingClientRect();
				const pct = ((moveEvent.clientY - rect.top) / rect.height) * 100;
				setTopPct(Math.max(minTop, Math.min(100 - minBottom, pct)));
			};
			const handleMouseUp = () => {
				setIsDragging(false);
				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
			};
			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
			document.body.style.cursor = "row-resize";
			document.body.style.userSelect = "none";
		},
		[minTop, minBottom],
	);

	useEffect(() => {
		localStorage.setItem(storageKey, String(topPct));
	}, [storageKey, topPct]);

	return { topPct, isDragging, startDrag };
}

const GlobalConfigPage: React.FC = () => {
	const { t } = useI18n();
	const navigate = useNavigate();

	// Resizable 3-column panels: Form (35%) | JSON (40%) | Help (25%)
	const { sizes, isDragging, startDrag } = usePanelSizes({
		storageKey: "claudekit-global-config-panels",
		defaultSizes: [35, 40, 25],
		minSizes: [20, 25, 15],
	});

	// Vertical resize between Form panel and Model Taxonomy
	const formTaxonomy = useVerticalResize("claudekit-form-taxonomy-split", 70, 25, 15);

	// Config editor hook with fetch callbacks
	const fetchConfig = useCallback(async () => {
		return await fetchCkConfig();
	}, []);

	const saveConfig = useCallback(
		async (config: Record<string, unknown>): Promise<Record<string, unknown> | undefined> => {
			await saveCkConfig({ scope: "global", config });
			return undefined;
		},
		[],
	);

	const onReset = useCallback(async () => {
		return await fetchCkConfig();
	}, []);

	const editor = useConfigEditor({
		scope: "global",
		fetchConfig,
		fetchSchema: fetchCkConfigSchema,
		saveConfig,
		onReset,
	});

	// Section configuration for schema form
	const sections: SectionConfig[] = useMemo(
		() => [
			{
				id: "general",
				title: t("sectionGeneral"),
				fields: [
					{
						path: "codingLevel",
						label: t("fieldCodingLevel"),
						description: t("fieldCodingLevelDesc"),
					},
					{
						path: "statusline",
						label: t("fieldStatusline"),
						description: t("fieldStatuslineDesc"),
					},
					{
						path: "statuslineColors",
						label: t("fieldStatuslineColors"),
						description: t("fieldStatuslineColorsDesc"),
					},
					{
						path: "locale.thinkingLanguage",
						label: t("fieldThinkingLanguage"),
						description: t("fieldThinkingLanguageDesc"),
					},
					{
						path: "locale.responseLanguage",
						label: t("fieldResponseLanguage"),
						description: t("fieldResponseLanguageDesc"),
					},
				],
			},
			{
				id: "paths",
				title: t("sectionPaths"),
				fields: [
					{ path: "paths.docs", label: t("fieldDocsPath"), description: t("fieldDocsPathDesc") },
					{ path: "paths.plans", label: t("fieldPlansPath"), description: t("fieldPlansPathDesc") },
					{
						path: "paths.globalPlans",
						label: t("fieldGlobalPlansPath"),
						description: t("fieldGlobalPlansPathDesc"),
					},
				],
			},
			{
				id: "privacy",
				title: t("sectionPrivacy"),
				defaultCollapsed: true,
				fields: [
					{
						path: "privacyBlock",
						label: t("fieldPrivacyBlock"),
						description: t("fieldPrivacyBlockDesc"),
					},
					{
						path: "trust.enabled",
						label: t("fieldTrustEnabled"),
						description: t("fieldTrustEnabledDesc"),
					},
					{
						path: "trust.passphrase",
						label: t("fieldTrustPassphrase"),
						description: t("fieldTrustPassphraseDesc"),
					},
				],
			},
			{
				id: "project",
				title: t("sectionProject"),
				defaultCollapsed: true,
				fields: [
					{
						path: "project.type",
						label: t("fieldProjectType"),
						description: t("fieldProjectTypeDesc"),
					},
					{
						path: "project.packageManager",
						label: t("fieldPackageManager"),
						description: t("fieldPackageManagerDesc"),
					},
					{
						path: "project.framework",
						label: t("fieldFramework"),
						description: t("fieldFrameworkDesc"),
					},
				],
			},
			{
				id: "integrations",
				title: t("sectionIntegrations"),
				defaultCollapsed: true,
				fields: [
					{
						path: "gemini.model",
						label: t("fieldGeminiModel"),
						description: t("fieldGeminiModelDesc"),
					},
					{
						path: "skills.research.useGemini",
						label: t("fieldResearchUseGemini"),
						description: t("fieldResearchUseGeminiDesc"),
					},
				],
			},
			{
				id: "hooks",
				title: t("sectionHooks"),
				defaultCollapsed: true,
				fields: [
					{
						path: "hooks.session-init",
						label: t("fieldHookSessionInit"),
						description: t("fieldHookSessionInitDesc"),
					},
					{
						path: "hooks.subagent-init",
						label: t("fieldHookSubagentInit"),
						description: t("fieldHookSubagentInitDesc"),
					},
					{
						path: "hooks.descriptive-name",
						label: t("fieldHookDescriptiveName"),
						description: t("fieldHookDescriptiveNameDesc"),
					},
					{
						path: "hooks.dev-rules-reminder",
						label: t("fieldHookDevRulesReminder"),
						description: t("fieldHookDevRulesReminderDesc"),
					},
					{
						path: "hooks.usage-context-awareness",
						label: t("fieldHookUsageContextAwareness"),
						description: t("fieldHookUsageContextAwarenessDesc"),
					},
					{
						path: "hooks.context-tracking",
						label: t("fieldHookContextTracking"),
						description: t("fieldHookContextTrackingDesc"),
					},
					{
						path: "hooks.scout-block",
						label: t("fieldHookScoutBlock"),
						description: t("fieldHookScoutBlockDesc"),
					},
					{
						path: "hooks.privacy-block",
						label: t("fieldHookPrivacyBlock"),
						description: t("fieldHookPrivacyBlockDesc"),
					},
					{
						path: "hooks.simplify-gate",
						label: t("fieldHookSimplifyGate"),
						description: t("fieldHookSimplifyGateDesc"),
					},
				],
			},
			{
				id: "simplify",
				title: t("sectionSimplify"),
				defaultCollapsed: true,
				fields: [
					{
						path: "simplify.threshold.locDelta",
						label: t("fieldSimplifyThresholdLocDelta"),
						description: t("fieldSimplifyThresholdLocDeltaDesc"),
					},
					{
						path: "simplify.threshold.fileCount",
						label: t("fieldSimplifyThresholdFileCount"),
						description: t("fieldSimplifyThresholdFileCountDesc"),
					},
					{
						path: "simplify.threshold.singleFileLoc",
						label: t("fieldSimplifyThresholdSingleFileLoc"),
						description: t("fieldSimplifyThresholdSingleFileLocDesc"),
					},
					{
						path: "simplify.gate.enabled",
						label: t("fieldSimplifyGateEnabled"),
						description: t("fieldSimplifyGateEnabledDesc"),
					},
					{
						path: "simplify.gate.hardVerbs",
						label: t("fieldSimplifyGateHardVerbs"),
						description: t("fieldSimplifyGateHardVerbsDesc"),
					},
					{
						path: "simplify.gate.softVerbs",
						label: t("fieldSimplifyGateSoftVerbs"),
						description: t("fieldSimplifyGateSoftVerbsDesc"),
					},
				],
			},
			{
				id: "advanced",
				title: t("sectionAdvanced"),
				defaultCollapsed: true,
				fields: [
					{
						path: "docs.maxLoc",
						label: t("fieldDocsMaxLoc"),
						description: t("fieldDocsMaxLocDesc"),
					},
					{
						path: "plan.namingFormat",
						label: t("fieldPlanNamingFormat"),
						description: t("fieldPlanNamingFormatDesc"),
					},
					{
						path: "plan.dateFormat",
						label: t("fieldPlanDateFormat"),
						description: t("fieldPlanDateFormatDesc"),
					},
					{
						path: "plan.validation.mode",
						label: t("fieldPlanValidationMode"),
						description: t("fieldPlanValidationModeDesc"),
					},
					{
						path: "plan.validation.minQuestions",
						label: t("fieldPlanMinQuestions"),
						description: t("fieldPlanMinQuestionsDesc"),
					},
					{
						path: "plan.validation.maxQuestions",
						label: t("fieldPlanMaxQuestions"),
						description: t("fieldPlanMaxQuestionsDesc"),
					},
					{
						path: "assertions",
						label: t("fieldAssertions"),
						description: t("fieldAssertionsDesc"),
					},
				],
			},
		],
		[t],
	);

	const configJsonHeaderActions = editor.showResetConfirm ? (
		<div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-2 py-1 animate-in fade-in duration-200">
			<span className="text-xs text-red-500 font-medium">{t("confirmReset")}</span>
			<button
				type="button"
				onClick={editor.handleReset}
				className="px-2 py-0.5 rounded bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors"
			>
				{t("confirm")}
			</button>
			<button
				type="button"
				onClick={() => editor.setShowResetConfirm(false)}
				className="px-2 py-0.5 rounded bg-dash-surface text-dash-text-secondary text-xs font-bold hover:bg-dash-surface-hover transition-colors border border-dash-border"
			>
				{t("cancel")}
			</button>
		</div>
	) : (
		<>
			<button
				type="button"
				onClick={() => editor.setShowResetConfirm(true)}
				className="px-3 py-1.5 rounded-lg bg-dash-surface text-xs font-bold text-dash-text-secondary hover:bg-dash-surface-hover transition-colors border border-dash-border"
			>
				{t("resetToDefault")}
			</button>
			<button
				type="button"
				onClick={editor.handleSave}
				disabled={!!editor.syntaxError || editor.saveStatus === "saving"}
				className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all tracking-widest uppercase ${
					editor.syntaxError
						? "bg-dash-surface text-dash-text-muted cursor-not-allowed border border-dash-border"
						: editor.saveStatus === "saved"
							? "bg-green-500 text-white shadow-lg shadow-green-500/20"
							: editor.saveStatus === "error"
								? "bg-red-500 text-white"
								: "bg-dash-accent text-dash-bg hover:bg-dash-accent-hover shadow-lg shadow-dash-accent/20"
				}`}
			>
				{editor.saveStatus === "saving"
					? t("saving")
					: editor.saveStatus === "saved"
						? t("saved")
						: editor.saveStatus === "error"
							? t("saveFailed")
							: t("saveChanges")}
			</button>
		</>
	);

	return (
		<div className="animate-in fade-in duration-300 w-full h-full flex flex-col transition-colors">
			<ConfigEditorHeader
				title={t("globalConfig")}
				filePath="~/.claude/.ck.json"
				onBack={() => navigate(-1)}
				onSave={editor.handleSave}
				onReset={editor.handleReset}
				saveStatus={editor.saveStatus}
				syntaxError={editor.syntaxError}
				showResetConfirm={editor.showResetConfirm}
				setShowResetConfirm={editor.setShowResetConfirm}
				showActions={false}
				showFilePath={false}
			/>

			{/* Load error banner — surfaces fetchConfig failures (e.g. Tauri invoke errors) */}
			{!editor.isLoading && editor.loadError && (
				<div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-500">
					<p className="font-medium">{t("configLoadFailed")}</p>
					<p className="mt-1 break-words">
						{t("configLoadFailedDetail")} {editor.loadError}
					</p>
				</div>
			)}

			{/* Tab Bar */}
			{/* Content area — config editor only (System moved to / home dashboard) */}
			<div className="flex-1 flex min-h-0">
				<>
					<div
						data-vresize-container
						style={{ width: `${sizes[0]}%` }}
						className="flex flex-col min-w-0 min-h-0"
					>
						<div
							style={{ height: `${editor.isLoading ? 100 : formTaxonomy.topPct}%` }}
							className="min-h-0"
						>
							<ConfigEditorFormPanel
								width={100}
								isLoading={editor.isLoading}
								schema={editor.schema}
								config={editor.config}
								sources={editor.sources}
								sections={sections}
								onChange={editor.handleFormChange}
							/>
						</div>
						{!editor.isLoading && (
							<>
								<ResizeHandle
									direction="vertical"
									isDragging={formTaxonomy.isDragging}
									onMouseDown={formTaxonomy.startDrag}
								/>
								<div style={{ height: `${100 - formTaxonomy.topPct}%` }} className="min-h-0">
									<ModelTaxonomyEditor config={editor.config} onChange={editor.handleFormChange} />
								</div>
							</>
						)}
					</div>

					<ResizeHandle
						direction="horizontal"
						isDragging={isDragging}
						onMouseDown={(e) => startDrag(0, e)}
					/>

					<ConfigEditorJsonPanel
						width={sizes[1]}
						isLoading={editor.isLoading}
						jsonText={editor.jsonText}
						cursorLine={editor.cursorLine}
						syntaxError={editor.syntaxError}
						onChange={editor.handleJsonChange}
						onCursorLineChange={editor.setCursorLine}
						headerPath="~/.claude/.ck.json"
						headerActions={configJsonHeaderActions}
					/>

					<ResizeHandle
						direction="horizontal"
						isDragging={isDragging}
						onMouseDown={(e) => startDrag(1, e)}
					/>

					<ConfigEditorHelpPanel
						width={sizes[2]}
						fieldDoc={editor.fieldDoc}
						activeFieldPath={editor.activeFieldPath}
					/>
				</>
			</div>
		</div>
	);
};

export default GlobalConfigPage;
