/**
 * Project config editor page - 3-column layout: Form | JSON | Help
 * Edits project/.claude/.ck.json with bidirectional sync between form and JSON
 * Mirrors GlobalConfigPage structure for consistency
 */
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import JsonEditor from "../components/JsonEditor";
import ResizeHandle from "../components/ResizeHandle";
import { type ConfigSource, SchemaForm, type SectionConfig } from "../components/schema-form";
import { useFieldAtLine } from "../hooks/useFieldAtLine";
import { usePanelSizes } from "../hooks/use-panel-sizes-for-resizable-columns";
import { useI18n } from "../i18n";
import { fetchProjectConfig, saveProjectConfig } from "../services/api";
import { fetchCkConfigSchema } from "../services/ck-config-api";
import { CONFIG_FIELD_DOCS } from "../services/configFieldDocs";

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

const ProjectConfigPage: React.FC = () => {
	const { t, lang } = useI18n();
	const navigate = useNavigate();
	const { projectId } = useParams<{ projectId: string }>();

	// JSON editor state
	const [jsonText, setJsonText] = useState("{}");
	const [cursorLine, setCursorLine] = useState(0);
	const [syntaxError, setSyntaxError] = useState<string | null>(null);

	// Schema form state
	const [schema, setSchema] = useState<Record<string, unknown> | null>(null);
	const [config, setConfig] = useState<Record<string, unknown>>({});
	const [globalConfig, setGlobalConfig] = useState<Record<string, unknown>>({});
	const [sources, setSources] = useState<Record<string, ConfigSource>>({});

	// Shared state
	const [isLoading, setIsLoading] = useState(true);
	const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
	const [showResetConfirm, setShowResetConfirm] = useState(false);

	// Track which side last edited to avoid infinite sync loops
	const [lastEditSource, setLastEditSource] = useState<"form" | "json" | null>(null);

	// Resizable 3-column panels: Form (35%) | JSON (40%) | Help (25%)
	const { sizes, isDragging, startDrag } = usePanelSizes({
		storageKey: "claudekit-project-config-panels",
		defaultSizes: [35, 40, 25],
		minSizes: [20, 25, 15],
	});

	// Section configuration for schema form (subset relevant to project config)
	const sections: SectionConfig[] = useMemo(
		() => [
			{
				id: "paths",
				title: t("sectionPaths"),
				titleVi: "Đường dẫn",
				fields: [
					{
						path: "paths.docs",
						label: t("fieldDocsPath"),
						labelVi: "Thư mục tài liệu",
						description: t("fieldDocsPathDesc"),
						descriptionVi: "Đường dẫn đến thư mục tài liệu",
					},
					{
						path: "paths.plans",
						label: t("fieldPlansPath"),
						labelVi: "Thư mục kế hoạch",
						description: t("fieldPlansPathDesc"),
						descriptionVi: "Đường dẫn đến thư mục kế hoạch",
					},
				],
			},
			{
				id: "project",
				title: t("sectionProject"),
				titleVi: "Cài đặt dự án",
				fields: [
					{
						path: "project.type",
						label: t("fieldProjectType"),
						labelVi: "Loại dự án",
						description: t("fieldProjectTypeDesc"),
						descriptionVi: "Ghi đè loại dự án tự động phát hiện",
					},
					{
						path: "project.packageManager",
						label: t("fieldPackageManager"),
						labelVi: "Trình quản lý gói",
						description: t("fieldPackageManagerDesc"),
						descriptionVi: "Ghi đè trình quản lý gói tự động phát hiện",
					},
					{
						path: "project.framework",
						label: t("fieldFramework"),
						labelVi: "Framework",
						description: t("fieldFrameworkDesc"),
						descriptionVi: "Ghi đè framework tự động phát hiện",
					},
				],
			},
			{
				id: "privacy",
				title: t("sectionPrivacy"),
				titleVi: "Bảo mật",
				defaultCollapsed: true,
				fields: [
					{
						path: "privacyBlock",
						label: t("fieldPrivacyBlock"),
						labelVi: "Chặn quyền riêng tư",
						description: t("fieldPrivacyBlockDesc"),
						descriptionVi: "Chặn truy cập file nhạy cảm (.env, credentials)",
					},
				],
			},
			{
				id: "advanced",
				title: t("sectionAdvanced"),
				titleVi: "Nâng cao",
				defaultCollapsed: true,
				fields: [
					{
						path: "docs.maxLoc",
						label: t("fieldDocsMaxLoc"),
						labelVi: "Số dòng tối đa/tài liệu",
						description: t("fieldDocsMaxLocDesc"),
						descriptionVi: "Số dòng code tối đa cho mỗi file tài liệu",
					},
					{
						path: "plan.namingFormat",
						label: t("fieldPlanNamingFormat"),
						labelVi: "Định dạng tên kế hoạch",
						description: t("fieldPlanNamingFormatDesc"),
						descriptionVi: "Định dạng cho tên thư mục kế hoạch",
					},
				],
			},
		],
		[t],
	);

	// Load all data on mount
	useEffect(() => {
		if (!projectId) return;
		const loadData = async () => {
			try {
				const [configData, schemaData] = await Promise.all([
					fetchProjectConfig(projectId),
					fetchCkConfigSchema(),
				]);

				const localCfg = configData.local || {};
				setConfig(localCfg);
				setGlobalConfig(configData.global || {});
				setSchema(schemaData);
				setJsonText(JSON.stringify(localCfg, null, 2));

				// Mark fields that exist in local config as "project" source
				const srcMap: Record<string, ConfigSource> = {};
				for (const key of Object.keys(localCfg)) {
					srcMap[key] = "project";
				}
				setSources(srcMap);
			} catch (err) {
				console.error("Failed to load project config:", err);
			} finally {
				setIsLoading(false);
			}
		};
		loadData();
	}, [projectId]);

	// Validate JSON syntax on text changes
	useEffect(() => {
		try {
			JSON.parse(jsonText);
			setSyntaxError(null);
		} catch (e) {
			setSyntaxError(e instanceof Error ? e.message : "Invalid JSON");
		}
	}, [jsonText]);

	// Sync JSON text → form config (when JSON editor is the source)
	useEffect(() => {
		if (lastEditSource !== "json") return;
		try {
			const parsed = JSON.parse(jsonText);
			setConfig(parsed);
		} catch {
			// Invalid JSON — don't update form
		}
	}, [jsonText, lastEditSource]);

	// Help panel field detection from JSON cursor
	const activeFieldPath = useFieldAtLine(jsonText, cursorLine);
	const fieldDoc = activeFieldPath ? CONFIG_FIELD_DOCS[activeFieldPath] : null;

	// Check if current field is overridden from global
	const isFieldOverridden = (fieldPath: string): boolean => {
		const pathParts = fieldPath.split(".");
		let localVal: unknown = config;
		let globalVal: unknown = globalConfig;

		for (const part of pathParts) {
			localVal = (localVal as Record<string, unknown>)?.[part];
			globalVal = (globalVal as Record<string, unknown>)?.[part];
		}

		return localVal !== undefined && globalVal !== undefined && localVal !== globalVal;
	};

	// Handle JSON editor changes
	const handleJsonChange = useCallback((text: string) => {
		setLastEditSource("json");
		setJsonText(text);
	}, []);

	// Handle form field changes — update both config and JSON text
	const handleFormChange = useCallback((path: string, value: unknown) => {
		setLastEditSource("form");
		setConfig((prev) => {
			const updated = setNestedValue(prev, path, value);
			setJsonText(JSON.stringify(updated, null, 2));
			return updated;
		});
		setSources((prev) => ({ ...prev, [path]: "project" }));
	}, []);

	// Save via API
	const handleSave = async () => {
		if (syntaxError || !projectId) return;
		setSaveStatus("saving");
		try {
			const configToSave = JSON.parse(jsonText);
			await saveProjectConfig(projectId, configToSave);
			setConfig(configToSave);
			setSaveStatus("saved");
			setTimeout(() => setSaveStatus("idle"), 2000);
		} catch {
			setSaveStatus("error");
			setTimeout(() => setSaveStatus("idle"), 3000);
		}
	};

	// Reset to empty config
	const handleReset = async () => {
		setShowResetConfirm(false);
		const emptyConfig = {};
		setConfig(emptyConfig);
		setJsonText(JSON.stringify(emptyConfig, null, 2));
	};

	return (
		<div className="animate-in fade-in duration-300 w-full h-full flex flex-col transition-colors">
			{/* Header */}
			<div className="flex items-center justify-between mb-3 shrink-0">
				<div className="flex items-center gap-3">
					<button
						onClick={() => navigate(`/project/${projectId}`)}
						className="px-2 py-1 rounded-lg bg-dash-surface hover:bg-dash-surface-hover border border-dash-border text-sm text-dash-text-secondary hover:text-dash-text flex items-center group transition-all font-medium shadow-sm"
						title={t("backToDashboard")}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
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
					<h1 className="text-xl font-bold tracking-tight text-dash-text">
						{t("projectConfig")}
					</h1>
					<span className="text-xs text-dash-text-muted mono">project/.claude/.ck.json</span>
				</div>

				<div className="flex items-center gap-2 relative">
					{/* Reset Button with Confirmation */}
					{showResetConfirm ? (
						<div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-2 py-1 animate-in fade-in duration-200">
							<span className="text-xs text-red-500 font-medium">{t("confirmReset")}</span>
							<button
								onClick={handleReset}
								className="px-2 py-0.5 rounded bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors"
							>
								{t("confirm")}
							</button>
							<button
								onClick={() => setShowResetConfirm(false)}
								className="px-2 py-0.5 rounded bg-dash-surface text-dash-text-secondary text-xs font-bold hover:bg-dash-surface-hover transition-colors border border-dash-border"
							>
								{t("cancel")}
							</button>
						</div>
					) : (
						<button
							onClick={() => setShowResetConfirm(true)}
							className="px-3 py-1.5 rounded-lg bg-dash-surface text-xs font-bold text-dash-text-secondary hover:bg-dash-surface-hover transition-colors border border-dash-border"
						>
							{t("resetToDefault")}
						</button>
					)}

					{/* Save Button */}
					<button
						onClick={handleSave}
						disabled={!!syntaxError || saveStatus === "saving"}
						className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all tracking-widest uppercase ${
							syntaxError
								? "bg-dash-surface text-dash-text-muted cursor-not-allowed border border-dash-border"
								: saveStatus === "saved"
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

			{/* 3-Column Content with Resizable Panels */}
			<div className="flex-1 flex min-h-0">
				{/* Left: Schema Form */}
				<div
					style={{ width: `${sizes[0]}%` }}
					className="bg-dash-surface border border-dash-border rounded-xl overflow-hidden flex flex-col shadow-sm min-w-0"
				>
					<div className="p-3 border-b border-dash-border bg-dash-surface-hover/50 shrink-0">
						<h3 className="text-xs font-bold text-dash-text-secondary uppercase tracking-widest">
							{t("formTab")}
						</h3>
					</div>
					<div className="flex-1 overflow-auto p-4">
						{isLoading ? (
							<div className="h-full flex items-center justify-center">
								<div className="animate-pulse text-dash-text-muted text-sm">{t("loading")}</div>
							</div>
						) : schema ? (
							<SchemaForm
								schema={schema}
								value={config}
								sources={sources}
								sections={sections}
								onChange={handleFormChange}
							/>
						) : null}
					</div>
				</div>

				<ResizeHandle
					direction="horizontal"
					isDragging={isDragging}
					onMouseDown={(e) => startDrag(0, e)}
				/>

				{/* Center: JSON Editor */}
				<div
					style={{ width: `${sizes[1]}%` }}
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
								onChange={handleJsonChange}
								onCursorLineChange={setCursorLine}
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

				<ResizeHandle
					direction="horizontal"
					isDragging={isDragging}
					onMouseDown={(e) => startDrag(1, e)}
				/>

				{/* Right: Help Panel */}
				<div
					style={{ width: `${sizes[2]}%` }}
					className="bg-dash-surface border border-dash-border rounded-xl flex flex-col shadow-sm overflow-hidden min-w-0"
				>
					<div className="p-3 border-b border-dash-border bg-dash-surface-hover/50 shrink-0">
						<h3 className="text-xs font-bold text-dash-text-secondary uppercase tracking-widest">
							{t("configurationHelp")}
						</h3>
					</div>

					<div className="flex-1 overflow-y-auto p-4">
						{fieldDoc ? (
							<div className="space-y-5 animate-in fade-in duration-500">
								<header>
									<div className="flex items-center gap-2 mb-1">
										<span className="text-[10px] bg-dash-accent-subtle text-dash-accent px-1.5 py-0.5 rounded font-mono uppercase font-bold">
											{t("field")}
										</span>
										<h2 className="text-base font-bold text-dash-text mono break-all">
											{fieldDoc.path}
										</h2>
										{activeFieldPath && isFieldOverridden(activeFieldPath) && (
											<span className="text-[9px] bg-orange-500/10 text-orange-500 px-1.5 py-0.5 rounded font-bold border border-orange-500/30">
												{t("localOverride")}
											</span>
										)}
									</div>
									<div className="flex flex-wrap gap-2 mt-2">
										<MetaBadge label={t("type")} value={fieldDoc.type} />
										<MetaBadge label={t("default")} value={fieldDoc.default} />
									</div>
								</header>

								<section>
									<h4 className="text-[10px] font-bold text-dash-text-muted uppercase tracking-widest mb-2">
										{t("description")}
									</h4>
									<p className="text-sm text-dash-text-secondary leading-relaxed italic">
										{lang === "vi" ? fieldDoc.descriptionVi : fieldDoc.description}
									</p>
								</section>

								{fieldDoc.validValues && (
									<section>
										<h4 className="text-[10px] font-bold text-dash-text-muted uppercase tracking-widest mb-2">
											{t("validValues")}
										</h4>
										<div className="flex flex-wrap gap-1.5">
											{fieldDoc.validValues.map((v) => (
												<span
													key={v}
													className="px-2 py-0.5 bg-dash-bg border border-dash-border rounded text-[11px] mono text-dash-text"
												>
													{v}
												</span>
											))}
										</div>
									</section>
								)}

								{fieldDoc.effect && (
									<section className="bg-dash-accent-subtle/30 p-3 rounded-lg border border-dash-accent/10">
										<h4 className="text-[10px] font-bold text-dash-accent uppercase tracking-widest mb-1">
											{t("systemEffect")}
										</h4>
										<p className="text-[12px] text-dash-text-secondary leading-normal">
											{lang === "vi" && fieldDoc.effectVi ? fieldDoc.effectVi : fieldDoc.effect}
										</p>
									</section>
								)}

								{fieldDoc.example && (
									<section>
										<h4 className="text-[10px] font-bold text-dash-text-muted uppercase tracking-widest mb-2">
											{t("exampleUsage")}
										</h4>
										<div className="bg-dash-bg p-3 rounded-lg border border-dash-border overflow-hidden">
											<pre className="text-[11px] mono text-dash-text-secondary whitespace-pre overflow-x-auto">
												{fieldDoc.example}
											</pre>
										</div>
									</section>
								)}

								{/* Inheritance info */}
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
							</div>
						) : (
							<div className="h-full flex flex-col items-center justify-center text-center opacity-40 space-y-4">
								<div className="w-10 h-10 rounded-full bg-dash-bg border border-dash-border flex items-center justify-center text-lg">
									💡
								</div>
								<div className="max-w-[180px]">
									<p className="text-sm font-bold text-dash-text mb-1 italic">
										{t("knowledgeBase")}
									</p>
									<p className="text-xs text-dash-text-secondary">{t("clickToSeeHelp")}</p>
								</div>
							</div>
						)}
					</div>

					{fieldDoc && (
						<div className="p-3 bg-dash-surface-hover/20 border-t border-dash-border shrink-0">
							<p className="text-[10px] text-dash-text-muted font-medium flex items-center gap-1.5 italic">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="w-3 h-3"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								{t("extractedFrom")}
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

const MetaBadge: React.FC<{ label: string; value: string }> = ({ label, value }) => (
	<div className="flex items-center gap-1.5 px-2 py-1 bg-dash-bg border border-dash-border rounded-md">
		<span className="text-[9px] font-bold text-dash-text-muted uppercase">{label}:</span>
		<span className="text-[10px] mono font-bold text-dash-text-secondary">{value}</span>
	</div>
);

export default ProjectConfigPage;
