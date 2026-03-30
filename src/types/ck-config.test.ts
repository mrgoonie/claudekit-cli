import { describe, expect, test } from "bun:test";
import { CkConfigSchema, normalizeCkConfigInput } from "./ck-config.js";

describe("normalizeCkConfigInput", () => {
	test("returns a deep clone of the input object", () => {
		const input = { updatePipeline: { autoInitAfterUpdate: true } };
		const result = normalizeCkConfigInput(input);
		expect(result).toEqual(input);
		expect(result).not.toBe(input);
	});

	test("passes through non-object values unchanged", () => {
		expect(normalizeCkConfigInput(null)).toBeNull();
		expect(normalizeCkConfigInput("string")).toBe("string");
		expect(normalizeCkConfigInput(42)).toBe(42);
		expect(normalizeCkConfigInput([1, 2])).toEqual([1, 2]);
	});

	test("preserves updatePipeline with autoInitAfterUpdate", () => {
		const normalized = normalizeCkConfigInput({
			updatePipeline: { autoInitAfterUpdate: true },
		}) as { updatePipeline: { autoInitAfterUpdate: boolean } };

		expect(normalized.updatePipeline.autoInitAfterUpdate).toBe(true);
		expect(CkConfigSchema.parse(normalized).updatePipeline?.autoInitAfterUpdate).toBe(true);
	});
});
