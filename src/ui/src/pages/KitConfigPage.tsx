/**
 * KitConfigPage - Full .ck.json schema-driven config editor
 * Displays all settings in 7 collapsible sections with source indicators
 */
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { type ConfigSource, SchemaForm, type SectionConfig } from "../components/schema-form";
import { useI18n } from "../i18n";
import { fetchCkConfig, fetchCkConfigSchema, saveCkConfig } from "../services/ck-config-api";

/** Set nested value in object using dot-notation path */
function setNestedValue(
	obj: Record<string, unknown>,
	path: string,
	value: unknown,
): Record<string, unknown> {
	const result = { ...obj };
	const keys = path.split(".");
	let current: Record<string, unknown> = result;

	for (let i = 0; i < keys.length - 1; i++) {
		const key = keys[i];
		if (!(key in current) || typeof current[key] !== "object" || current[key] === null) {
			current[key] = {};
		} else {
			current[key] = { ...(current[key] as Record<string, unknown>) };
		}
		current = current[key] as Record<string, unknown>;
	}

	current[keys[keys.length - 1]] = value;
	return result;
}

const KitConfigPage: React.FC = () => {
	const { t } = useI18n();
	const navigate = useNavigate();
	const { projectId } = useParams<{ projectId?: string }>();

	// State
	const [schema, setSchema] = useState<Record<string, unknown> | null>(null);
	const [config, setConfig] = useState<Record<string, unknown>>({});
	const [sources, setSources] = useState<Record<string, ConfigSource>>({});
	const [scope, setScope] = useState<"global" | "project">("global");
	const [isLoading, setIsLoading] = useState(true);
	const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
	const [error, setError] = useState<string | null>(null);

	// Section configuration with i18n
	const sections: SectionConfig[] = [
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
				{
					path: "paths.docs",
					label: t("fieldDocsPath"),
					description: t("fieldDocsPathDesc"),
				},
				{
					path: "paths.plans",
					label: t("fieldPlansPath"),
					description: t("fieldPlansPathDesc"),
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
	];

	// Load data
	const loadData = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const [schemaData, configData] = await Promise.all([
				fetchCkConfigSchema(),
				fetchCkConfig(projectId),
			]);
			setSchema(schemaData);
			setConfig(configData.config);
			setSources(configData.sources);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load config");
		} finally {
			setIsLoading(false);
		}
	}, [projectId]);

	useEffect(() => {
		loadData();
	}, [loadData]);

	// Handle field change
	const handleChange = useCallback(
		(path: string, value: unknown) => {
			setConfig((prev) => setNestedValue(prev, path, value));
			// Update source to current scope when value changes
			setSources((prev) => ({ ...prev, [path]: scope }));
		},
		[scope],
	);

	// Handle save
	const handleSave = async () => {
		setSaveStatus("saving");
		try {
			await saveCkConfig({
				scope,
				projectId,
				config,
			});
			setSaveStatus("saved");
			setTimeout(() => setSaveStatus("idle"), 2000);
		} catch (err) {
			console.error("Save failed:", err);
			setSaveStatus("error");
			setTimeout(() => setSaveStatus("idle"), 3000);
		}
	};

	// Render loading state
	if (isLoading) {
		return (
			<div className="h-full flex items-center justify-center">
				<div className="animate-pulse text-dash-text-muted">{t("loading")}</div>
			</div>
		);
	}

	// Render error state
	if (error) {
		return (
			<div className="h-full flex flex-col items-center justify-center gap-4">
				<div className="text-red-500">{error}</div>
				<button
					onClick={loadData}
					className="px-4 py-2 bg-dash-accent text-white rounded-lg hover:bg-dash-accent-hover"
				>
					{t("tryAgain")}
				</button>
			</div>
		);
	}

	return (
		<div className="animate-in fade-in duration-300 w-full h-full flex flex-col">
			{/* Header */}
			<div className="flex items-center justify-between mb-6 shrink-0">
				<div className="flex items-center gap-3">
					<button
						onClick={() => navigate(-1)}
						className="px-2.5 py-1.5 rounded-lg bg-dash-surface hover:bg-dash-surface-hover border border-dash-border text-sm text-dash-text-secondary hover:text-dash-text flex items-center gap-1.5 group transition-all font-medium shadow-sm"
						title={t("backToDashboard")}
					>
						<svg
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
					<div>
						<h1 className="text-2xl font-bold tracking-tight text-dash-text">{t("kitConfig")}</h1>
						<p className="text-xs text-dash-text-muted mt-0.5">{t("kitConfigSubtitle")}</p>
					</div>
				</div>

				<div className="flex items-center gap-3">
					{/* Scope toggle */}
					<div className="flex items-center bg-dash-surface border border-dash-border rounded-lg overflow-hidden">
						<button
							onClick={() => setScope("global")}
							className={`px-3 py-2 text-xs font-bold transition-colors ${
								scope === "global"
									? "bg-dash-accent text-white"
									: "text-dash-text-muted hover:text-dash-text"
							}`}
						>
							{t("scopeGlobal")}
						</button>
						<button
							onClick={() => setScope("project")}
							disabled={!projectId}
							className={`px-3 py-2 text-xs font-bold transition-colors ${
								scope === "project"
									? "bg-dash-accent text-white"
									: "text-dash-text-muted hover:text-dash-text disabled:opacity-50"
							}`}
						>
							{t("scopeProject")}
						</button>
					</div>

					{/* Save button */}
					<button
						onClick={handleSave}
						disabled={saveStatus === "saving"}
						className={`px-4 py-2 rounded-lg text-xs font-bold transition-all tracking-widest uppercase ${
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

			{/* Form content */}
			<div className="flex-1 overflow-auto">
				{schema && (
					<SchemaForm
						schema={schema}
						value={config}
						sources={sources}
						sections={sections}
						onChange={handleChange}
					/>
				)}
			</div>
		</div>
	);
};

export default KitConfigPage;
