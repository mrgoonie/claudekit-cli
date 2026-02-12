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
					<div className="flex-1 min-h-0 overflow-auto pr-1">
						{editor.isLoading ? (
							<div className="dash-panel h-full flex items-center justify-center">
								<div className="animate-pulse text-dash-text-muted text-sm">{t("loading")}</div>
							</div>
						) : (
							<SystemDashboard metadata={metadata} />
						)}
					</div>
				)}
			</div>
		</div>
	);
};

export default GlobalConfigPage;
