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
		validValues: ["auto", "single-repo", "monorepo", "library"],
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
			"next",
			"nuxt",
			"astro",
			"remix",
			"svelte",
			"vue",
			"react",
			"express",
			"fastify",
			"hono",
			"elysia",
		],
		description: "Override automatic framework detection.",
		descriptionVi: "Ghi đè phát hiện framework tự động.",
		example: '{\n  "project": {\n    "framework": "next"\n  }\n}',
	},
	assertions: {
		path: "assertions",
		type: "string[]",
		default: "[]",
		description: "List of user-defined assertions that are injected at the start of every session.",
		descriptionVi: "Danh sách các khẳng định do người dùng định nghĩa, được tiêm vào đầu mỗi phiên.",
		example: '{\n  "assertions": ["Use strict mode", "No console.logs"]\n}',
	},
};
