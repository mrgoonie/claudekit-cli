import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	discoverMcpServers,
	getHookDiagnostics,
	getSessionDetail,
	listProjectSessions,
	readSettings,
	scanForProjects,
	settingsFileExists,
	writeSettings,
} from "../tauri-commands";

vi.mock("@tauri-apps/api/core", () => ({
	invoke: vi.fn(),
}));

describe("tauri command wrappers", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.mocked(invoke).mockResolvedValue(undefined);
	});

	it("uses camelCase keys for settings commands", async () => {
		await readSettings("/tmp/project");
		expect(invoke).toHaveBeenNthCalledWith(1, "read_settings", { projectPath: "/tmp/project" });

		await settingsFileExists("/tmp/project");
		expect(invoke).toHaveBeenNthCalledWith(2, "settings_file_exists", {
			projectPath: "/tmp/project",
		});

		await writeSettings("/tmp/project", { model: "gpt-5" });
		expect(invoke).toHaveBeenNthCalledWith(3, "write_settings", {
			projectPath: "/tmp/project",
			settings: { model: "gpt-5" },
		});
	});

	it("uses camelCase keys for collection and detail commands", async () => {
		await scanForProjects("/tmp/root", 4);
		expect(invoke).toHaveBeenNthCalledWith(1, "scan_for_projects", {
			rootPath: "/tmp/root",
			maxDepth: 4,
		});

		await listProjectSessions("project-1", 25);
		expect(invoke).toHaveBeenNthCalledWith(2, "list_project_sessions", {
			projectId: "project-1",
			limit: 25,
		});

		await getSessionDetail("project-1", "session-1", 50, 10);
		expect(invoke).toHaveBeenNthCalledWith(3, "get_session_detail", {
			projectId: "project-1",
			sessionId: "session-1",
			limit: 50,
			offset: 10,
		});
	});

	it("uses camelCase keys for optional command args", async () => {
		await getHookDiagnostics("project", "project-1", 10);
		expect(invoke).toHaveBeenNthCalledWith(1, "get_hook_diagnostics", {
			scope: "project",
			projectId: "project-1",
			limit: 10,
		});

		await discoverMcpServers("/tmp/project");
		expect(invoke).toHaveBeenNthCalledWith(2, "discover_mcp_servers", {
			projectPath: "/tmp/project",
		});
	});
});
