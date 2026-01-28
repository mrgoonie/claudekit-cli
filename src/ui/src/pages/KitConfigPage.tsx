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
				<div>
					<button
						onClick={() => navigate(-1)}
						className="mb-3 px-3 py-1.5 rounded-lg bg-dash-surface hover:bg-dash-surface-hover border border-dash-border text-sm text-dash-text-secondary hover:text-dash-text flex items-center gap-2 group transition-all font-medium shadow-sm"
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
						{t("backToDashboard")}
					</button>
					<h1 className="text-2xl font-bold tracking-tight text-dash-text">{t("kitConfig")}</h1>
					<p className="text-xs text-dash-text-muted mt-1">{t("kitConfigSubtitle")}</p>
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
