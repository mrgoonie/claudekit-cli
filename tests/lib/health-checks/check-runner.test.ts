import { describe, expect, mock, test } from "bun:test";
import { CheckRunner } from "../../../src/domains/health-checks/check-runner.js";
import type { CheckResult, Checker } from "../../../src/domains/health-checks/types.js";

describe("CheckRunner", () => {
	describe("registerChecker", () => {
		test("registers a single checker", () => {
			const runner = new CheckRunner({});
			const mockChecker: Checker = {
				group: "system",
				run: async () => [],
			};

			runner.registerChecker(mockChecker);
			expect(runner.getCheckers()).toHaveLength(1);
		});

		test("registers multiple checkers via registerCheckers", () => {
			const runner = new CheckRunner({});
			const checkers: Checker[] = [
				{ group: "system", run: async () => [] },
				{ group: "auth", run: async () => [] },
				{ group: "claudekit", run: async () => [] },
			];

			runner.registerCheckers(checkers);
			expect(runner.getCheckers()).toHaveLength(3);
		});
	});

	describe("run", () => {
		test("executes registered checker and returns results", async () => {
			const runner = new CheckRunner({});
			const mockRun = mock(() =>
				Promise.resolve<CheckResult[]>([
					{
						id: "mock-check",
						name: "Mock Check",
						group: "system",
						status: "pass",
						message: "All good",
						autoFixable: false,
					},
				]),
			);

			const mockChecker: Checker = {
				group: "system",
				run: mockRun,
			};

			runner.registerChecker(mockChecker);
			const summary = await runner.run();

			expect(mockRun).toHaveBeenCalled();
			expect(summary.total).toBe(1);
			expect(summary.passed).toBe(1);
			expect(summary.failed).toBe(0);
		});

		test("aggregates results from multiple checkers", async () => {
			const runner = new CheckRunner({});

			runner.registerChecker({
				group: "system",
				run: async () => [
					{
						id: "sys-1",
						name: "System 1",
						group: "system",
						status: "pass",
						message: "OK",
						autoFixable: false,
					},
					{
						id: "sys-2",
						name: "System 2",
						group: "system",
						status: "warn",
						message: "Warning",
						autoFixable: false,
					},
				],
			});

			runner.registerChecker({
				group: "auth",
				run: async () => [
					{
						id: "auth-1",
						name: "Auth 1",
						group: "auth",
						status: "fail",
						message: "Failed",
						autoFixable: true,
					},
				],
			});

			const summary = await runner.run();

			expect(summary.total).toBe(3);
			expect(summary.passed).toBe(1);
			expect(summary.warnings).toBe(1);
			expect(summary.failed).toBe(1);
		});

		test("counts fixed checks correctly", async () => {
			const runner = new CheckRunner({});

			runner.registerChecker({
				group: "system",
				run: async () => [
					{
						id: "fixed-1",
						name: "Fixed 1",
						group: "system",
						status: "pass",
						message: "OK",
						autoFixable: true,
						fixed: true,
					},
					{
						id: "fixed-2",
						name: "Fixed 2",
						group: "system",
						status: "pass",
						message: "OK",
						autoFixable: true,
						fixed: true,
					},
				],
			});

			const summary = await runner.run();
			expect(summary.fixed).toBe(2);
		});

		test("handles info status (not counted in pass/fail)", async () => {
			const runner = new CheckRunner({});

			runner.registerChecker({
				group: "system",
				run: async () => [
					{
						id: "info-1",
						name: "Info Check",
						group: "system",
						status: "info",
						message: "Informational",
						autoFixable: false,
					},
				],
			});

			const summary = await runner.run();
			expect(summary.total).toBe(1);
			expect(summary.passed).toBe(0);
			expect(summary.warnings).toBe(0);
			expect(summary.failed).toBe(0);
		});

		test("returns valid ISO timestamp", async () => {
			const runner = new CheckRunner({});
			runner.registerChecker({ group: "system", run: async () => [] });

			const summary = await runner.run();

			expect(summary.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		});
	});

	describe("group filtering", () => {
		test("filters checkers by specified groups", async () => {
			const runner = new CheckRunner({ groups: ["system"] });

			const systemRun = mock(() =>
				Promise.resolve<CheckResult[]>([
					{
						id: "sys",
						name: "System",
						group: "system",
						status: "pass",
						message: "OK",
						autoFixable: false,
					},
				]),
			);

			const authRun = mock(() =>
				Promise.resolve<CheckResult[]>([
					{
						id: "auth",
						name: "Auth",
						group: "auth",
						status: "pass",
						message: "OK",
						autoFixable: false,
					},
				]),
			);

			runner.registerChecker({ group: "system", run: systemRun });
			runner.registerChecker({ group: "auth", run: authRun });

			await runner.run();

			expect(systemRun).toHaveBeenCalled();
			expect(authRun).not.toHaveBeenCalled();
		});

		test("runs all checkers when no groups specified", async () => {
			const runner = new CheckRunner({});

			const systemRun = mock(() => Promise.resolve<CheckResult[]>([]));
			const authRun = mock(() => Promise.resolve<CheckResult[]>([]));

			runner.registerChecker({ group: "system", run: systemRun });
			runner.registerChecker({ group: "auth", run: authRun });

			await runner.run();

			expect(systemRun).toHaveBeenCalled();
			expect(authRun).toHaveBeenCalled();
		});

		test("filters by multiple groups", async () => {
			const runner = new CheckRunner({ groups: ["system", "auth"] });

			const systemRun = mock(() => Promise.resolve<CheckResult[]>([]));
			const authRun = mock(() => Promise.resolve<CheckResult[]>([]));
			const claudekitRun = mock(() => Promise.resolve<CheckResult[]>([]));

			runner.registerChecker({ group: "system", run: systemRun });
			runner.registerChecker({ group: "auth", run: authRun });
			runner.registerChecker({ group: "claudekit", run: claudekitRun });

			await runner.run();

			expect(systemRun).toHaveBeenCalled();
			expect(authRun).toHaveBeenCalled();
			expect(claudekitRun).not.toHaveBeenCalled();
		});
	});

	describe("getOptions", () => {
		test("returns copy of options", () => {
			const options = { fix: true, checkOnly: false, verbose: true };
			const runner = new CheckRunner(options);

			const retrieved = runner.getOptions();

			expect(retrieved).toEqual(options);
			expect(retrieved).not.toBe(options); // Should be a copy
		});
	});

	describe("parallel execution", () => {
		test("executes checkers in parallel", async () => {
			const runner = new CheckRunner({});
			const executionOrder: string[] = [];

			runner.registerChecker({
				group: "system",
				run: async () => {
					executionOrder.push("system-start");
					await new Promise((r) => setTimeout(r, 50));
					executionOrder.push("system-end");
					return [];
				},
			});

			runner.registerChecker({
				group: "auth",
				run: async () => {
					executionOrder.push("auth-start");
					await new Promise((r) => setTimeout(r, 10));
					executionOrder.push("auth-end");
					return [];
				},
			});

			await runner.run();

			// Both should start before either ends (parallel execution)
			expect(executionOrder.indexOf("system-start")).toBeLessThan(
				executionOrder.indexOf("system-end"),
			);
			expect(executionOrder.indexOf("auth-start")).toBeLessThan(executionOrder.indexOf("auth-end"));
			// Auth should finish before system (10ms vs 50ms)
			expect(executionOrder.indexOf("auth-end")).toBeLessThan(executionOrder.indexOf("system-end"));
		});
	});
});
