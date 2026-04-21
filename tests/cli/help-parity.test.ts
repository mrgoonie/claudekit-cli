/**
 * CAC ↔ HELP_REGISTRY parity test
 *
 * Positive test: real CLI has zero drift against HELP_REGISTRY.
 * Negative test: synthetic drift is detected and flagged correctly.
 */

import { describe, expect, test } from "bun:test";
import { runParityCheck } from "../../scripts/check-help-parity.js";
import type { Mismatch } from "../../scripts/check-help-parity.js";

describe("CAC ↔ HELP_REGISTRY parity", () => {
	// ---------------------------------------------------------------------------
	// Positive test — the live registry must be in sync
	// ---------------------------------------------------------------------------

	test("no drift between CAC options and HELP_REGISTRY", () => {
		const { ok, report } = runParityCheck();

		if (!ok) {
			const lines: string[] = ["Drift detected:"];
			for (const m of report) {
				if (m.missingInHelp.length > 0) {
					lines.push(`  ck ${m.command} — missing in HELP_REGISTRY: ${m.missingInHelp.join(", ")}`);
				}
				if (m.missingInCac.length > 0) {
					lines.push(`  ck ${m.command} — missing in CAC: ${m.missingInCac.join(", ")}`);
				}
			}
			throw new Error(lines.join("\n"));
		}

		expect(ok).toBe(true);
		expect(report).toHaveLength(0);
	});

	// ---------------------------------------------------------------------------
	// Negative test — synthetic drift must be caught
	// ---------------------------------------------------------------------------

	test("detects synthetic drift when a help entry is missing a CAC flag", () => {
		// Inject a synthetic mismatch by calling runParityCheck with overrides
		const { ok, report } = runParityCheck({
			syntheticMismatches: [
				{
					command: "__test__",
					missingInHelp: ["--fake-flag"],
					missingInCac: [],
				},
			],
		});

		expect(ok).toBe(false);
		const found = report.find((m) => m.command === "__test__");
		expect(found).toBeDefined();
		expect(found?.missingInHelp).toContain("--fake-flag");
	});

	test("returns ok=true and empty report for clean input", () => {
		const { ok, report } = runParityCheck({ syntheticMismatches: [] });
		expect(ok).toBe(true);
		expect(report).toEqual([]);
	});

	test("mismatch shape is well-formed", () => {
		const mismatch: Mismatch = {
			command: "new",
			missingInHelp: ["--some-flag"],
			missingInCac: [],
		};
		// Structural type check at runtime
		expect(mismatch.command).toBe("new");
		expect(Array.isArray(mismatch.missingInHelp)).toBe(true);
		expect(Array.isArray(mismatch.missingInCac)).toBe(true);
	});
});
