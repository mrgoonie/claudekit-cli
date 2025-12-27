/**
 * Translation objects for EN and VI languages
 * Type-safe keys enforced by TranslationKey type
 */
export const translations = {
	en: {
		// App.tsx
		loading: "Loading...",
		error: "Error",
		selectProject: "Select a project to view dashboard",

		// Header.tsx
		controlCenter: "Control Center",
		settings: "Settings",
		sync: "Sync",
		offline: "Offline",
		switchToLight: "Switch to light mode",
		switchToDark: "Switch to dark mode",

		// Sidebar.tsx
		settingsSection: "Settings",
		configEditor: "Config Editor",
		projects: "Projects",
		addProject: "Add Project",
		global: "Global",
		skills: "Skills",
		health: "Health",
		collapse: "Collapse",

		// ProjectDashboard.tsx
		sessions: "sessions",
		noSessions: "No sessions",
		terminal: "Terminal",
		terminalSub: "Open bash at path",
		editor: "Editor",
		editorSub: "Open in VS Code",
		launch: "Launch",
		launchSub: "Start Claude Code",
		config: "Config",
		configSub: "Manage ccs settings",
		recentSessions: "Recent Sessions",
		viewAllHistory: "View All History",
		loadingSessions: "Loading sessions...",
		noSessionsFound: "No sessions found",
		configuration: "Configuration",
		activeKit: "Active Kit",
		aiModel: "AI Model",
		hooks: "Hooks",
		active: "active",
		mcpServers: "MCP Servers",
		connected: "connected",
		editProjectConfig: "Edit Project Config",
		globalSkills: "Global Skills",
		loadingSkills: "Loading skills...",
		noDescription: "No description",
		browseSkillsMarketplace: "Browse Skills Marketplace",

		// ConfigEditor.tsx
		backToDashboard: "Back to Dashboard",
		educationalConfigEditor: "Educational Config Editor",
		discard: "Discard",
		saveChanges: "Save Changes",
		mergedView: "Merged View",
		localConfig: "Local (.ck.json)",
		globalConfig: "Global (~/.claude/)",
		syntaxValid: "Syntax Valid",
		configurationHelp: "Configuration Help",
		field: "Field",
		type: "Type",
		default: "Default",
		description: "Description",
		validValues: "Valid Values",
		systemEffect: "System Effect",
		exampleUsage: "Example Usage",
		knowledgeBase: "Knowledge Base",
		clickToSeeHelp:
			"Click on any configuration field to see detailed documentation and usage examples.",
		extractedFrom: "Extracted from ClaudeKit v2.x Specification",

		// AddProjectModal.tsx
		addProjectTitle: "Add Project",
		addProjectDescription: "Add a new ClaudeKit project to the control center",
		projectPath: "Project Path",
		pathPlaceholder: "/path/to/project",
		alias: "Alias",
		aliasOptional: "(optional)",
		aliasPlaceholder: "my-project",
		aliasDescription: "Custom display name for the project",
		pathRequired: "Path is required",
		failedToAdd: "Failed to add project",
		cancel: "Cancel",
		adding: "Adding...",

		// ErrorBoundary.tsx
		somethingWentWrong: "Something went wrong",
		reloadApp: "Reload App",
	},
	vi: {
		// App.tsx
		loading: "Đang tải...",
		error: "Lỗi",
		selectProject: "Chọn dự án để xem bảng điều khiển",

		// Header.tsx
		controlCenter: "Trung tâm điều khiển",
		settings: "Cài đặt",
		sync: "Đồng bộ",
		offline: "Ngoại tuyến",
		switchToLight: "Chuyển sang chế độ sáng",
		switchToDark: "Chuyển sang chế độ tối",

		// Sidebar.tsx
		settingsSection: "Cài đặt",
		configEditor: "Trình chỉnh sửa cấu hình",
		projects: "Dự án",
		addProject: "Thêm dự án",
		global: "Toàn cục",
		skills: "Kỹ năng",
		health: "Sức khỏe",
		collapse: "Thu gọn",

		// ProjectDashboard.tsx
		sessions: "phiên",
		noSessions: "Không có phiên",
		terminal: "Terminal",
		terminalSub: "Mở bash tại đường dẫn",
		editor: "Trình soạn thảo",
		editorSub: "Mở trong VS Code",
		launch: "Khởi chạy",
		launchSub: "Bắt đầu Claude Code",
		config: "Cấu hình",
		configSub: "Quản lý cài đặt ccs",
		recentSessions: "Phiên gần đây",
		viewAllHistory: "Xem tất cả lịch sử",
		loadingSessions: "Đang tải phiên...",
		noSessionsFound: "Không tìm thấy phiên nào",
		configuration: "Cấu hình",
		activeKit: "Kit hoạt động",
		aiModel: "Mô hình AI",
		hooks: "Hooks",
		active: "hoạt động",
		mcpServers: "Máy chủ MCP",
		connected: "kết nối",
		editProjectConfig: "Chỉnh sửa cấu hình dự án",
		globalSkills: "Kỹ năng toàn cục",
		loadingSkills: "Đang tải kỹ năng...",
		noDescription: "Không có mô tả",
		browseSkillsMarketplace: "Duyệt Skills Marketplace",

		// ConfigEditor.tsx
		backToDashboard: "Quay lại bảng điều khiển",
		educationalConfigEditor: "Trình chỉnh sửa cấu hình hướng dẫn",
		discard: "Hủy bỏ",
		saveChanges: "Lưu thay đổi",
		mergedView: "Chế độ gộp",
		localConfig: "Cục bộ (.ck.json)",
		globalConfig: "Toàn cục (~/.claude/)",
		syntaxValid: "Cú pháp hợp lệ",
		configurationHelp: "Hướng dẫn cấu hình",
		field: "Trường",
		type: "Kiểu",
		default: "Mặc định",
		description: "Mô tả",
		validValues: "Giá trị hợp lệ",
		systemEffect: "Hiệu ứng hệ thống",
		exampleUsage: "Ví dụ sử dụng",
		knowledgeBase: "Cơ sở kiến thức",
		clickToSeeHelp:
			"Nhấp vào bất kỳ trường cấu hình nào để xem tài liệu chi tiết và ví dụ sử dụng.",
		extractedFrom: "Trích xuất từ ClaudeKit v2.x Specification",

		// AddProjectModal.tsx
		addProjectTitle: "Thêm dự án",
		addProjectDescription: "Thêm dự án ClaudeKit mới vào trung tâm điều khiển",
		projectPath: "Đường dẫn dự án",
		pathPlaceholder: "/đường/dẫn/dự/án",
		alias: "Bí danh",
		aliasOptional: "(tùy chọn)",
		aliasPlaceholder: "dự-án-của-tôi",
		aliasDescription: "Tên hiển thị tùy chỉnh cho dự án",
		pathRequired: "Đường dẫn bắt buộc",
		failedToAdd: "Không thể thêm dự án",
		cancel: "Hủy",
		adding: "Đang thêm...",

		// ErrorBoundary.tsx
		somethingWentWrong: "Đã xảy ra lỗi",
		reloadApp: "Tải lại ứng dụng",
	},
} as const;

export type TranslationKey = keyof typeof translations.en;
export type Language = keyof typeof translations;
