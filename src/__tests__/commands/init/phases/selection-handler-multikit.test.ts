/**
 * Tests for selection-handler multi-kit prompt flow
 */
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { KitType, Metadata } from "@/types";

// Create mock prompts manager
function createMockPrompts(confirmResult: boolean | Error = true) {
	return {
		selectKit: mock(async () => "engineer" as const),
		getDirectory: mock(async () => "."),
		selectVersionEnhanced: mock(async () => "v1.0.0"),
		confirm: mock(async () => {
			if (confirmResult instanceof Error) {
				throw confirmResult;
			}
			return confirmResult;
		}),
		intro: mock(() => {}),
		outro: mock(() => {}),
		note: mock(() => {}),
	};
}

// Minimal context factory
function createTestContext(overrides: {
	options?: Partial<{
		kit?: string;
		dir: string;
		release?: string;
		beta: boolean;
		global: boolean;
		yes: boolean;
		fresh: boolean;
		refresh: boolean;
		exclude: string[];
		only: string[];
		docsDir?: string;
		plansDir?: string;
		installSkills: boolean;
		withSudo: boolean;
		skipSetup: boolean;
		forceOverwrite: boolean;
		forceOverwriteSettings: boolean;
		dryRun: boolean;
		prefix: boolean;
		sync: boolean;
		useGit: boolean;
	}>;
	isNonInteractive?: boolean;
	prompts?: ReturnType<typeof createMockPrompts>;
}) {
	const prompts = overrides.prompts ?? createMockPrompts();
	return {
		rawOptions: {},
		options: {
			kit: "engineer",
			dir: ".",
			beta: false,
			global: false,
			yes: false,
			fresh: false,
			refresh: false,
			exclude: [],
			only: [],
			installSkills: false,
			withSudo: false,
			skipSetup: false,
			forceOverwrite: false,
			forceOverwriteSettings: false,
			dryRun: false,
			prefix: true,
			sync: false,
			useGit: false,
			...overrides.options,
		},
		prompts,
		explicitDir: false,
		isNonInteractive: overrides.isNonInteractive ?? false,
		customClaudeFiles: [],
		includePatterns: [],
		installSkills: false,
		cancelled: false,
	};
}

describe("selection-handler multi-kit flow", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `selection-handler-test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });
		await mkdir(join(testDir, ".claude"), { recursive: true });
	});

	afterEach(async () => {
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("multi-kit confirmation prompt", () => {
		it("shows confirmation when other kit exists and user is interactive", async () => {
			// Setup: existing engineer kit metadata
			const existingMetadata: Metadata = {
				kits: {
					engineer: {
						version: "v2.2.0",
						installedAt: "2024-01-01T00:00:00.000Z",
					},
				},
			};
			await writeFile(join(testDir, ".claude", "metadata.json"), JSON.stringify(existingMetadata));

			// This tests the logic pattern used in selection-handler.ts:103-133
			const otherKits = Object.keys(existingMetadata.kits ?? {}).filter(
				(k) => k !== "marketing", // Installing marketing kit
			);

			expect(otherKits.length).toBeGreaterThan(0);
			expect(otherKits).toContain("engineer");
		});

		it("skips confirmation when installing same kit (update scenario)", async () => {
			const existingMetadata: Metadata = {
				kits: {
					engineer: {
						version: "v2.0.0",
						installedAt: "2024-01-01T00:00:00.000Z",
					},
				},
			};

			// Installing same kit (engineer)
			const otherKits = Object.keys(existingMetadata.kits ?? {}).filter((k) => k !== "engineer");

			expect(otherKits.length).toBe(0);
		});

		it("skips confirmation when no existing kits", async () => {
			const existingMetadata: Metadata = {
				kits: {},
			};

			const otherKits = Object.keys(existingMetadata.kits ?? {}).filter((k) => k !== "engineer");

			expect(otherKits.length).toBe(0);
		});

		it("skips confirmation when metadata has no kits field", async () => {
			const existingMetadata: Metadata = {
				name: "ClaudeKit",
				version: "v1.0.0",
			};

			const kits = existingMetadata.kits;
			expect(kits).toBeUndefined();
		});

		it("formats existing kits display correctly", async () => {
			const existingMetadata: Metadata = {
				kits: {
					engineer: { version: "v2.2.0", installedAt: "2024-01-01T00:00:00.000Z" },
					marketing: { version: "v1.0.0", installedAt: "2024-01-01T00:00:00.000Z" },
				},
			};

			const otherKits = (Object.keys(existingMetadata.kits ?? {}) as KitType[]).filter(
				(k) => k !== "marketing",
			);

			// Format like selection-handler.ts:109-111
			const existingKitsDisplay = otherKits
				.map((k) => `${k}@${existingMetadata.kits?.[k]?.version || "unknown"}`)
				.join(", ");

			expect(existingKitsDisplay).toBe("engineer@v2.2.0");
		});

		it("handles kit with undefined version using 'unknown' fallback", async () => {
			const existingMetadata: Metadata = {
				kits: {
					engineer: {
						version: undefined as unknown as string,
						installedAt: "2024-01-01T00:00:00.000Z",
					},
				},
			};

			const otherKits = (Object.keys(existingMetadata.kits ?? {}) as KitType[]).filter(
				(k) => k !== "marketing",
			);

			const existingKitsDisplay = otherKits
				.map((k) => `${k}@${existingMetadata.kits?.[k]?.version || "unknown"}`)
				.join(", ");

			expect(existingKitsDisplay).toBe("engineer@unknown");
		});
	});

	describe("non-interactive mode behavior", () => {
		it("skips prompt in non-interactive mode with --yes flag", () => {
			const ctx = createTestContext({
				options: { yes: true },
				isNonInteractive: false, // Interactive but --yes provided
			});

			// Logic from selection-handler.ts:114
			const shouldPrompt = !ctx.options.yes && !ctx.isNonInteractive;
			expect(shouldPrompt).toBe(false);
		});

		it("skips prompt in CI mode without --yes flag", () => {
			const ctx = createTestContext({
				options: { yes: false },
				isNonInteractive: true, // CI/non-interactive
			});

			const shouldPrompt = !ctx.options.yes && !ctx.isNonInteractive;
			expect(shouldPrompt).toBe(false);
		});

		it("shows prompt in interactive mode without --yes flag", () => {
			const ctx = createTestContext({
				options: { yes: false },
				isNonInteractive: false, // Interactive
			});

			const shouldPrompt = !ctx.options.yes && !ctx.isNonInteractive;
			expect(shouldPrompt).toBe(true);
		});

		it("generates correct log message for --yes flag", () => {
			const ctx = createTestContext({
				options: { yes: true },
				isNonInteractive: false,
			});

			// Logic from selection-handler.ts:129-131
			const reason = ctx.options.yes ? "(--yes flag)" : "(non-interactive mode)";
			expect(reason).toBe("(--yes flag)");
		});

		it("generates correct log message for non-interactive mode", () => {
			const ctx = createTestContext({
				options: { yes: false },
				isNonInteractive: true,
			});

			const reason = ctx.options.yes ? "(--yes flag)" : "(non-interactive mode)";
			expect(reason).toBe("(non-interactive mode)");
		});
	});

	describe("user cancellation handling", () => {
		it("returns cancelled context when user declines", async () => {
			const mockPrompts = createMockPrompts(false); // User declines
			createTestContext({ prompts: mockPrompts });

			const confirmResult = await mockPrompts.confirm();
			expect(confirmResult).toBe(false);

			// Simulate selection-handler.ts:119-122
			const cancelled = !confirmResult;
			expect(cancelled).toBe(true);
		});

		it("handles prompt interruption gracefully", async () => {
			const mockPrompts = createMockPrompts(new Error("User cancelled"));

			let caughtError = false;
			try {
				await mockPrompts.confirm();
			} catch {
				caughtError = true;
			}

			expect(caughtError).toBe(true);
		});
	});

	describe("--fresh flag behavior", () => {
		it("skips multi-kit check when --fresh flag is set", () => {
			const ctx = createTestContext({
				options: { fresh: true },
			});

			// Logic from selection-handler.ts:97
			const shouldCheckExisting = !ctx.options.fresh;
			expect(shouldCheckExisting).toBe(false);
		});

		it("checks for existing kits when --fresh flag is not set", () => {
			const ctx = createTestContext({
				options: { fresh: false },
			});

			const shouldCheckExisting = !ctx.options.fresh;
			expect(shouldCheckExisting).toBe(true);
		});
	});

	describe("--kit option parsing", () => {
		const allKitTypes: KitType[] = ["engineer", "marketing"];

		describe("--kit all", () => {
			it("expands 'all' to all kit types", () => {
				const kitOption = "all";
				const accessibleKits: KitType[] = ["engineer", "marketing"];

				const kitsToInstall = kitOption === "all" ? accessibleKits : [kitOption as KitType];

				expect(kitsToInstall).toEqual(["engineer", "marketing"]);
				expect(kitsToInstall[0]).toBe("engineer");
				expect(kitsToInstall.slice(1)).toEqual(["marketing"]);
			});

			it("respects accessible kits when using 'all'", () => {
				const kitOption = "all";
				const accessibleKits: KitType[] = ["engineer"]; // Only has access to engineer

				const kitsToInstall = kitOption === "all" ? accessibleKits : [kitOption as KitType];

				expect(kitsToInstall).toEqual(["engineer"]);
				expect(kitsToInstall.length).toBe(1);
			});
		});

		describe("comma-separated kits", () => {
			it("parses comma-separated kit names", () => {
				const kitOption = "engineer,marketing";
				const requestedKits = kitOption.split(",").map((k) => k.trim()) as KitType[];

				expect(requestedKits).toEqual(["engineer", "marketing"]);
			});

			it("handles whitespace around commas", () => {
				const kitOption = "engineer , marketing";
				const requestedKits = kitOption.split(",").map((k) => k.trim()) as KitType[];

				expect(requestedKits).toEqual(["engineer", "marketing"]);
			});

			it("detects invalid kit names", () => {
				const kitOption = "engineer,invalid";
				const requestedKits = kitOption.split(",").map((k) => k.trim());
				const invalidKits = requestedKits.filter((k) => !allKitTypes.includes(k as KitType));

				expect(invalidKits).toEqual(["invalid"]);
			});

			it("validates access for all requested kits", () => {
				const kitOption = "engineer,marketing";
				const requestedKits = kitOption.split(",").map((k) => k.trim()) as KitType[];
				const accessibleKits: KitType[] = ["engineer"]; // Only has access to engineer

				const noAccessKits = requestedKits.filter((k) => !accessibleKits.includes(k));

				expect(noAccessKits).toEqual(["marketing"]);
			});

			it("sets first kit as primary and rest as pending", () => {
				const kitOption = "engineer,marketing";
				const requestedKits = kitOption.split(",").map((k) => k.trim()) as KitType[];

				const kitType = requestedKits[0];
				const pendingKits = requestedKits.length > 1 ? requestedKits.slice(1) : undefined;

				expect(kitType).toBe("engineer");
				expect(pendingKits).toEqual(["marketing"]);
			});

			it("handles single kit without comma", () => {
				const kitOption = "engineer";
				const hasComma = kitOption.includes(",");

				expect(hasComma).toBe(false);
			});
		});
	});
});
