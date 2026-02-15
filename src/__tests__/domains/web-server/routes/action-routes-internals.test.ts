import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
	buildLaunchCommand,
	buildSystemEditorCommand,
	clearActionDetectionCacheForTesting,
	detectDefinition,
	getDefinition,
	isPathInsideBase,
	resolveDefaultApp,
} from "@/domains/web-server/routes/action-routes.js";

function option(id: Parameters<typeof getDefinition>[0], available = true) {
	const confidence = available ? ("high" as const) : null;
	return {
		id,
		label: id,
		detected: available,
		available,
		confidence,
		reason: available ? "test" : "missing",
		openMode: "open-directory" as const,
		capabilities: ["open-directory"],
	};
}

describe("action routes internals", () => {
	const originalEditor = process.env.EDITOR;
	const originalVisual = process.env.VISUAL;

	afterEach(() => {
		if (originalEditor === undefined) {
			process.env.EDITOR = undefined;
		} else {
			process.env.EDITOR = originalEditor;
		}

		if (originalVisual === undefined) {
			process.env.VISUAL = undefined;
		} else {
			process.env.VISUAL = originalVisual;
		}
	});

	test("buildLaunchCommand avoids shell-based Linux launch", () => {
		const dirPath = "/tmp/ck-project";
		const command = buildLaunchCommand(dirPath);

		if (process.platform === "linux") {
			expect(command.command).toBe("x-terminal-emulator");
			expect(command.args[0]).toBe("-e");
			expect(command.args).not.toContain("bash");
			expect(command.args).not.toContain("-lc");
			expect(command.args[1].length).toBeGreaterThan(0);
			expect(command.cwd).toBe(dirPath);
			return;
		}

		if (process.platform === "darwin") {
			expect(command.command).toBe("osascript");
			expect(command.args).toContain("--");
			expect(command.args).toContain(dirPath);
			return;
		}

		expect(command.command).toBe("cmd.exe");
		expect(command.args).toContain("/k");
		expect(command.args).toContain("claude");
		expect(command.cwd).toBe(dirPath);
	});

	test("resolveDefaultApp uses project then global then system fallback", () => {
		const options = [option("system-terminal"), option("warp"), option("iterm2")];

		const fromProject = resolveDefaultApp("terminal", options, "warp", "iterm2");
		expect(fromProject).toEqual({ appId: "warp", source: "project" });

		const fromGlobal = resolveDefaultApp("terminal", options, "invalid-app", "iterm2");
		expect(fromGlobal).toEqual({ appId: "iterm2", source: "global" });

		const fromSystem = resolveDefaultApp(
			"terminal",
			[option("system-terminal")],
			"invalid-app",
			"__global__",
		);
		expect(fromSystem).toEqual({ appId: "system-terminal", source: "system" });
	});

	test("detectDefinition caches results until cache is cleared", () => {
		clearActionDetectionCacheForTesting();
		const definition = getDefinition("system-terminal");

		const first = detectDefinition(definition);
		const second = detectDefinition(definition);
		expect(second).toBe(first);

		clearActionDetectionCacheForTesting();
		const third = detectDefinition(definition);
		expect(third).not.toBe(first);
	});

	test("buildSystemEditorCommand validates and tokenizes EDITOR", () => {
		process.env.VISUAL = "";
		process.env.EDITOR = process.platform === "win32" ? "cmd.exe /c" : "sh -c";
		const command = buildSystemEditorCommand("/tmp/editor-target");
		expect(command.command).toBe(process.platform === "win32" ? "cmd.exe" : "sh");
		expect(command.args).toContain("/tmp/editor-target");
	});

	test("buildSystemEditorCommand rejects unsafe editor command", () => {
		process.env.VISUAL = "";
		process.env.EDITOR = "evil;rm -rf /";
		expect(() => buildSystemEditorCommand("/tmp/editor-target")).toThrow(
			"Invalid system editor command",
		);
	});

	test("isPathInsideBase compares normalized paths", () => {
		const base = join("/tmp", "ck-path-base");
		const inside = join(base, "folder", "..", "project");
		const outside = join(base, "..", "outside");

		expect(isPathInsideBase(inside, base)).toBe(true);
		expect(isPathInsideBase(outside, base)).toBe(false);
	});
});
