import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ProjectsRegistryManager } from "@/domains/claudekit-data/index.js";
import { readHookDiagnostics } from "@/services/claude-data/hook-log-reader.js";
import { PathResolver } from "@/shared/path-resolver.js";

const TEST_HOME = join(tmpdir(), `ck-hook-diagnostics-${Date.now()}-${process.pid}`);
process.env.CK_TEST_HOME = TEST_HOME;

async function writeHookLog(filePath: string, lines: string[]): Promise<void> {
	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

function logLine(
	hook: string,
	ts: string,
	status: string,
	extra: Record<string, unknown> = {},
): string {
	return JSON.stringify({
		ts,
		hook,
		status,
		...extra,
	});
}

beforeEach(async () => {
	ProjectsRegistryManager.clearCache();
	await rm(TEST_HOME, { recursive: true, force: true });
	await mkdir(TEST_HOME, { recursive: true });
});

afterAll(async () => {
	ProjectsRegistryManager.clearCache();
	await rm(TEST_HOME, { recursive: true, force: true });
	process.env.CK_TEST_HOME = undefined;
});

describe("readHookDiagnostics", () => {
	test("reads global hook diagnostics and summarizes malformed lines", async () => {
		const logPath = join(PathResolver.getGlobalKitDir(), "hooks", ".logs", "hook-log.jsonl");
		await writeHookLog(logPath, [
			logLine("scout-block", "2026-03-18T10:00:00.000Z", "block", {
				event: "PreToolUse",
				tool: "Grep",
				target: "node_modules",
				note: "broad-pattern",
			}),
			"{ invalid-json",
			logLine("usage-context-awareness", "2026-03-18T10:05:00.000Z", "warn", {
				event: "PostToolUse",
				tool: "Edit",
				note: "missing-credentials",
			}),
		]);

		const result = await readHookDiagnostics({ scope: "global", limit: 1 });

		expect(result.exists).toBe(true);
		expect(result.path).toBe(logPath);
		expect(result.entries).toHaveLength(1);
		expect(result.entries[0]?.hook).toBe("usage-context-awareness");
		expect(result.summary.total).toBe(2);
		expect(result.summary.parseErrors).toBe(1);
		expect(result.summary.lastEventAt).toBe("2026-03-18T10:05:00.000Z");
		expect(result.summary.statusCounts.warn).toBe(1);
		expect(result.summary.statusCounts.block).toBe(1);
		expect(result.summary.toolCounts.Edit).toBe(1);
		expect(result.summary.hookCounts["scout-block"]).toBe(1);
	});

	test("reads project diagnostics through registry-backed project ids", async () => {
		const projectDir = join(TEST_HOME, "project-alpha");
		const logPath = join(projectDir, ".claude", "hooks", ".logs", "hook-log.jsonl");

		await mkdir(projectDir, { recursive: true });
		await writeHookLog(logPath, [
			logLine("privacy-block", "2026-03-18T09:00:00.000Z", "block", {
				event: "PreToolUse",
				tool: "Read",
				target: ".env",
				note: "approval-required",
			}),
		]);

		const project = await ProjectsRegistryManager.addProject(projectDir, { alias: "alpha" });
		const result = await readHookDiagnostics({
			scope: "project",
			projectId: project.id,
			limit: 10,
		});

		expect(result.exists).toBe(true);
		expect(result.path).toBe(logPath);
		expect(result.projectId).toBe(project.id);
		expect(result.entries).toHaveLength(1);
		expect(result.entries[0]?.target).toBe(".env");
		expect(result.summary.statusCounts.block).toBe(1);
		expect(result.summary.toolCounts.Read).toBe(1);
	});

	test("resolves discovered project ids without registry entries", async () => {
		const projectDir = join(TEST_HOME, "project-discovered");
		const logPath = join(projectDir, ".claude", "hooks", ".logs", "hook-log.jsonl");
		const discoveredDir = join(
			homedir(),
			".claude",
			"projects",
			`ck-hook-discovered-${Date.now()}-${process.pid}`,
		);
		const projectId = `discovered-${Buffer.from(projectDir).toString("base64url")}`;

		try {
			await mkdir(projectDir, { recursive: true });
			await mkdir(discoveredDir, { recursive: true });
			await writeFile(
				join(discoveredDir, "session.jsonl"),
				`${JSON.stringify({ cwd: projectDir })}\n`,
				"utf8",
			);
			await writeHookLog(logPath, [
				logLine("plan-format-kanban", "2026-03-18T11:00:00.000Z", "warn", {
					event: "PostToolUse",
					tool: "Write",
					note: "1-warning(s)",
				}),
			]);

			const result = await readHookDiagnostics({
				scope: "project",
				projectId,
				limit: 10,
			});

			expect(result.exists).toBe(true);
			expect(result.path).toBe(logPath);
			expect(result.entries[0]?.hook).toBe("plan-format-kanban");
			expect(result.summary.hookCounts["plan-format-kanban"]).toBe(1);
		} finally {
			await rm(discoveredDir, { recursive: true, force: true });
		}
	});

	test("treats schema-invalid entries as parse errors", async () => {
		const logPath = join(PathResolver.getGlobalKitDir(), "hooks", ".logs", "hook-log.jsonl");
		await writeHookLog(logPath, [
			logLine("good", "2026-03-18T10:05:00.000Z", "ok"),
			JSON.stringify({ ts: "invalid", hook: "bad-ts", status: "warn" }),
			JSON.stringify({ hook: "missing-ts", status: "ok" }),
		]);

		const result = await readHookDiagnostics({ scope: "global", limit: 10 });

		expect(result.entries).toHaveLength(1);
		expect(result.entries[0]?.hook).toBe("good");
		expect(result.summary.total).toBe(1);
		expect(result.summary.parseErrors).toBe(2);
		expect(result.summary.lastEventAt).toBe("2026-03-18T10:05:00.000Z");
	});

	test("treats projectId=global as the global hook log alias", async () => {
		const logPath = join(PathResolver.getGlobalKitDir(), "hooks", ".logs", "hook-log.jsonl");
		await writeHookLog(logPath, [logLine("global-hook", "2026-03-18T12:00:00.000Z", "ok")]);

		const result = await readHookDiagnostics({ scope: "project", projectId: "global", limit: 10 });

		expect(result.scope).toBe("global");
		expect(result.projectId).toBeNull();
		expect(result.path).toBe(logPath);
		expect(result.exists).toBe(true);
	});

	test("marks oversized diagnostics windows as truncated", async () => {
		const logPath = join(PathResolver.getGlobalKitDir(), "hooks", ".logs", "hook-log.jsonl");
		const lines = Array.from({ length: 2_200 }, (_, index) =>
			logLine(`hook-${index}`, "2026-03-18T10:00:00.000Z", "ok"),
		);
		await writeHookLog(logPath, lines);

		const result = await readHookDiagnostics({ scope: "global", limit: 10 });

		expect(result.summary.truncated).toBe(true);
		expect(result.summary.inspectedLines).toBeLessThanOrEqual(2_000);
		expect(result.summary.total).toBeLessThanOrEqual(2_000);
	});
});
