/**
 * Global config editor page - unified 3-column layout: Form | JSON | Help
 * Merges Kit Config (schema form) + Config Editor (JSON) + Help panel
 * Edits ~/.claude/.ck.json with bidirectional sync between form and JSON
 */
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import JsonEditor from "../components/JsonEditor";
import { type ConfigSource, SchemaForm, type SectionConfig } from "../components/schema-form";
import { useFieldAtLine } from "../hooks/useFieldAtLine";
import { useI18n } from "../i18n";
import { fetchGlobalMetadata } from "../services/api";
import { fetchCkConfig, fetchCkConfigSchema, saveCkConfig } from "../services/ck-config-api";
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

const GlobalConfigPage: React.FC = () => {
	const { t, lang } = useI18n();
	const navigate = useNavigate();

	// JSON editor state
	const [jsonText, setJsonText] = useState("{}");
	const [cursorLine, setCursorLine] = useState(0);
	const [syntaxError, setSyntaxError] = useState<string | null>(null);

	// Schema form state
	const [schema, setSchema] = useState<Record<string, unknown> | null>(null);
	const [config, setConfig] = useState<Record<string, unknown>>({});
	const [sources, setSources] = useState<Record<string, ConfigSource>>({});

	// Shared state
	const [isLoading, setIsLoading] = useState(true);
	const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
	const [showResetConfirm, setShowResetConfirm] = useState(false);

	// Tab state: config (3-column) or metadata (full-width)
	const [activeTab, setActiveTab] = useState<"config" | "metadata">("config");
	const [metadata, setMetadata] = useState<Record<string, unknown>>({});

	// Track which side last edited to avoid infinite sync loops
	const [lastEditSource, setLastEditSource] = useState<"form" | "json" | null>(null);

	// Section configuration for schema form
	const sections: SectionConfig[] = useMemo(
		() => [
			{
				id: "general",
				title: t("sectionGeneral"),
				titleVi: "Cài đặt chung",
				fields: [
					{
						path: "codingLevel",
						label: t("fieldCodingLevel"),
						labelVi: "Cấp độ lập trình",
						description: t("fieldCodingLevelDesc"),
						descriptionVi: "Cấp độ kinh nghiệm (-1=tự động, 0=mới bắt đầu đến 3=chuyên gia)",
					},
					{
						path: "statusline",
						label: t("fieldStatusline"),
						labelVi: "Chế độ thanh trạng thái",
						description: t("fieldStatuslineDesc"),
						descriptionVi: "Lượng thông tin hiển thị trên thanh trạng thái",
					},
					{
						path: "locale.thinkingLanguage",
						label: t("fieldThinkingLanguage"),
						labelVi: "Ngôn ngữ suy nghĩ",
						description: t("fieldThinkingLanguageDesc"),
						descriptionVi: "Ngôn ngữ cho suy luận nội bộ của Claude (null=Tiếng Anh)",
					},
					{
						path: "locale.responseLanguage",
						label: t("fieldResponseLanguage"),
						labelVi: "Ngôn ngữ phản hồi",
						description: t("fieldResponseLanguageDesc"),
						descriptionVi: "Ngôn ngữ cho phản hồi của Claude (null=theo người dùng)",
					},
				],
			},
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
				id: "privacy",
				title: t("sectionPrivacy"),
				titleVi: "Bảo mật & Tin cậy",
				defaultCollapsed: true,
				fields: [
					{
						path: "privacyBlock",
						label: t("fieldPrivacyBlock"),
						labelVi: "Chặn quyền riêng tư",
						description: t("fieldPrivacyBlockDesc"),
						descriptionVi: "Chặn truy cập file nhạy cảm (.env, credentials)",
					},
					{
						path: "trust.enabled",
						label: t("fieldTrustEnabled"),
						labelVi: "Chế độ tin cậy",
						description: t("fieldTrustEnabledDesc"),
						descriptionVi: "Tự động phê duyệt các tool calls",
					},
					{
						path: "trust.passphrase",
						label: t("fieldTrustPassphrase"),
						labelVi: "Mật khẩu tin cậy",
						description: t("fieldTrustPassphraseDesc"),
						descriptionVi: "Mật khẩu để bật chế độ tin cậy",
					},
				],
			},
			{
				id: "project",
				title: t("sectionProject"),
				titleVi: "Phát hiện dự án",
				defaultCollapsed: true,
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
				id: "integrations",
				title: t("sectionIntegrations"),
				titleVi: "Tích hợp",
				defaultCollapsed: true,
				fields: [
					{
						path: "gemini.model",
						label: t("fieldGeminiModel"),
						labelVi: "Mô hình Gemini",
						description: t("fieldGeminiModelDesc"),
						descriptionVi: "Mô hình Gemini cho các lệnh CLI",
					},
					{
						path: "skills.research.useGemini",
						label: t("fieldResearchUseGemini"),
						labelVi: "Dùng Gemini cho nghiên cứu",
						description: t("fieldResearchUseGeminiDesc"),
						descriptionVi: "Dùng Gemini CLI thay vì WebSearch",
					},
				],
			},
			{
				id: "hooks",
				title: t("sectionHooks"),
				titleVi: "Hooks",
				defaultCollapsed: true,
				fields: [
					{
						path: "hooks.session-init",
						label: t("fieldHookSessionInit"),
						labelVi: "Khởi tạo phiên",
						description: t("fieldHookSessionInitDesc"),
						descriptionVi: "Phát hiện dự án và thiết lập môi trường",
					},
					{
						path: "hooks.subagent-init",
						label: t("fieldHookSubagentInit"),
						labelVi: "Khởi tạo subagent",
						description: t("fieldHookSubagentInitDesc"),
						descriptionVi: "Inject context vào subagents",
					},
					{
						path: "hooks.dev-rules-reminder",
						label: t("fieldHookDevRulesReminder"),
						labelVi: "Nhắc nhở quy tắc dev",
						description: t("fieldHookDevRulesReminderDesc"),
						descriptionVi: "Inject context quy tắc phát triển",
					},
					{
						path: "hooks.usage-context-awareness",
						label: t("fieldHookUsageContextAwareness"),
						labelVi: "Nhận thức ngữ cảnh sử dụng",
						description: t("fieldHookUsageContextAwarenessDesc"),
						descriptionVi: "Nhận thức giới hạn sử dụng",
					},
					{
						path: "hooks.scout-block",
						label: t("fieldHookScoutBlock"),
						labelVi: "Chặn Scout",
						description: t("fieldHookScoutBlockDesc"),
						descriptionVi: "Chặn thư mục nặng khỏi việc khám phá",
					},
					{
						path: "hooks.privacy-block",
						label: t("fieldHookPrivacyBlock"),
						labelVi: "Hook chặn quyền riêng tư",
						description: t("fieldHookPrivacyBlockDesc"),
						descriptionVi: "Chặn đọc file nhạy cảm",
					},
					{
						path: "hooks.post-edit-simplify-reminder",
						label: t("fieldHookPostEditSimplify"),
						labelVi: "Đơn giản sau chỉnh sửa",
						description: t("fieldHookPostEditSimplifyDesc"),
						descriptionVi: "Nhắc đơn giản sau khi chỉnh sửa",
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
					{
						path: "plan.dateFormat",
						label: t("fieldPlanDateFormat"),
						labelVi: "Định dạng ngày kế hoạch",
						description: t("fieldPlanDateFormatDesc"),
						descriptionVi: "Định dạng ngày cho tên kế hoạch (moment.js)",
					},
					{
						path: "plan.validation.mode",
						label: t("fieldPlanValidationMode"),
						labelVi: "Chế độ xác thực",
						description: t("fieldPlanValidationModeDesc"),
						descriptionVi: "Cách xác thực kế hoạch trước khi triển khai",
					},
					{
						path: "plan.validation.minQuestions",
						label: t("fieldPlanMinQuestions"),
						labelVi: "Số câu hỏi tối thiểu",
						description: t("fieldPlanMinQuestionsDesc"),
						descriptionVi: "Số câu hỏi xác thực tối thiểu",
					},
					{
						path: "plan.validation.maxQuestions",
						label: t("fieldPlanMaxQuestions"),
						labelVi: "Số câu hỏi tối đa",
						description: t("fieldPlanMaxQuestionsDesc"),
						descriptionVi: "Số câu hỏi xác thực tối đa",
					},
					{
						path: "assertions",
						label: t("fieldAssertions"),
						labelVi: "Assertions",
						description: t("fieldAssertionsDesc"),
						descriptionVi: "Các assertions và quy tắc cần thực thi",
					},
				],
			},
		],
		[t],
	);

	// Load all data on mount
	useEffect(() => {
		const loadData = async () => {
			try {
				const [configData, schemaData, metadataData] = await Promise.all([
					fetchCkConfig(),
					fetchCkConfigSchema(),
					fetchGlobalMetadata(),
				]);

				const cfg = configData.config;
				setConfig(cfg);
				setSources(configData.sources);
				setSchema(schemaData);
				setJsonText(JSON.stringify(cfg, null, 2));
				setMetadata(metadataData);
			} catch (err) {
				console.error("Failed to load data:", err);
			} finally {
				setIsLoading(false);
			}
		};
		loadData();
	}, []);

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
		setSources((prev) => ({ ...prev, [path]: "global" }));
	}, []);

	// Save via ck-config API
	const handleSave = async () => {
		if (syntaxError) return;
		setSaveStatus("saving");
		try {
			// Use the latest valid config (prefer parsed JSON for accuracy)
			const configToSave = JSON.parse(jsonText);
			await saveCkConfig({ scope: "global", config: configToSave });
			// Sync form state to saved config
			setConfig(configToSave);
			setSaveStatus("saved");
			setTimeout(() => setSaveStatus("idle"), 2000);
		} catch {
			setSaveStatus("error");
			setTimeout(() => setSaveStatus("idle"), 3000);
		}
	};

	// Reset to server state
	const handleReset = async () => {
		setShowResetConfirm(false);
		setIsLoading(true);
		try {
			const configData = await fetchCkConfig();
			setConfig(configData.config);
			setSources(configData.sources);
			setJsonText(JSON.stringify(configData.config, null, 2));
		} catch (err) {
			console.error("Failed to reset:", err);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="animate-in fade-in duration-300 w-full h-full flex flex-col transition-colors">
			{/* Header */}
			<div className="flex items-center justify-between mb-6 shrink-0">
				<div className="flex items-center gap-3">
					<button
						onClick={() => navigate(-1)}
						className="px-2.5 py-1.5 rounded-lg bg-dash-surface hover:bg-dash-surface-hover border border-dash-border text-sm text-dash-text-secondary hover:text-dash-text flex items-center gap-1.5 group transition-all font-medium shadow-sm"
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
					<div>
						<h1 className="text-2xl font-bold tracking-tight text-dash-text">
							{t("globalConfig")}
						</h1>
						<p className="text-xs text-dash-text-muted mono mt-0.5">~/.claude/.ck.json</p>
					</div>
				</div>

				<div className="flex items-center gap-3 relative">
					{/* Reset Button with Confirmation */}
					{showResetConfirm ? (
						<div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1.5 animate-in fade-in duration-200">
							<span className="text-xs text-red-500 font-medium">{t("confirmReset")}</span>
							<button
								onClick={handleReset}
								className="px-2 py-1 rounded bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors"
							>
								{t("confirm")}
							</button>
							<button
								onClick={() => setShowResetConfirm(false)}
								className="px-2 py-1 rounded bg-dash-surface text-dash-text-secondary text-xs font-bold hover:bg-dash-surface-hover transition-colors border border-dash-border"
							>
								{t("cancel")}
							</button>
						</div>
					) : (
						<button
							onClick={() => setShowResetConfirm(true)}
							className="px-4 py-2 rounded-lg bg-dash-surface text-xs font-bold text-dash-text-secondary hover:bg-dash-surface-hover transition-colors border border-dash-border"
						>
							{t("resetToDefault")}
						</button>
					)}

					{/* Save Button */}
					<button
						onClick={handleSave}
						disabled={!!syntaxError || saveStatus === "saving"}
						className={`px-4 py-2 rounded-lg text-xs font-bold transition-all tracking-widest uppercase ${
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

			{/* Tab Bar */}
			<div className="flex gap-2 mb-4 border-b border-dash-border">
				<button
					onClick={() => setActiveTab("config")}
					className={`px-4 py-2 text-sm font-bold transition-colors relative ${
						activeTab === "config"
							? "text-dash-accent border-b-2 border-dash-accent"
							: "text-dash-text-muted hover:text-dash-text"
					}`}
				>
					{t("configTab")}
				</button>
				<button
					onClick={() => setActiveTab("metadata")}
					className={`px-4 py-2 text-sm font-bold transition-colors relative ${
						activeTab === "metadata"
							? "text-dash-accent border-b-2 border-dash-accent"
							: "text-dash-text-muted hover:text-dash-text"
					}`}
				>
					{t("metadataTab")}
				</button>
			</div>

			{/* Content area */}
			<div className="flex-1 flex gap-4 min-h-0">
				{activeTab === "config" && (
					<>
						{/* Left: Schema Form */}
						<div className="flex-[35] bg-dash-surface border border-dash-border rounded-xl overflow-hidden flex flex-col shadow-sm min-w-0">
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

						{/* Center: JSON Editor */}
						<div className="flex-[40] bg-dash-surface border border-dash-border rounded-xl overflow-hidden flex flex-col shadow-sm min-w-0">
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

						{/* Right: Help Panel */}
						<div className="flex-[25] bg-dash-surface border border-dash-border rounded-xl flex flex-col shadow-sm overflow-hidden min-w-0">
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
					</>
				)}

				{/* Metadata Tab - full width */}
				{activeTab === "metadata" && (
					<div className="flex-1 bg-dash-surface border border-dash-border rounded-xl overflow-hidden flex flex-col shadow-sm">
						<div className="flex-1 overflow-auto p-6">
							{isLoading ? (
								<div className="h-full flex items-center justify-center">
									<div className="animate-pulse text-dash-text-muted text-sm">{t("loading")}</div>
								</div>
							) : (
								<MetadataDisplay metadata={metadata} />
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

// Metadata display component
const MetadataDisplay: React.FC<{ metadata: Record<string, unknown> }> = ({ metadata }) => {
	const { t } = useI18n();

	const hasKits = metadata.kits && typeof metadata.kits === "object";
	const kitEntries = hasKits ? Object.entries(metadata.kits as Record<string, unknown>) : [];
	const legacyName = metadata.name as string | undefined;
	const legacyVersion = metadata.version as string | undefined;
	const legacyInstalledAt = metadata.installedAt as string | undefined;
	const hasAnyKit = kitEntries.length > 0 || legacyName;

	if (!hasAnyKit) {
		return (
			<div className="h-full flex flex-col items-center justify-center text-center opacity-40 space-y-4">
				<div className="w-16 h-16 rounded-full bg-dash-bg border border-dash-border flex items-center justify-center text-3xl">
					📦
				</div>
				<div className="max-w-[300px]">
					<p className="text-lg font-bold text-dash-text mb-2">{t("noKitInstalled")}</p>
					<p className="text-sm text-dash-text-secondary">
						Install a ClaudeKit to see metadata information here
					</p>
				</div>
			</div>
		);
	}

	if (hasKits && kitEntries.length > 0) {
		return (
			<div className="space-y-6">
				{kitEntries.map(([kitName, kitData]) => {
					const kit = kitData as {
						version?: string;
						installedAt?: string;
						files?: unknown[];
					};
					return (
						<div
							key={kitName}
							className="bg-dash-bg border border-dash-border rounded-lg p-6 space-y-4"
						>
							<h3 className="text-lg font-bold text-dash-text capitalize">{kitName} Kit</h3>
							<div className="grid grid-cols-2 gap-4">
								<InfoRow label={t("kitVersion")} value={kit.version || "N/A"} />
								<InfoRow
									label={t("installedOn")}
									value={kit.installedAt ? new Date(kit.installedAt).toLocaleDateString() : "N/A"}
								/>
							</div>
							{kit.files && Array.isArray(kit.files) && (
								<div>
									<h4 className="text-xs font-bold text-dash-text-muted uppercase tracking-widest mb-2">
										{t("components")}
									</h4>
									<div className="text-sm text-dash-text-secondary">
										{kit.files.length} files tracked
									</div>
								</div>
							)}
						</div>
					);
				})}
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="bg-dash-bg border border-dash-border rounded-lg p-6 space-y-4">
				<h3 className="text-lg font-bold text-dash-text">{legacyName || "ClaudeKit"}</h3>
				<div className="grid grid-cols-2 gap-4">
					<InfoRow label={t("kitVersion")} value={legacyVersion || "N/A"} />
					<InfoRow
						label={t("installedOn")}
						value={legacyInstalledAt ? new Date(legacyInstalledAt).toLocaleDateString() : "N/A"}
					/>
				</div>
			</div>
		</div>
	);
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
	<div>
		<div className="text-[10px] font-bold text-dash-text-muted uppercase tracking-widest mb-1">
			{label}
		</div>
		<div className="text-sm font-medium text-dash-text">{value}</div>
	</div>
);

const MetaBadge: React.FC<{ label: string; value: string }> = ({ label, value }) => (
	<div className="flex items-center gap-1.5 px-2 py-1 bg-dash-bg border border-dash-border rounded-md">
		<span className="text-[9px] font-bold text-dash-text-muted uppercase">{label}:</span>
		<span className="text-[10px] mono font-bold text-dash-text-secondary">{value}</span>
	</div>
);

export default GlobalConfigPage;
