import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useConfigEditor } from "./use-config-editor";

const describeInDom = typeof document === "undefined" ? describe.skip : describe;

const schema = {
	type: "object",
	properties: {
		updatePipeline: {
			type: "object",
			properties: {
				migrateProviders: {
					oneOf: [{ const: "auto" }, { type: "array", items: { type: "string" } }],
					default: "auto",
					description: "Choose providers to auto-migrate after init.",
				},
			},
		},
	},
};

describeInDom("useConfigEditor", () => {
	test("keeps the help panel synced with the last edited form field", async () => {
		const { result } = renderHook(() =>
			useConfigEditor({
				scope: "global",
				fetchConfig: vi.fn().mockResolvedValue({
					config: { updatePipeline: { migrateProviders: "auto" } },
					sources: {},
				}),
				fetchSchema: vi.fn().mockResolvedValue(schema),
				saveConfig: vi.fn().mockResolvedValue(undefined),
			}),
		);

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => {
			result.current.handleFormChange("updatePipeline.migrateProviders", ["codex"]);
		});

		expect(result.current.activeFieldPath).toBe("updatePipeline.migrateProviders");
		expect(result.current.fieldDoc?.path).toBe("updatePipeline.migrateProviders");
		expect(result.current.fieldDoc?.description).toContain("Choose which providers");
	});

	test("clears explicit form focus when the JSON editor becomes active", async () => {
		const { result } = renderHook(() =>
			useConfigEditor({
				scope: "global",
				fetchConfig: vi.fn().mockResolvedValue({
					config: { updatePipeline: { migrateProviders: "auto" } },
					sources: {},
				}),
				fetchSchema: vi.fn().mockResolvedValue(schema),
				saveConfig: vi.fn().mockResolvedValue(undefined),
			}),
		);

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => {
			result.current.handleFormChange("updatePipeline.migrateProviders", ["codex"]);
		});

		expect(result.current.activeFieldPath).toBe("updatePipeline.migrateProviders");

		act(() => {
			result.current.handleJsonEditorFocus();
		});

		expect(result.current.activeFieldPath).not.toBe("updatePipeline.migrateProviders");
		expect(result.current.fieldDoc?.path).not.toBe("updatePipeline.migrateProviders");
	});

	test("keeps form help active when JSON cursor state changes without JSON focus", async () => {
		const { result } = renderHook(() =>
			useConfigEditor({
				scope: "global",
				fetchConfig: vi.fn().mockResolvedValue({
					config: { updatePipeline: { migrateProviders: "auto" } },
					sources: {},
				}),
				fetchSchema: vi.fn().mockResolvedValue(schema),
				saveConfig: vi.fn().mockResolvedValue(undefined),
			}),
		);

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => {
			result.current.handleFormChange("updatePipeline.migrateProviders", ["codex"]);
		});

		act(() => {
			result.current.setCursorLine(0);
		});

		expect(result.current.activeFieldPath).toBe("updatePipeline.migrateProviders");
		expect(result.current.fieldDoc?.path).toBe("updatePipeline.migrateProviders");
	});
});
