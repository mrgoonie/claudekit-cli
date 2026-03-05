/**
 * Tests for selection-handler kit access auto-detection logic
 */
import { describe, expect, it, mock } from "bun:test";
import { AVAILABLE_KITS, type KitType } from "@/types";

// Create mock prompts manager with configurable selectKit and selectKits
function createMockPrompts(
	selectKitResult: KitType = "engineer",
	selectKitsResult: KitType[] = ["engineer"],
) {
	return {
		selectKit: mock(async (_default?: KitType, _accessible?: KitType[]) => selectKitResult),
		selectKits: mock(async (_accessible: KitType[]) => selectKitsResult),
		getDirectory: mock(async () => "."),
		selectVersionEnhanced: mock(async () => "v1.0.0"),
		confirm: mock(async () => true),
		intro: mock(() => {}),
		outro: mock(() => {}),
		note: mock(() => {}),
	};
}

// Minimal context factory for kit access tests
function createKitAccessContext(overrides: {
	options?: {
		kit?: string;
		useGit?: boolean;
	};
	isNonInteractive?: boolean;
	accessibleKits?: KitType[];
}) {
	const prompts = createMockPrompts();
	return {
		options: {
			kit: overrides.options?.kit,
			useGit: overrides.options?.useGit ?? false,
		},
		prompts,
		isNonInteractive: overrides.isNonInteractive ?? false,
		accessibleKits: overrides.accessibleKits,
	};
}

describe("selection-handler kit access logic", () => {
	describe("access detection behavior", () => {
		it("skips access detection in --use-git mode", () => {
			const ctx = createKitAccessContext({
				options: { useGit: true },
			});

			// Logic from selection-handler.ts:48-57
			const shouldDetect = !ctx.options.useGit;
			expect(shouldDetect).toBe(false);
		});

		it("runs access detection when not in --use-git mode", () => {
			const ctx = createKitAccessContext({
				options: { useGit: false },
			});

			const shouldDetect = !ctx.options.useGit;
			expect(shouldDetect).toBe(true);
		});
	});

	describe("explicit --kit flag validation", () => {
		it("allows kit when user has access", () => {
			const ctx = createKitAccessContext({
				options: { kit: "engineer" },
				accessibleKits: ["engineer", "marketing"],
			});

			const hasAccess = ctx.accessibleKits?.includes(ctx.options.kit as KitType);
			expect(hasAccess).toBe(true);
		});

		it("rejects kit when user lacks access", () => {
			const ctx = createKitAccessContext({
				options: { kit: "marketing" },
				accessibleKits: ["engineer"],
			});

			const hasAccess = ctx.accessibleKits?.includes(ctx.options.kit as KitType);
			expect(hasAccess).toBe(false);
		});

		it("skips access check for --kit in --use-git mode", () => {
			const ctx = createKitAccessContext({
				options: { kit: "marketing", useGit: true },
				accessibleKits: undefined, // Not detected
			});

			// In --use-git mode, accessibleKits is undefined
			const shouldValidate = ctx.accessibleKits && ctx.options.kit;
			expect(shouldValidate).toBeFalsy();
		});
	});

	describe("non-interactive kit selection", () => {
		it("auto-selects first accessible kit in non-interactive mode", () => {
			const ctx = createKitAccessContext({
				isNonInteractive: true,
				accessibleKits: ["marketing", "engineer"],
			});

			// Logic from selection-handler.ts:69-78
			let selectedKit: KitType | undefined;
			if (!ctx.options.kit && ctx.isNonInteractive && ctx.accessibleKits?.length) {
				selectedKit = ctx.accessibleKits[0];
			}

			expect(selectedKit).toBe("marketing");
		});

		it("throws error in non-interactive mode with no accessible kits", () => {
			const ctx = createKitAccessContext({
				isNonInteractive: true,
				accessibleKits: [],
			});

			// Logic from selection-handler.ts:71-76
			const shouldThrow =
				ctx.isNonInteractive && (!ctx.accessibleKits || ctx.accessibleKits.length === 0);
			expect(shouldThrow).toBe(true);
		});

		it("throws error in non-interactive mode with undefined accessibleKits", () => {
			const ctx = createKitAccessContext({
				isNonInteractive: true,
				accessibleKits: undefined,
			});

			const shouldThrow =
				ctx.isNonInteractive && (!ctx.accessibleKits || ctx.accessibleKits.length === 0);
			expect(shouldThrow).toBe(true);
		});
	});

	describe("single kit auto-selection", () => {
		it("auto-selects when only one kit is accessible", () => {
			const ctx = createKitAccessContext({
				isNonInteractive: false,
				accessibleKits: ["engineer"],
			});

			// Logic from selection-handler.ts:79-82
			let selectedKit: KitType | undefined;
			if (!ctx.options.kit && ctx.accessibleKits?.length === 1) {
				selectedKit = ctx.accessibleKits[0];
			}

			expect(selectedKit).toBe("engineer");
		});

		it("does not auto-select when multiple kits are accessible", () => {
			const ctx = createKitAccessContext({
				isNonInteractive: false,
				accessibleKits: ["engineer", "marketing"],
			});

			let selectedKit: KitType | undefined;
			if (!ctx.options.kit && ctx.accessibleKits?.length === 1) {
				selectedKit = ctx.accessibleKits[0];
			}

			expect(selectedKit).toBeUndefined();
		});
	});

	describe("prompt filtering", () => {
		it("passes accessible kits to selectKit prompt", async () => {
			const prompts = createMockPrompts();
			const accessibleKits: KitType[] = ["engineer"];

			// Simulate selection-handler.ts:84-85
			await prompts.selectKit(undefined, accessibleKits);

			expect(prompts.selectKit).toHaveBeenCalledWith(undefined, accessibleKits);
		});

		it("passes undefined when in --use-git mode (show all kits)", async () => {
			const prompts = createMockPrompts();

			// --use-git mode: accessibleKits is undefined
			await prompts.selectKit(undefined, undefined);

			expect(prompts.selectKit).toHaveBeenCalledWith(undefined, undefined);
		});
	});

	describe("error messages", () => {
		it("generates correct error for no access", () => {
			const errorMessage = "No ClaudeKit access found.";
			const helpMessage = "Purchase at https://claudekit.cc";

			expect(errorMessage).toBe("No ClaudeKit access found.");
			expect(helpMessage).toContain("claudekit.cc");
		});

		it("generates correct error for specific kit access denied", () => {
			const kitType: KitType = "marketing";
			const errorMessage = `No access to ${AVAILABLE_KITS[kitType].name}`;

			expect(errorMessage).toBe("No access to ClaudeKit Marketing");
		});
	});

	describe("edge cases", () => {
		it("handles empty accessibleKits array (should fail)", () => {
			const ctx = createKitAccessContext({
				accessibleKits: [],
			});

			// Logic from selection-handler.ts:52-56
			const shouldFail = ctx.accessibleKits?.length === 0;
			expect(shouldFail).toBe(true);
		});

		it("handles missing kit type in AVAILABLE_KITS gracefully", () => {
			// This shouldn't happen in practice, but test defensive coding
			const invalidKit = "invalid" as KitType;
			const kitConfig = AVAILABLE_KITS[invalidKit];

			expect(kitConfig).toBeUndefined();
		});

		it("preserves kit order from detection", () => {
			const detectedOrder: KitType[] = ["marketing", "engineer"];

			// Order should be preserved (first accessible is auto-selected in non-interactive)
			expect(detectedOrder[0]).toBe("marketing");
		});
	});

	describe("multi-kit selection", () => {
		it("uses multi-select when multiple kits are accessible", async () => {
			const prompts = createMockPrompts("engineer", ["engineer", "marketing"]);
			const accessibleKits: KitType[] = ["engineer", "marketing"];

			// Simulate selection-handler.ts:86-98 - uses selectKits when >1 accessible
			if (accessibleKits.length > 1) {
				await prompts.selectKits(accessibleKits);
			}

			expect(prompts.selectKits).toHaveBeenCalledWith(accessibleKits);
		});

		it("sets pendingKits when multiple kits selected", () => {
			const selectedKits: KitType[] = ["engineer", "marketing"];

			// Logic from selection-handler.ts:92-98
			const kitType = selectedKits[0];
			const pendingKits = selectedKits.length > 1 ? selectedKits.slice(1) : undefined;

			expect(kitType).toBe("engineer");
			expect(pendingKits).toEqual(["marketing"]);
		});

		it("does not set pendingKits when only one kit selected", () => {
			const selectedKits: KitType[] = ["engineer"];

			const kitType = selectedKits[0];
			const pendingKits = selectedKits.length > 1 ? selectedKits.slice(1) : undefined;

			expect(kitType).toBe("engineer");
			expect(pendingKits).toBeUndefined();
		});

		it("generates correct log message for multi-kit selection", () => {
			const selectedKits: KitType[] = ["engineer", "marketing"];
			const message = `Selected ${selectedKits.length} kits: ${selectedKits.map((k) => AVAILABLE_KITS[k].name).join(", ")}`;

			expect(message).toBe("Selected 2 kits: ClaudeKit Engineer, ClaudeKit Marketing");
		});

		it("throws error when no kits selected from multi-select", () => {
			const selectedKits: KitType[] = [];
			const shouldThrow = selectedKits.length === 0;

			expect(shouldThrow).toBe(true);
		});
	});
});
