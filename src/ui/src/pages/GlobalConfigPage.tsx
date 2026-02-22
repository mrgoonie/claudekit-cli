/**
 * Global config editor page - unified 3-column layout: Form | JSON | Help
 * Edits ~/.claude/.ck.json with bidirectional sync between form and JSON
 */
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ResizeHandle from "../components/ResizeHandle";
import {
	ConfigEditorFormPanel,
	ConfigEditorHeader,
	ConfigEditorHelpPanel,
	ConfigEditorJsonPanel,
} from "../components/config-editor";
import type { SectionConfig } from "../components/schema-form";
import SystemDashboard from "../components/system-dashboard";
import SystemSettingsJsonCard from "../components/system-settings-json-card";
import { useConfigEditor } from "../hooks/use-config-editor";
import { usePanelSizes } from "../hooks/use-panel-sizes-for-resizable-columns";
import { useI18n } from "../i18n";
import { fetchGlobalMetadata } from "../services/api";
import { fetchCkConfig, fetchCkConfigSchema, saveCkConfig } from "../services/ck-config-api";

const GlobalConfigPage: React.FC = () => {
	const { t } = useI18n();
	const navigate = useNavigate();

	// Tab state: config (3-column) or metadata (full-width)
	const [activeTab, setActiveTab] = useState<"config" | "metadata">("config");
	const [metadata, setMetadata] = useState<Record<string, unknown>>({});

	// Resizable 3-column panels: Form (35%) | JSON (40%) | Help (25%)
	const { sizes, isDragging, startDrag } = usePanelSizes({
		storageKey: "claudekit-global-config-panels",
		defaultSizes: [35, 40, 25],
		minSizes: [20, 25, 15],
	});

	// Resizable 2-column panels for System tab: Dashboard | Settings JSON
	const {
		sizes: systemSizes,
		isDragging: isSystemDragging,
		startDrag: startSystemDrag,
	} = usePanelSizes({
		storageKey: "claudekit-global-system-panels",
		defaultSizes: [70, 30],
		minSizes: [45, 20],
	});

	// Config editor hook with fetch callbacks
	const fetchConfig = useCallback(async () => {
		const [configData, metadataData] = await Promise.all([fetchCkConfig(), fetchGlobalMetadata()]);
		setMetadata(metadataData);
		return configData;
	}, []);

	const saveConfig = useCallback(async (config: Record<string, unknown>) => {
		await saveCkConfig({ scope: "global", config });
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

			{/* Tab Bar */}
			<div className="mb-3 shrink-0 flex items-center justify-between gap-3">
				<div
					role="tablist"
					aria-label={t("globalConfig")}
					className="inline-flex items-center rounded-xl border border-dash-border bg-dash-surface p-1 shadow-sm"
				>
					<button
						role="tab"
						aria-selected={activeTab === "config"}
						onClick={() => setActiveTab("config")}
						className={`dash-focus-ring px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
							activeTab === "config"
								? "bg-dash-accent-subtle text-dash-accent"
								: "text-dash-text-muted hover:text-dash-text hover:bg-dash-surface-hover"
						}`}
					>
						{t("configTab")}
					</button>
					<button
						role="tab"
						aria-selected={activeTab === "metadata"}
						onClick={() => setActiveTab("metadata")}
						className={`dash-focus-ring px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
							activeTab === "metadata"
								? "bg-dash-accent-subtle text-dash-accent"
								: "text-dash-text-muted hover:text-dash-text hover:bg-dash-surface-hover"
						}`}
					>
						{t("systemTab")}
					</button>
				</div>
				<p className="hidden lg:block text-xs text-dash-text-muted">{t("configWorkspaceHint")}</p>
			</div>

			{/* Content area */}
			<div className="flex-1 flex min-h-0">
				{activeTab === "config" && (
					<>
						<ConfigEditorFormPanel
							width={sizes[0]}
							isLoading={editor.isLoading}
							schema={editor.schema}
							config={editor.config}
							sources={editor.sources}
							sections={sections}
							onChange={editor.handleFormChange}
						/>

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
				)}

				{activeTab === "metadata" && (
					<div className="flex-1 min-h-0 flex">
						<div
							style={{ width: `${systemSizes[0]}%` }}
							className="min-w-0 h-full overflow-auto pr-1"
						>
							{editor.isLoading ? (
								<div className="dash-panel h-full flex items-center justify-center">
									<div className="animate-pulse text-dash-text-muted text-sm">{t("loading")}</div>
								</div>
							) : (
								<SystemDashboard metadata={metadata} />
							)}
						</div>

						<ResizeHandle
							direction="horizontal"
							isDragging={isSystemDragging}
							onMouseDown={(e) => startSystemDrag(0, e)}
						/>

						<div style={{ width: `${systemSizes[1]}%` }} className="min-w-0 h-full overflow-hidden">
							<SystemSettingsJsonCard />
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default GlobalConfigPage;
