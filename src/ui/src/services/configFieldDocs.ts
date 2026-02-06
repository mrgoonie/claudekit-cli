export interface FieldDoc {
	path: string;
	type: string;
	default: string;
	validValues?: string[];
	description: string;
	descriptionVi: string;
	effect?: string;
	effectVi?: string;
	example?: string;
}

export const CONFIG_FIELD_DOCS: Record<string, FieldDoc> = {
	// Parent object: plan
	plan: {
		path: "plan",
		type: "object",
		default: "{}",
		description:
			"Configuration for plan management including naming conventions, resolution strategies, and validation workflows.",
		descriptionVi:
			"Cấu hình quản lý kế hoạch bao gồm quy ước đặt tên, chiến lược giải quyết và quy trình xác thực.",
		effect:
			"Controls how plans are created (namingFormat), located (resolution), and reviewed (validation) during development.",
		effectVi:
			"Điều khiển cách tạo kế hoạch (namingFormat), định vị (resolution) và xem xét (validation) trong quá trình phát triển.",
	},
	// Parent object: plan.resolution
	"plan.resolution": {
		path: "plan.resolution",
		type: "object",
		default: "{}",
		description:
			"Settings for resolving which plan is currently active. Uses cascading resolution: session state (explicit) → branch name matching (suggested).",
		descriptionVi:
			"Cài đặt để xác định kế hoạch đang hoạt động. Sử dụng giải quyết theo tầng: trạng thái phiên (rõ ràng) → khớp tên nhánh (gợi ý).",
		effect:
			"'session' = ACTIVE (explicitly set via set-active-plan). 'branch' = SUGGESTED (hint from git branch name). 'mostRecent' was removed to avoid stale plan pollution.",
		effectVi:
			"'session' = ĐANG HOẠT ĐỘNG (đặt rõ ràng qua set-active-plan). 'branch' = GỢI Ý (từ tên nhánh git). 'mostRecent' đã bị xóa để tránh ô nhiễm kế hoạch cũ.",
	},
	// Parent object: plan.validation
	"plan.validation": {
		path: "plan.validation",
		type: "object",
		default: "{}",
		description:
			"Settings for the plan validation interview that reviews assumptions, risks, and architecture decisions.",
		descriptionVi:
			"Cài đặt cho phỏng vấn xác thực kế hoạch để xem xét giả định, rủi ro và quyết định kiến trúc.",
		effect:
			"Runs validation interview based on mode: 'auto' (always), 'prompt' (ask first), 'off' (skip). Questions focus on configured areas.",
		effectVi:
			"Chạy phỏng vấn xác thực dựa trên chế độ: 'auto' (luôn), 'prompt' (hỏi trước), 'off' (bỏ qua). Câu hỏi tập trung vào các lĩnh vực đã cấu hình.",
	},
	// Parent object: paths
	paths: {
		path: "paths",
		type: "object",
		default: "{}",
		description:
			"Custom paths for project directories. Supports relative paths (from project root) or absolute paths for consolidated setups.",
		descriptionVi:
			"Đường dẫn tùy chỉnh cho các thư mục dự án. Hỗ trợ đường dẫn tương đối (từ thư mục gốc) hoặc tuyệt đối cho thiết lập tập trung.",
		effect:
			"Relative paths are resolved from project root. Absolute paths allow consolidated plans across repos.",
		effectVi:
			"Đường dẫn tương đối được giải quyết từ thư mục gốc dự án. Đường dẫn tuyệt đối cho phép kế hoạch tập trung giữa các repo.",
	},
	// Parent object: locale
	locale: {
		path: "locale",
		type: "object",
		default: "{}",
		description:
			"Language settings separating internal AI reasoning from user-facing output for optimal precision.",
		descriptionVi:
			"Cài đặt ngôn ngữ tách suy luận AI nội bộ khỏi đầu ra cho người dùng để có độ chính xác tối ưu.",
		effect:
			"thinkingLanguage: for reasoning/logic (recommended: 'en'). responseLanguage: for user output (e.g., 'vi' for Vietnamese responses).",
		effectVi:
			"thinkingLanguage: cho suy luận/logic (khuyến nghị: 'en'). responseLanguage: cho đầu ra người dùng (vd: 'vi' cho phản hồi tiếng Việt).",
	},
	// Parent object: trust
	trust: {
		path: "trust",
		type: "object",
		default: "{}",
		description:
			"Trusted execution mode for bypassing certain security confirmations in controlled environments.",
		descriptionVi:
			"Chế độ thực thi tin cậy để bỏ qua một số xác nhận bảo mật trong môi trường được kiểm soát.",
		effect:
			"When trust.enabled=true, security prompts may be skipped. passphrase is used for context injection testing.",
		effectVi:
			"Khi trust.enabled=true, các lời nhắc bảo mật có thể bị bỏ qua. passphrase dùng để kiểm tra tiêm ngữ cảnh.",
	},
	// Parent object: project
	project: {
		path: "project",
		type: "object",
		default: "{}",
		description:
			"Override automatic project detection. Set to 'auto' for automatic detection or specify exact values.",
		descriptionVi:
			"Ghi đè phát hiện dự án tự động. Đặt 'auto' để tự động phát hiện hoặc chỉ định giá trị cụ thể.",
		effect:
			"type: single-repo/monorepo/library. packageManager: npm/yarn/pnpm/bun. framework: next/nuxt/astro/etc.",
		effectVi:
			"type: single-repo/monorepo/library. packageManager: npm/yarn/pnpm/bun. framework: next/nuxt/astro/v.v.",
	},
	codingLevel: {
		path: "codingLevel",
		type: "number",
		default: "-1",
		validValues: ["-1", "0", "1", "2", "3", "4", "5"],
		description:
			"Controls the communication style and depth of explanations based on user's coding experience level.",
		descriptionVi:
			"Điều khiển phong cách giao tiếp và độ sâu giải thích dựa trên trình độ lập trình của người dùng.",
		effect:
			"Loads corresponding output style and injects it into the session context. Changes how Claude explains code and structures responses.",
		effectVi:
			"Tải phong cách đầu ra tương ứng và đưa vào ngữ cảnh phiên. Thay đổi cách Claude giải thích code và cấu trúc phản hồi.",
		example: '{\n  "codingLevel": 1\n}',
	},
	privacyBlock: {
		path: "privacyBlock",
		type: "boolean",
		default: "true",
		description:
			"Enables or disables the privacy protection hook that blocks access to sensitive files and domains.",
		descriptionVi:
			"Bật hoặc tắt hook bảo vệ quyền riêng tư, chặn truy cập vào các tệp và domain nhạy cảm.",
		effect:
			"When true, blocks reading files like .env, passwords, credentials, SSH keys, and API tokens.",
		effectVi:
			"Khi bật, chặn đọc các tệp như .env, mật khẩu, thông tin xác thực, SSH keys và API tokens.",
		example: '{\n  "privacyBlock": false\n}',
	},
	"plan.namingFormat": {
		path: "plan.namingFormat",
		type: "string",
		default: '"{date}-{issue}-{slug}"',
		description:
			"Template for naming plan directories. Uses placeholder tokens that get replaced at runtime.",
		descriptionVi:
			"Mẫu đặt tên thư mục kế hoạch. Sử dụng các token placeholder được thay thế khi chạy.",
		effect:
			"{date} is replaced with formatted date, {issue} is extracted from branch, {slug} is for agent substitution.",
		effectVi:
			"{date} được thay bằng ngày đã định dạng, {issue} trích xuất từ branch, {slug} cho agent thay thế.",
		example: '{\n  "plan": {\n    "namingFormat": "{date}-{slug}"\n  }\n}',
	},
	"plan.dateFormat": {
		path: "plan.dateFormat",
		type: "string",
		default: '"YYMMDD-HHmm"',
		description: "Date format string for {date} token in naming pattern.",
		descriptionVi: "Chuỗi định dạng ngày cho token {date} trong mẫu đặt tên.",
		example: '{\n  "plan": {\n    "dateFormat": "YYMMDD"\n  }\n}',
	},
	"plan.issuePrefix": {
		path: "plan.issuePrefix",
		type: "string | null",
		default: "null",
		description:
			"Prefix to prepend to extracted issue numbers in plan naming (e.g., 'GH-', 'JIRA-').",
		descriptionVi:
			"Tiền tố thêm vào số issue trích xuất trong đặt tên kế hoạch (vd: 'GH-', 'JIRA-').",
		example: '{\n  "plan": {\n    "issuePrefix": "GH-"\n  }\n}',
	},
	"plan.reportsDir": {
		path: "plan.reportsDir",
		type: "string",
		default: '"reports"',
		description: "Subdirectory name within plan directory for storing reports.",
		descriptionVi: "Tên thư mục con trong thư mục kế hoạch để lưu trữ báo cáo.",
		example: '{\n  "plan": {\n    "reportsDir": "reports"\n  }\n}',
	},
	"plan.resolution.order": {
		path: "plan.resolution.order",
		type: "string[]",
		default: '["session", "branch"]',
		validValues: ["session", "branch"],
		description: "Order of resolution methods to try when finding the active plan.",
		descriptionVi: "Thứ tự các phương thức giải quyết để tìm kế hoạch đang hoạt động.",
		example:
			'{\n  "plan": {\n    "resolution": {\n      "order": ["session", "branch"]\n    }\n  }\n}',
	},
	"plan.resolution.branchPattern": {
		path: "plan.resolution.branchPattern",
		type: "string (regex)",
		default: '"(?:feat|fix|chore|refactor|docs)/(?:[^/]+/)?(.+)"',
		description:
			"Regex pattern for extracting plan slug from git branch name. Capture group 1 is used as the slug.",
		descriptionVi:
			"Mẫu regex để trích xuất slug kế hoạch từ tên nhánh git. Nhóm bắt 1 được dùng làm slug.",
		example:
			'{\n  "plan": {\n    "resolution": {\n      "branchPattern": "(?:feat|fix)/(.+)"\n    }\n  }\n}',
	},
	"plan.validation.mode": {
		path: "plan.validation.mode",
		type: "string",
		default: '"prompt"',
		validValues: ["auto", "prompt", "off"],
		description: "Controls when plan validation interview runs.",
		descriptionVi: "Điều khiển thời điểm chạy phỏng vấn xác thực kế hoạch.",
		example: '{\n  "plan": {\n    "validation": {\n      "mode": "auto"\n    }\n  }\n}',
	},
	"plan.validation.minQuestions": {
		path: "plan.validation.minQuestions",
		type: "number",
		default: "3",
		description: "Minimum number of validation questions to ask during plan review.",
		descriptionVi: "Số câu hỏi xác thực tối thiểu trong quá trình xem xét kế hoạch.",
		example: '{\n  "plan": {\n    "validation": {\n      "minQuestions": 5\n    }\n  }\n}',
	},
	"plan.validation.maxQuestions": {
		path: "plan.validation.maxQuestions",
		type: "number",
		default: "8",
		description: "Maximum number of validation questions to ask during plan review.",
		descriptionVi: "Số câu hỏi xác thực tối đa trong quá trình xem xét kế hoạch.",
		example: '{\n  "plan": {\n    "validation": {\n      "maxQuestions": 10\n    }\n  }\n}',
	},
	"plan.validation.focusAreas": {
		path: "plan.validation.focusAreas",
		type: "string[]",
		default: '["assumptions", "risks", "tradeoffs", "architecture"]',
		description: "Categories of questions to focus on during validation interview.",
		descriptionVi: "Các danh mục câu hỏi tập trung trong phỏng vấn xác thực.",
		example:
			'{\n  "plan": {\n    "validation": {\n      "focusAreas": ["security", "performance"]\n    }\n  }\n}',
	},
	"paths.docs": {
		path: "paths.docs",
		type: "string",
		default: '"docs"',
		description: "Path to documentation directory (relative to project root or absolute).",
		descriptionVi: "Đường dẫn thư mục tài liệu (tương đối với thư mục gốc hoặc tuyệt đối).",
		example: '{\n  "paths": {\n    "docs": "docs"\n  }\n}',
	},
	"paths.plans": {
		path: "paths.plans",
		type: "string",
		default: '"plans"',
		description: "Path to plans directory (relative to project root or absolute).",
		descriptionVi: "Đường dẫn thư mục kế hoạch (tương đối với thư mục gốc hoặc tuyệt đối).",
		example: '{\n  "paths": {\n    "plans": "plans"\n  }\n}',
	},
	"locale.thinkingLanguage": {
		path: "locale.thinkingLanguage",
		type: "string | null",
		default: "null",
		description: "Language for internal reasoning and logic. Recommended: 'en' for precision.",
		descriptionVi: "Ngôn ngữ suy luận nội bộ và logic. Khuyến nghị: 'en' để chính xác.",
		example: '{\n  "locale": {\n    "thinkingLanguage": "en"\n  }\n}',
	},
	"locale.responseLanguage": {
		path: "locale.responseLanguage",
		type: "string | null",
		default: "null",
		description: "Language for user-facing output (responses, explanations, comments).",
		descriptionVi: "Ngôn ngữ cho đầu ra người dùng (phản hồi, giải thích, nhận xét).",
		example: '{\n  "locale": {\n    "responseLanguage": "fr"\n  }\n}',
	},
	"trust.enabled": {
		path: "trust.enabled",
		type: "boolean",
		default: "false",
		description: "Enables trusted execution mode. When enabled, bypasses certain security prompts.",
		descriptionVi: "Bật chế độ thực thi tin cậy. Khi bật, bỏ qua một số lời nhắc bảo mật.",
		example: '{\n  "trust": {\n    "enabled": true\n  }\n}',
	},
	"trust.passphrase": {
		path: "trust.passphrase",
		type: "string | null",
		default: "null",
		description: "Secret passphrase for testing context injection and trust verification.",
		descriptionVi: "Cụm mật khẩu bí mật để kiểm tra tiêm ngữ cảnh và xác minh tin cậy.",
		example: '{\n  "trust": {\n    "passphrase": "super-secret-key"\n  }\n}',
	},
	"project.type": {
		path: "project.type",
		type: "string",
		default: '"auto"',
		validValues: ["auto", "library", "application", "monorepo", "cli", "api", "web", "mobile"],
		description: "Override automatic project type detection.",
		descriptionVi: "Ghi đè phát hiện loại dự án tự động.",
		example: '{\n  "project": {\n    "type": "monorepo"\n  }\n}',
	},
	"project.packageManager": {
		path: "project.packageManager",
		type: "string",
		default: '"auto"',
		validValues: ["auto", "npm", "yarn", "pnpm", "bun"],
		description: "Override automatic package manager detection.",
		descriptionVi: "Ghi đè phát hiện trình quản lý gói tự động.",
		example: '{\n  "project": {\n    "packageManager": "pnpm"\n  }\n}',
	},
	"project.framework": {
		path: "project.framework",
		type: "string",
		default: '"auto"',
		validValues: [
			"auto",
			"react",
			"vue",
			"angular",
			"svelte",
			"nextjs",
			"nuxt",
			"express",
			"nestjs",
			"fastify",
			"none",
		],
		description: "Override automatic framework detection.",
		descriptionVi: "Ghi đè phát hiện framework tự động.",
		example: '{\n  "project": {\n    "framework": "nextjs"\n  }\n}',
	},
	// Parent object: docs
	docs: {
		path: "docs",
		type: "object",
		default: "{}",
		description:
			"Configuration for documentation management including file size limits and splitting behavior.",
		descriptionVi: "Cấu hình quản lý tài liệu bao gồm giới hạn kích thước tệp và hành vi chia nhỏ.",
		effect:
			"Controls how documentation files are processed and split when they exceed size limits.",
		effectVi:
			"Điều khiển cách các tệp tài liệu được xử lý và chia nhỏ khi vượt quá giới hạn kích thước.",
	},
	"docs.maxLoc": {
		path: "docs.maxLoc",
		type: "number",
		default: "800",
		description:
			"Maximum lines of code per documentation file before automatic splitting is triggered.",
		descriptionVi:
			"Số dòng code tối đa mỗi tệp tài liệu trước khi tự động chia nhỏ được kích hoạt.",
		effect:
			"When a documentation file exceeds this line count, the system will suggest or automatically split it into smaller files for better readability and maintenance.",
		effectVi:
			"Khi tệp tài liệu vượt quá số dòng này, hệ thống sẽ đề xuất hoặc tự động chia nhỏ thành các tệp nhỏ hơn để dễ đọc và bảo trì hơn.",
		example: '{\n  "docs": {\n    "maxLoc": 1000\n  }\n}',
	},
	// Parent object: gemini
	gemini: {
		path: "gemini",
		type: "object",
		default: "{}",
		description:
			"Configuration for Google Gemini API integration used for CLI commands and research tasks.",
		descriptionVi: "Cấu hình tích hợp Google Gemini API dùng cho lệnh CLI và tác vụ nghiên cứu.",
		effect:
			"Controls which Gemini model is used for research, web search, and other AI-powered CLI operations.",
		effectVi:
			"Điều khiển model Gemini nào được dùng cho nghiên cứu, tìm kiếm web và các thao tác CLI hỗ trợ AI khác.",
	},
	"gemini.model": {
		path: "gemini.model",
		type: "string",
		default: '"gemini-3-flash-preview"',
		validValues: [
			"gemini-2.5-flash",
			"gemini-2.5-pro",
			"gemini-3-pro-preview",
			"gemini-3-flash-preview",
		],
		description: "Gemini model used for CLI commands and research operations.",
		descriptionVi: "Model Gemini dùng cho lệnh CLI và thao tác nghiên cứu.",
		effect:
			"Determines which Gemini model handles research, web search, and other auxiliary tasks. Flash models are faster but less capable than Pro models.",
		effectVi:
			"Xác định model Gemini nào xử lý nghiên cứu, tìm kiếm web và các tác vụ phụ trợ khác. Model Flash nhanh hơn nhưng kém khả năng hơn model Pro.",
		example: '{\n  "gemini": {\n    "model": "gemini-2.5-pro"\n  }\n}',
	},
	// Parent object: skills
	skills: {
		path: "skills",
		type: "object",
		default: "{}",
		description:
			"Configuration for skills system including research behavior and custom skill settings.",
		descriptionVi:
			"Cấu hình hệ thống kỹ năng bao gồm hành vi nghiên cứu và cài đặt kỹ năng tùy chỉnh.",
		effect:
			"Controls how skills are executed, particularly research operations and their AI provider choices.",
		effectVi:
			"Điều khiển cách các kỹ năng được thực thi, đặc biệt là thao tác nghiên cứu và lựa chọn nhà cung cấp AI.",
	},
	"skills.research": {
		path: "skills.research",
		type: "object",
		default: "{}",
		description: "Configuration specific to the research skill behavior and AI provider selection.",
		descriptionVi: "Cấu hình riêng cho hành vi kỹ năng nghiên cứu và lựa chọn nhà cung cấp AI.",
		effect:
			"Determines whether research operations use Gemini CLI or Claude's built-in WebSearch tool.",
		effectVi:
			"Xác định liệu thao tác nghiên cứu có dùng Gemini CLI hay công cụ WebSearch tích hợp của Claude.",
	},
	"skills.research.useGemini": {
		path: "skills.research.useGemini",
		type: "boolean",
		default: "true",
		description:
			"When enabled, uses Gemini CLI for research operations instead of Claude's WebSearch tool.",
		descriptionVi:
			"Khi bật, dùng Gemini CLI cho thao tác nghiên cứu thay vì công cụ WebSearch của Claude.",
		effect:
			"Gemini CLI offers faster search results and lower token costs for research, but requires Gemini API setup. WebSearch is built-in but more expensive.",
		effectVi:
			"Gemini CLI cung cấp kết quả tìm kiếm nhanh hơn và chi phí token thấp hơn cho nghiên cứu, nhưng cần thiết lập Gemini API. WebSearch tích hợp sẵn nhưng đắt hơn.",
		example: '{\n  "skills": {\n    "research": {\n      "useGemini": false\n    }\n  }\n}',
	},
	// Parent object: hooks
	hooks: {
		path: "hooks",
		type: "object",
		default: "{}",
		description:
			"Configuration for lifecycle hooks that inject context, enforce rules, and enhance safety throughout the development workflow.",
		descriptionVi:
			"Cấu hình các hook vòng đời tiêm ngữ cảnh, thực thi quy tắc và tăng cường an toàn trong suốt quy trình phát triển.",
		effect:
			"Controls which hooks are active. Each hook fires at specific points in the workflow to inject context or enforce guardrails.",
		effectVi:
			"Điều khiển hook nào đang hoạt động. Mỗi hook kích hoạt tại các điểm cụ thể trong quy trình để tiêm ngữ cảnh hoặc thực thi bảo vệ.",
	},
	"hooks.session-init": {
		path: "hooks.session-init",
		type: "boolean",
		default: "true",
		description:
			"Runs project detection and environment setup at the start of every Claude Code session.",
		descriptionVi:
			"Chạy phát hiện dự án và thiết lập môi trường khi bắt đầu mỗi phiên Claude Code.",
		effect:
			"When enabled, automatically detects project type, framework, package manager, and injects relevant context into the session.",
		effectVi:
			"Khi bật, tự động phát hiện loại dự án, framework, trình quản lý gói và tiêm ngữ cảnh liên quan vào phiên.",
		example: '{\n  "hooks": {\n    "session-init": false\n  }\n}',
	},
	"hooks.subagent-init": {
		path: "hooks.subagent-init",
		type: "boolean",
		default: "true",
		description:
			"Injects context (paths, plans, reports) into spawned subagents to ensure consistency.",
		descriptionVi:
			"Tiêm ngữ cảnh (đường dẫn, kế hoạch, báo cáo) vào các subagent được tạo để đảm bảo nhất quán.",
		effect:
			"Ensures subagents inherit work context, know where to save reports, and follow the same plan structure as the parent agent.",
		effectVi:
			"Đảm bảo subagent kế thừa ngữ cảnh làm việc, biết nơi lưu báo cáo và tuân theo cùng cấu trúc kế hoạch với agent cha.",
		example: '{\n  "hooks": {\n    "subagent-init": false\n  }\n}',
	},
	"hooks.descriptive-name": {
		path: "hooks.descriptive-name",
		type: "boolean",
		default: "true",
		description:
			"Injects descriptive naming context so agents generate meaningful, self-documenting file and variable names.",
		descriptionVi:
			"Tiêm ngữ cảnh đặt tên mô tả để agent tạo tên tệp và biến có ý nghĩa, tự tài liệu hóa.",
		effect:
			"When enabled, reminds the agent to use long, descriptive kebab-case names for files and clear variable naming conventions.",
		effectVi:
			"Khi bật, nhắc nhở agent sử dụng tên kebab-case dài, mô tả cho tệp và quy ước đặt tên biến rõ ràng.",
		example: '{\n  "hooks": {\n    "descriptive-name": false\n  }\n}',
	},
	"hooks.dev-rules-reminder": {
		path: "hooks.dev-rules-reminder",
		type: "boolean",
		default: "true",
		description:
			"Injects development rules context before tool execution to maintain coding standards.",
		descriptionVi:
			"Tiêm ngữ cảnh quy tắc phát triển trước khi thực thi công cụ để duy trì chuẩn code.",
		effect:
			"Reminds the agent of coding standards, file naming conventions, and project-specific rules before file operations.",
		effectVi:
			"Nhắc nhở agent về chuẩn code, quy ước đặt tên tệp và quy tắc riêng của dự án trước thao tác tệp.",
		example: '{\n  "hooks": {\n    "dev-rules-reminder": false\n  }\n}',
	},
	"hooks.usage-context-awareness": {
		path: "hooks.usage-context-awareness",
		type: "boolean",
		default: "true",
		description:
			"Monitors token usage and rate limits, injects awareness context to prevent overruns.",
		descriptionVi:
			"Giám sát sử dụng token và giới hạn tốc độ, tiêm ngữ cảnh nhận biết để ngăn vượt quá.",
		effect:
			"When approaching token limits or rate limits, warns the agent to be more concise or split operations.",
		effectVi:
			"Khi tiến gần giới hạn token hoặc giới hạn tốc độ, cảnh báo agent để ngắn gọn hơn hoặc chia nhỏ thao tác.",
		example: '{\n  "hooks": {\n    "usage-context-awareness": false\n  }\n}',
	},
	"hooks.context-tracking": {
		path: "hooks.context-tracking",
		type: "boolean",
		default: "true",
		description:
			"Tracks context window usage and injects awareness data so agents can optimize token consumption.",
		descriptionVi:
			"Theo dõi sử dụng cửa sổ ngữ cảnh và tiêm dữ liệu nhận biết để agent tối ưu hóa tiêu thụ token.",
		effect:
			"When enabled, monitors context percentage and remaining capacity, warning the agent when approaching limits to prevent truncation.",
		effectVi:
			"Khi bật, giám sát phần trăm ngữ cảnh và dung lượng còn lại, cảnh báo agent khi tiến gần giới hạn để ngăn cắt xén.",
		example: '{\n  "hooks": {\n    "context-tracking": false\n  }\n}',
	},
	"hooks.scout-block": {
		path: "hooks.scout-block",
		type: "boolean",
		default: "true",
		description:
			"Blocks heavy directories (node_modules, .git, dist) from exploration to save tokens.",
		descriptionVi:
			"Chặn các thư mục nặng (node_modules, .git, dist) khỏi khám phá để tiết kiệm token.",
		effect:
			"Prevents the agent from reading irrelevant or large directories that waste tokens and context window space.",
		effectVi:
			"Ngăn agent đọc các thư mục không liên quan hoặc lớn lãng phí token và không gian cửa sổ ngữ cảnh.",
		example: '{\n  "hooks": {\n    "scout-block": false\n  }\n}',
	},
	"hooks.privacy-block": {
		path: "hooks.privacy-block",
		type: "boolean",
		default: "true",
		description:
			"Blocks reading sensitive files (.env, credentials, secrets) to protect user privacy.",
		descriptionVi:
			"Chặn đọc các tệp nhạy cảm (.env, thông tin xác thực, bí mật) để bảo vệ quyền riêng tư người dùng.",
		effect:
			"When enabled, prompts user for permission before accessing files that may contain API keys, passwords, or other secrets.",
		effectVi:
			"Khi bật, nhắc người dùng cho phép trước khi truy cập tệp có thể chứa API keys, mật khẩu hoặc bí mật khác.",
		example: '{\n  "hooks": {\n    "privacy-block": false\n  }\n}',
	},
	"hooks.post-edit-simplify-reminder": {
		path: "hooks.post-edit-simplify-reminder",
		type: "boolean",
		default: "true",
		description:
			"Reminds the agent to simplify code after file edits to maintain readability and prevent bloat.",
		descriptionVi:
			"Nhắc nhở agent đơn giản hóa code sau khi chỉnh sửa tệp để duy trì khả năng đọc và ngăn phình to.",
		effect:
			"After editing files, suggests reviewing for unnecessary complexity, redundant code, or opportunities to refactor.",
		effectVi:
			"Sau khi chỉnh sửa tệp, đề xuất xem xét độ phức tạp không cần thiết, code dư thừa hoặc cơ hội refactor.",
		example: '{\n  "hooks": {\n    "post-edit-simplify-reminder": false\n  }\n}',
	},
	statusline: {
		path: "statusline",
		type: "string",
		default: '"full"',
		validValues: ["full", "compact", "minimal", "none"],
		description:
			"Controls how much information is displayed in the Claude Code status line during operations.",
		descriptionVi:
			"Điều khiển lượng thông tin hiển thị trong dòng trạng thái Claude Code trong khi thao tác.",
		effect:
			"'full' shows all details (tokens, model, cost). 'compact' shows summary. 'minimal' shows only critical info. 'none' hides status line.",
		effectVi:
			"'full' hiển thị tất cả chi tiết (token, model, chi phí). 'compact' hiển thị tóm tắt. 'minimal' chỉ hiển thị thông tin quan trọng. 'none' ẩn dòng trạng thái.",
		example: '{\n  "statusline": "compact"\n}',
	},
	assertions: {
		path: "assertions",
		type: "string[]",
		default: "[]",
		description: "List of user-defined assertions that are injected at the start of every session.",
		descriptionVi:
			"Danh sách các khẳng định do người dùng định nghĩa, được tiêm vào đầu mỗi phiên.",
		example: '{\n  "assertions": ["Use strict mode", "No console.logs"]\n}',
	},
};
