/**
 * Tests for handleGlobalClaudeMd — CLAUDE.md copy/update logic in global mode
 */
import { afterEach, describe, expect, it, mock } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile } from "fs-extra";

// Mock logger to capture output
const loggerCalls: Record<string, string[]> = {
	success: [],
	debug: [],
	info: [],
	warning: [],
};

mock.module("@/shared/logger.js", () => ({
	logger: {
		success: (msg: string) => loggerCalls.success.push(msg),
		debug: (msg: string) => loggerCalls.debug.push(msg),
		info: (msg: string) => loggerCalls.info.push(msg),
		warning: (msg: string) => loggerCalls.warning.push(msg),
		verbose: () => {},
	},
}));

// Import after mocking
const { handleGlobalClaudeMd } = await import("@/commands/init/phases/post-install-handler.js");

function createTmpDir(): string {
	const dir = join(tmpdir(), `ck-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(dir, { recursive: true });
	return dir;
}

function createMockCtx(overrides: {
	extractDir: string;
	resolvedDir: string;
	fresh?: boolean;
	forceOverwrite?: boolean;
	isNonInteractive?: boolean;
	confirmResult?: boolean;
}) {
	return {
		extractDir: overrides.extractDir,
		resolvedDir: overrides.resolvedDir,
		options: {
			fresh: overrides.fresh ?? false,
			forceOverwrite: overrides.forceOverwrite ?? false,
			global: true,
		},
		isNonInteractive: overrides.isNonInteractive ?? true,
		prompts: {
			confirm: mock(async () => overrides.confirmResult ?? true),
		},
	} as any;
}

function resetLoggerCalls() {
	for (const key of Object.keys(loggerCalls)) {
		loggerCalls[key] = [];
	}
}

describe("handleGlobalClaudeMd", () => {
	const dirs: string[] = [];

	afterEach(() => {
		resetLoggerCalls();
		for (const dir of dirs) {
			try {
				rmSync(dir, { recursive: true, force: true });
			} catch {}
		}
		dirs.length = 0;
	});

	it("copies CLAUDE.md on first install (dest does not exist)", async () => {
		const extractDir = createTmpDir();
		const resolvedDir = createTmpDir();
		dirs.push(extractDir, resolvedDir);

		writeFileSync(join(extractDir, "CLAUDE.md"), "# New CLAUDE.md\n");

		const ctx = createMockCtx({ extractDir, resolvedDir });
		await handleGlobalClaudeMd(ctx);

		const result = await readFile(join(resolvedDir, "CLAUDE.md"), "utf-8");
		expect(result).toBe("# New CLAUDE.md\n");
		expect(loggerCalls.success).toContain("Copied CLAUDE.md to global directory");
	});

	it("skips when source CLAUDE.md does not exist", async () => {
		const extractDir = createTmpDir();
		const resolvedDir = createTmpDir();
		dirs.push(extractDir, resolvedDir);
		// No CLAUDE.md in extractDir

		const ctx = createMockCtx({ extractDir, resolvedDir });
		await handleGlobalClaudeMd(ctx);

		expect(loggerCalls.success).toHaveLength(0);
	});

	it("always replaces with --fresh flag", async () => {
		const extractDir = createTmpDir();
		const resolvedDir = createTmpDir();
		dirs.push(extractDir, resolvedDir);

		writeFileSync(join(extractDir, "CLAUDE.md"), "# Updated template\n");
		writeFileSync(join(resolvedDir, "CLAUDE.md"), "# Old user content\n");

		const ctx = createMockCtx({ extractDir, resolvedDir, fresh: true });
		await handleGlobalClaudeMd(ctx);

		const result = await readFile(join(resolvedDir, "CLAUDE.md"), "utf-8");
		expect(result).toBe("# Updated template\n");
		expect(loggerCalls.success).toContain("Updated CLAUDE.md in global directory");
	});

	it("always replaces with --force-overwrite flag", async () => {
		const extractDir = createTmpDir();
		const resolvedDir = createTmpDir();
		dirs.push(extractDir, resolvedDir);

		writeFileSync(join(extractDir, "CLAUDE.md"), "# Updated template\n");
		writeFileSync(join(resolvedDir, "CLAUDE.md"), "# Old user content\n");

		const ctx = createMockCtx({ extractDir, resolvedDir, forceOverwrite: true });
		await handleGlobalClaudeMd(ctx);

		const result = await readFile(join(resolvedDir, "CLAUDE.md"), "utf-8");
		expect(result).toBe("# Updated template\n");
		expect(loggerCalls.success).toContain("Updated CLAUDE.md in global directory");
	});

	it("skips update when content is identical", async () => {
		const extractDir = createTmpDir();
		const resolvedDir = createTmpDir();
		dirs.push(extractDir, resolvedDir);

		const content = "# Same content\n";
		writeFileSync(join(extractDir, "CLAUDE.md"), content);
		writeFileSync(join(resolvedDir, "CLAUDE.md"), content);

		const ctx = createMockCtx({ extractDir, resolvedDir });
		await handleGlobalClaudeMd(ctx);

		expect(loggerCalls.debug).toContain("CLAUDE.md already up to date");
		expect(loggerCalls.success).toHaveLength(0);
	});

	it("treats CRLF and LF as identical content", async () => {
		const extractDir = createTmpDir();
		const resolvedDir = createTmpDir();
		dirs.push(extractDir, resolvedDir);

		writeFileSync(join(extractDir, "CLAUDE.md"), "# Title\nLine 2\n");
		writeFileSync(join(resolvedDir, "CLAUDE.md"), "# Title\r\nLine 2\r\n");

		const ctx = createMockCtx({ extractDir, resolvedDir });
		await handleGlobalClaudeMd(ctx);

		expect(loggerCalls.debug).toContain("CLAUDE.md already up to date");
		expect(loggerCalls.success).toHaveLength(0);
	});

	it("updates in non-interactive mode when content differs (with warning)", async () => {
		const extractDir = createTmpDir();
		const resolvedDir = createTmpDir();
		dirs.push(extractDir, resolvedDir);

		writeFileSync(join(extractDir, "CLAUDE.md"), "# New version\n");
		writeFileSync(join(resolvedDir, "CLAUDE.md"), "# Old version\n");

		const ctx = createMockCtx({ extractDir, resolvedDir, isNonInteractive: true });
		await handleGlobalClaudeMd(ctx);

		const result = await readFile(join(resolvedDir, "CLAUDE.md"), "utf-8");
		expect(result).toBe("# New version\n");
		expect(loggerCalls.warning.some((m) => m.includes("content differs"))).toBe(true);
	});

	it("prompts user in interactive mode when content differs", async () => {
		const extractDir = createTmpDir();
		const resolvedDir = createTmpDir();
		dirs.push(extractDir, resolvedDir);

		writeFileSync(join(extractDir, "CLAUDE.md"), "# New version\n");
		writeFileSync(join(resolvedDir, "CLAUDE.md"), "# User customized\n");

		const ctx = createMockCtx({
			extractDir,
			resolvedDir,
			isNonInteractive: false,
			confirmResult: true,
		});
		await handleGlobalClaudeMd(ctx);

		expect(ctx.prompts.confirm).toHaveBeenCalledTimes(1);
		const result = await readFile(join(resolvedDir, "CLAUDE.md"), "utf-8");
		expect(result).toBe("# New version\n");
	});

	it("preserves user file when interactive user declines update", async () => {
		const extractDir = createTmpDir();
		const resolvedDir = createTmpDir();
		dirs.push(extractDir, resolvedDir);

		writeFileSync(join(extractDir, "CLAUDE.md"), "# New version\n");
		writeFileSync(join(resolvedDir, "CLAUDE.md"), "# User customized\n");

		const ctx = createMockCtx({
			extractDir,
			resolvedDir,
			isNonInteractive: false,
			confirmResult: false,
		});
		await handleGlobalClaudeMd(ctx);

		const result = await readFile(join(resolvedDir, "CLAUDE.md"), "utf-8");
		expect(result).toBe("# User customized\n");
		expect(loggerCalls.info).toContain("CLAUDE.md preserved (user chose to keep existing)");
	});
});
