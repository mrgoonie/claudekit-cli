/**
 * Project config editor page - 3-column layout: Form | JSON | Help
 * Edits project/.claude/.ck.json with bidirectional sync between form and JSON
 */
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ResizeHandle from "../components/ResizeHandle";
import {
	ConfigEditorFormPanel,
	ConfigEditorHeader,
	ConfigEditorHelpPanel,
	ConfigEditorJsonPanel,
	DevelopmentBadge,
} from "../components/config-editor";
import type { SectionConfig } from "../components/schema-form";
import { useConfigEditor } from "../hooks/use-config-editor";
import { usePanelSizes } from "../hooks/use-panel-sizes-for-resizable-columns";
import { useI18n } from "../i18n";
import { fetchProjectConfig, fetchProjects, saveProjectConfig } from "../services/api";
import { fetchCkConfigSchema } from "../services/ck-config-api";
import { getNestedValue } from "../utils/config-editor-utils";

const ProjectConfigPage: React.FC = () => {
	const { t } = useI18n();
	const navigate = useNavigate();
	const { projectId } = useParams<{ projectId: string }>();

	// Project path resolved from project registry
	const [projectPath, setProjectPath] = useState<string | null>(null);

	// Resizable 3-column panels: Form (35%) | JSON (40%) | Help (25%)
	const { sizes, isDragging, startDrag } = usePanelSizes({
		storageKey: "claudekit-project-config-panels",
		defaultSizes: [35, 40, 25],
		minSizes: [20, 25, 15],
	});

	// Config editor hook with fetch callbacks
	const fetchConfig = useCallback(async () => {
		if (!projectId) throw new Error("No project ID");
		const [configData, projects] = await Promise.all([
			fetchProjectConfig(projectId),
			fetchProjects(),
		]);

		// Resolve project path from registry
		const matchedProject = projects.find((p) => p.id === projectId);
		if (matchedProject) {
			setProjectPath(matchedProject.path);
		}

		// Transform to expected shape
		return {
			config: configData.local || {},
			local: configData.local || {},
			global: configData.global || {},
			sources: Object.keys(configData.local || {}).reduce(
				(acc, key) => {
					acc[key] = "project";
					return acc;
				},
				{} as Record<string, "project">,
			),
		};
	}, [projectId]);

	const saveConfig = useCallback(
		async (config: Record<string, unknown>) => {
			if (!projectId) return;
			await saveProjectConfig(projectId, config);
		},
		[projectId],
	);

	const editor = useConfigEditor({
		scope: "project",
		projectId,
		fetchConfig,
		fetchSchema: fetchCkConfigSchema,
		saveConfig,
	});

	// Check if current field is overridden from global
	const isFieldOverridden = useCallback(
		(fieldPath: string): boolean => {
			const localVal = getNestedValue(editor.config, fieldPath);
			const globalVal = getNestedValue(editor.globalConfig, fieldPath);
			return localVal !== undefined && globalVal !== undefined && localVal !== globalVal;
		},
		[editor.config, editor.globalConfig],
	);

	// Section configuration for schema form (subset relevant to project config)
	const sections: SectionConfig[] = useMemo(
		() => [
			{
				id: "paths",
				title: t("sectionPaths"),
				fields: [
					{ path: "paths.docs", label: t("fieldDocsPath"), description: t("fieldDocsPathDesc") },
					{ path: "paths.plans", label: t("fieldPlansPath"), description: t("fieldPlansPathDesc") },
				],
			},
			{
				id: "project",
				title: t("sectionProject"),
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
				id: "privacy",
				title: t("sectionPrivacy"),
				defaultCollapsed: true,
				fields: [
					{
						path: "privacyBlock",
						label: t("fieldPrivacyBlock"),
						description: t("fieldPrivacyBlockDesc"),
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
				],
			},
		],
		[t],
	);

	// Override badge for help panel
	const overrideBadge =
		editor.activeFieldPath && isFieldOverridden(editor.activeFieldPath) ? (
			<span className="text-[9px] bg-orange-500/10 text-orange-500 px-1.5 py-0.5 rounded font-bold border border-orange-500/30">
				{t("localOverride")}
			</span>
		) : null;

	// Inheritance info for help panel
	const inheritanceInfo = editor.fieldDoc ? (
		<section className="bg-blue-500/5 p-3 rounded-lg border border-blue-500/20">
			<h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">
				{t("inheritedFromGlobal")}
			</h4>
			<p className="text-[12px] text-dash-text-secondary leading-normal">
				{t("viewGlobalConfig")}{" "}
				<button
					onClick={() => navigate("/config/global")}
					className="text-dash-accent hover:underline font-medium"
				>
					{t("globalConfig")}
				</button>
			</p>
		</section>
	) : null;

	return (
		<div className="animate-in fade-in duration-300 w-full h-full flex flex-col transition-colors">
			<ConfigEditorHeader
				title={t("projectConfig")}
				filePath={projectPath ? `${projectPath}/.claude/.ck.json` : ".claude/.ck.json"}
				onBack={() => navigate(`/project/${projectId}`)}
				onSave={editor.handleSave}
				onReset={editor.handleReset}
				saveStatus={editor.saveStatus}
				syntaxError={editor.syntaxError}
				showResetConfirm={editor.showResetConfirm}
				setShowResetConfirm={editor.setShowResetConfirm}
				badge={<DevelopmentBadge variant="development" />}
			/>

			{/* 3-Column Content with Resizable Panels */}
			<div className="flex-1 flex min-h-0">
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
					overrideBadge={overrideBadge}
					extraContent={inheritanceInfo}
				/>
			</div>
		</div>
	);
};

export default ProjectConfigPage;
