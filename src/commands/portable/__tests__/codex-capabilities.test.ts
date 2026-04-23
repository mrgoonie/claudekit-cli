import { describe, expect, it } from "bun:test";
import {
	CODEX_CAPABILITY_TABLE,
	CODEX_SUPPORTED_EVENTS,
	UNSUPPORTED_CLAUDE_EVENTS,
	detectCodexCapabilities,
} from "../codex-capabilities.js";

describe("codex-capabilities", () => {
	describe("UNSUPPORTED_CLAUDE_EVENTS", () => {
		it("includes SubagentStart", () => {
			expect(UNSUPPORTED_CLAUDE_EVENTS.has("SubagentStart")).toBe(true);
		});
		it("includes SubagentStop", () => {
			expect(UNSUPPORTED_CLAUDE_EVENTS.has("SubagentStop")).toBe(true);
		});
		it("includes Notification", () => {
			expect(UNSUPPORTED_CLAUDE_EVENTS.has("Notification")).toBe(true);
		});
		it("includes PreCompact", () => {
			expect(UNSUPPORTED_CLAUDE_EVENTS.has("PreCompact")).toBe(true);
		});
		it("does NOT include SessionStart", () => {
			expect(UNSUPPORTED_CLAUDE_EVENTS.has("SessionStart")).toBe(false);
		});
		it("does NOT include PreToolUse", () => {
			expect(UNSUPPORTED_CLAUDE_EVENTS.has("PreToolUse")).toBe(false);
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
