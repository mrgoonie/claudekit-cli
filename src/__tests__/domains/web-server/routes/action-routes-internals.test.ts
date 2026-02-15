import { describe, expect, test } from "bun:test";
import {
	buildLaunchCommand,
	clearActionDetectionCacheForTesting,
	detectDefinition,
	getDefinition,
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
});
