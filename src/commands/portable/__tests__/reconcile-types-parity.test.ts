/**
 * Parity test: server-side ReconcileReason (src/commands/portable/reconcile-types.ts)
 * must share the exact same code strings as the UI mirror
 * (src/ui/src/types/reconcile-types.ts).
 *
 * If a new reason code is added to the server type but the UI mirror is
 * forgotten, the UI falls through on unknown codes silently. This test
 * enumerates both type aliases at runtime via a canonical literal array and
 * fails loudly on drift.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Extract the set of literal strings between `export type ReconcileReason =`
 * and the first `;` terminator, stripping comments and whitespace. This keeps
 * the test zero-dep on bundling UI code from server tests (src/ui uses a
 * different TS config + module graph).
 */
function extractReasonCodes(filePath: string): Set<string> {
	const src = readFileSync(filePath, "utf-8");
	const match = src.match(/export type ReconcileReason\s*=([^;]+);/);
	if (!match) {
		throw new Error(`Could not locate ReconcileReason type in ${filePath}`);
	}
	const body = match[1]
		// Strip line comments
		.replace(/\/\/[^\n]*/g, "")
		// Strip block comments
		.replace(/\/\*[\s\S]*?\*\//g, "");
	const codes = new Set<string>();
	for (const m of body.matchAll(/"([a-z0-9-]+)"/g)) {
		codes.add(m[1]);
	}
	return codes;
}

describe("ReconcileReason parity — server vs UI mirror", () => {
	const repoRoot = join(__dirname, "../../../..");
	const serverTypes = join(repoRoot, "src/commands/portable/reconcile-types.ts");
	const uiTypes = join(repoRoot, "src/ui/src/types/reconcile-types.ts");

	it("server and UI declare identical set of reason codes", () => {
		const serverCodes = extractReasonCodes(serverTypes);
		const uiCodes = extractReasonCodes(uiTypes);

		const missingInUi = [...serverCodes].filter((c) => !uiCodes.has(c)).sort();
		const missingInServer = [...uiCodes].filter((c) => !serverCodes.has(c)).sort();

		expect(missingInUi).toEqual([]);
		expect(missingInServer).toEqual([]);
		expect(serverCodes.size).toBeGreaterThan(0);
	});
});
