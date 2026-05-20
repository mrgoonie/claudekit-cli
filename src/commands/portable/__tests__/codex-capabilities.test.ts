import { describe, expect, it } from "bun:test";
import {
	CODEX_CAPABILITY_TABLE,
	CODEX_SUPPORTED_EVENTS,
	detectCodexCapabilities,
} from "../codex-capabilities.js";

describe("codex-capabilities", () => {
	/**
	 * H3 — Capability table is the single source of truth for supported/unsupported events.
	 * Events absent from the table (or with supported=false) are dropped by the converter.
	 */
	describe("capability table — unsupported events (H3)", () => {
		it("SubagentStart is NOT in the capability table (unsupported)", () => {
			const baseline = CODEX_CAPABILITY_TABLE[CODEX_CAPABILITY_TABLE.length - 1];
			expect(baseline.events.SubagentStart).toBeUndefined();
		});
		it("SubagentStop is NOT in the capability table (unsupported)", () => {
			const baseline = CODEX_CAPABILITY_TABLE[CODEX_CAPABILITY_TABLE.length - 1];
			expect(baseline.events.SubagentStop).toBeUndefined();
		});
		it("Notification is NOT in the capability table (unsupported)", () => {
			const baseline = CODEX_CAPABILITY_TABLE[CODEX_CAPABILITY_TABLE.length - 1];
			expect(baseline.events.Notification).toBeUndefined();
		});
		it("PreCompact is NOT in the capability table (unsupported)", () => {
			const baseline = CODEX_CAPABILITY_TABLE[CODEX_CAPABILITY_TABLE.length - 1];
			expect(baseline.events.PreCompact).toBeUndefined();
		});
		it("SessionStart IS in the capability table as supported", () => {
			const baseline = CODEX_CAPABILITY_TABLE[CODEX_CAPABILITY_TABLE.length - 1];
			expect(baseline.events.SessionStart?.supported).toBe(true);
		});
		it("PreToolUse IS in the capability table as supported", () => {
			const baseline = CODEX_CAPABILITY_TABLE[CODEX_CAPABILITY_TABLE.length - 1];
			expect(baseline.events.PreToolUse?.supported).toBe(true);
		});
	});

	describe("CODEX_SUPPORTED_EVENTS", () => {
		it("includes SessionStart", () => {
			expect(CODEX_SUPPORTED_EVENTS.has("SessionStart")).toBe(true);
		});
		it("includes PreToolUse", () => {
			expect(CODEX_SUPPORTED_EVENTS.has("PreToolUse")).toBe(true);
		});
		it("includes PostToolUse", () => {
			expect(CODEX_SUPPORTED_EVENTS.has("PostToolUse")).toBe(true);
		});
		it("includes Stop", () => {
			expect(CODEX_SUPPORTED_EVENTS.has("Stop")).toBe(true);
		});
	});

	describe("CODEX_CAPABILITY_TABLE", () => {
		it("has at least one entry", () => {
			expect(CODEX_CAPABILITY_TABLE.length).toBeGreaterThan(0);
		});

		it("L9 — is sorted newest-first (ordering invariant enforced at module load)", () => {
			// This verifies the module-load assertion in codex-capabilities.ts did not throw.
			// If the table were out of order, importing the module would have thrown already.
			// We do an explicit check here as a belt-and-suspenders regression guard.
			for (let i = 0; i < CODEX_CAPABILITY_TABLE.length - 1; i++) {
				const a = CODEX_CAPABILITY_TABLE[i].version;
				const b = CODEX_CAPABILITY_TABLE[i + 1].version;
				// Newer entry (i) must have version >= older entry (i+1)
				// Use simple string parse: both are semver-coercible
				const coerceVersion = (v: string) => {
					const m = v.match(/(\d+)\.(\d+)\.(\d+)/);
					if (!m) return [0, 0, 0];
					return [Number(m[1]), Number(m[2]), Number(m[3])];
				};
				const [aMaj, aMin, aPatch] = coerceVersion(a);
				const [bMaj, bMin, bPatch] = coerceVersion(b);
				const aNum = aMaj * 1e6 + aMin * 1e3 + aPatch;
				const bNum = bMaj * 1e6 + bMin * 1e3 + bPatch;
				expect(aNum).toBeGreaterThanOrEqual(bNum);
			}
		});

		it("v0.124.0-alpha.3 entry has correct structure", () => {
			const entry = CODEX_CAPABILITY_TABLE.find((e) => e.version === "0.124.0-alpha.3");
			expect(entry).toBeDefined();
			if (!entry) return;

			// PreToolUse must NOT support additionalContext
			expect(entry.events.PreToolUse.supportsAdditionalContext).toBe(false);

			// SessionStart must NOT support additionalContext
			// (spec says PostToolUse yes, but SessionStart is for input not output)
			// SessionStart DOES support additionalContext per spec
			expect(entry.events.SessionStart.supportsAdditionalContext).toBe(true);

			// PreToolUse only accepts "deny" for permissionDecision
			expect(entry.events.PreToolUse.permissionDecisionValues).toEqual(["deny"]);

			// SessionStart only allows startup|resume matchers
			expect(entry.sessionStartMatchersOnly).toContain("startup");
			expect(entry.sessionStartMatchersOnly).toContain("resume");
			expect(entry.sessionStartMatchersOnly).not.toContain("clear");
			expect(entry.sessionStartMatchersOnly).not.toContain("compact");

			// Feature flag required
			expect(entry.requiresFeatureFlag).toBe(true);
		});
	});

	describe("detectCodexCapabilities", () => {
		it("returns a capabilities object (even if codex binary absent)", async () => {
			const caps = await detectCodexCapabilities();
			expect(caps).toBeDefined();
			expect(caps.version).toBeTypeOf("string");
			expect(caps.events).toBeDefined();
			expect(Object.keys(caps.events).length).toBeGreaterThan(0);
		});

		it("returns strict (oldest) capabilities when CK_CODEX_COMPAT=strict", async () => {
			const prev = process.env.CK_CODEX_COMPAT;
			process.env.CK_CODEX_COMPAT = "strict";
			try {
				const caps = await detectCodexCapabilities();
				// Strict mode returns the last entry (most conservative)
				expect(caps.version).toBe(
					CODEX_CAPABILITY_TABLE[CODEX_CAPABILITY_TABLE.length - 1].version,
				);
			} finally {
				if (prev === undefined) {
					process.env.CK_CODEX_COMPAT = undefined;
				} else {
					process.env.CK_CODEX_COMPAT = prev;
				}
			}
		});
	});
});
