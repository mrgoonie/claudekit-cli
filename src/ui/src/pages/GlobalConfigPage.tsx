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

const DEFAULT_FORM_PANEL_RATIO = 0.58;
const MIN_FORM_PANEL_PX = 280;
const MIN_TAXONOMY_PANEL_PX = 240;
const COLLAPSED_TAXONOMY_RESERVE_PX = 80;

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function normalizeStoredSplitRatio(storageKey: string, defaultRatio: number): number {
	if (typeof window === "undefined") return defaultRatio;

	const saved = localStorage.getItem(storageKey);
	if (!saved) return defaultRatio;

	const parsed = Number.parseFloat(saved);
	if (Number.isNaN(parsed)) return defaultRatio;

	if (parsed > 0 && parsed < 1) return parsed;

	if (parsed >= 1) {
		const estimatedContainerHeight = Math.max(
			window.innerHeight - 220,
			parsed + MIN_TAXONOMY_PANEL_PX,
		);
		return Math.min(0.75, Math.max(0.35, parsed / estimatedContainerHeight));
	}

	return defaultRatio;
}

/** Vertical resize — ratio-based and responsive across viewport changes. */
function useVerticalSplitResize(
	storageKey: string,
	defaultRatio: number,
	minTopPx: number,
	minBottomPx: number,
) {
	const [topRatio, setTopRatio] = useState(() => {
		if (typeof window === "undefined") return defaultRatio;
		return normalizeStoredSplitRatio(storageKey, defaultRatio);
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
				const height = rect.height || 1;
				const ratio = (moveEvent.clientY - rect.top) / height;
				const minRatio = minTopPx / height;
				const maxRatio = Math.max(minRatio, 1 - minBottomPx / height);
				setTopRatio(Math.max(minRatio, Math.min(maxRatio, ratio)));
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
		[minBottomPx, minTopPx],
	);

	useEffect(() => {
		localStorage.setItem(storageKey, String(topRatio));
	}, [storageKey, topRatio]);

	return { topRatio, isDragging, startDrag };
}

function useElementHeight<T extends HTMLElement>() {
	const [element, setElement] = useState<T | null>(null);
	const [height, setHeight] = useState(0);

	const ref = useCallback((node: T | null) => {
		setElement(node);
	}, []);

	useEffect(() => {
		if (!element) return;

		const updateHeight = () => {
			setHeight(element.getBoundingClientRect().height);
		};

		updateHeight();

		if (typeof ResizeObserver === "undefined") return;

		const observer = new ResizeObserver(() => {
			updateHeight();
		});
		observer.observe(element);

		return () => observer.disconnect();
	}, [element]);

	return { ref, height };
}

const GlobalConfigPage: React.FC = () => {
	const { t } = useI18n();
	const navigate = useNavigate();

	const [formNaturalHeight, setFormNaturalHeight] = useState(MIN_FORM_PANEL_PX);
	const [isTaxonomyCollapsed, setIsTaxonomyCollapsed] = useState(false);

	// Resizable 3-column panels: Form (35%) | JSON (40%) | Help (25%)
	const { sizes, isDragging, startDrag } = usePanelSizes({
		storageKey: "claudekit-global-config-panels",
		defaultSizes: [35, 40, 25],
		minSizes: [20, 25, 15],
	});

	// Vertical resize: form panel gets fixed pixel height, taxonomy gets remainder
	const formTaxonomy = useVerticalSplitResize(
		"claudekit-form-taxonomy-px",
		DEFAULT_FORM_PANEL_RATIO,
		MIN_FORM_PANEL_PX,
		MIN_TAXONOMY_PANEL_PX,
	);
	const { ref: leftColumnRef, height: leftColumnHeight } = useElementHeight<HTMLDivElement>();

	// Config editor hook with fetch callbacks
	const fetchConfig = useCallback(async () => {
		return await fetchCkConfig();
	}, []);

	const saveConfig = useCallback(async (config: Record<string, unknown>) => {
		const result = await saveCkConfig({ scope: "global", config });
		return result.config;
	}, []);

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
						path: "statuslineQuota",
						label: t("fieldStatuslineQuota"),
						description: t("fieldStatuslineQuotaDesc"),
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
						editable: true,
						enumLabels: {
							"gemini-2.5-flash": t("geminiModel25Flash"),
							"gemini-2.5-pro": t("geminiModel25Pro"),
							"gemini-3-flash-preview": t("geminiModel3FlashPreview"),
							"gemini-3-pro-preview": t("geminiModel3ProPreview"),
						},
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
						path: "hooks.post-edit-simplify-reminder",
						label: t("fieldHookPostEditSimplify"),
						description: t("fieldHookPostEditSimplifyDesc"),
					},
				],
			},
			{
				id: "updatePipeline",
				title: t("sectionUpdatePipeline"),
				defaultCollapsed: true,
				fields: [
					{
						path: "updatePipeline.autoInitAfterUpdate",
						label: t("fieldAutoInitAfterUpdate"),
						description: t("fieldAutoInitAfterUpdateDesc"),
					},
					{
						path: "updatePipeline.autoMigrateAfterUpdate",
						label: t("fieldAutoMigrateAfterUpdate"),
						description: t("fieldAutoMigrateAfterUpdateDesc"),
					},
					{
						path: "updatePipeline.migrateProviders",
						label: t("fieldMigrateProviders"),
						description: t("fieldMigrateProvidersDesc"),
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

	const preferredFormHeight = useMemo(() => {
		if (leftColumnHeight <= 0) return null;
		const maxHeight = Math.max(MIN_FORM_PANEL_PX, leftColumnHeight - MIN_TAXONOMY_PANEL_PX);

		return clamp(formTaxonomy.topRatio * leftColumnHeight, MIN_FORM_PANEL_PX, maxHeight);
	}, [formTaxonomy.topRatio, leftColumnHeight]);

	const formPanelHeight = useMemo(() => {
		if (isTaxonomyCollapsed || preferredFormHeight === null) return null;
		return Math.min(preferredFormHeight, formNaturalHeight);
	}, [formNaturalHeight, isTaxonomyCollapsed, preferredFormHeight]);

	const collapsedFormPanelHeight = useMemo(() => {
		if (!isTaxonomyCollapsed || leftColumnHeight <= 0) return null;
		const maxHeight = Math.max(MIN_FORM_PANEL_PX, leftColumnHeight - COLLAPSED_TAXONOMY_RESERVE_PX);

		return Math.min(formNaturalHeight, maxHeight);
	}, [formNaturalHeight, isTaxonomyCollapsed, leftColumnHeight]);

	const activeFormPanelHeight = isTaxonomyCollapsed ? collapsedFormPanelHeight : formPanelHeight;

	const shouldShowVerticalSplit =
		!editor.isLoading && !isTaxonomyCollapsed && formPanelHeight !== null;

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

			{/* Header hint */}
			<div className="mb-3 shrink-0 flex items-center justify-end">
				<p className="hidden lg:block text-xs text-dash-text-muted">{t("configWorkspaceHint")}</p>
			</div>

			{/* Content area — config editor only (System moved to /) */}
			<div className="flex-1 flex min-h-0">
				<div
					ref={leftColumnRef}
					data-vresize-container
					style={{ width: `${sizes[0]}%` }}
					className="flex flex-col min-w-0 min-h-0 h-full"
				>
					<div
						style={
							activeFormPanelHeight !== null ? { height: `${activeFormPanelHeight}px` } : undefined
						}
						className={`min-h-0 ${activeFormPanelHeight !== null ? "shrink-0" : "flex-1"}`}
					>
						<ConfigEditorFormPanel
							width={100}
							isLoading={editor.isLoading}
							schema={editor.schema}
							config={editor.config}
							sources={editor.sources}
							sections={sections}
							onChange={editor.handleFormChange}
							onFieldFocus={editor.setFocusedFieldPath}
							onNaturalHeightChange={setFormNaturalHeight}
						/>
					</div>
					{!editor.isLoading && (
						<>
							{isTaxonomyCollapsed && activeFormPanelHeight !== null && <div className="flex-1" />}
							{shouldShowVerticalSplit && (
								<ResizeHandle
									direction="vertical"
									isDragging={formTaxonomy.isDragging}
									onMouseDown={formTaxonomy.startDrag}
								/>
							)}
							<div className={isTaxonomyCollapsed ? "shrink-0" : "flex-1 min-h-0 overflow-hidden"}>
								<ModelTaxonomyEditor
									config={editor.config}
									onChange={editor.handleFormChange}
									isCollapsed={isTaxonomyCollapsed}
									onCollapsedChange={setIsTaxonomyCollapsed}
								/>
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
					onEditorFocus={editor.handleJsonEditorFocus}
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
			</div>
		</div>
	);
};

export default GlobalConfigPage;
