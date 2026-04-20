import { describe, expect, it } from "bun:test";
import { renderPreflightRow } from "../preflight-row.js";
import { createCliDesignContext } from "../tokens.js";

describe("renderPreflightRow", () => {
	it("renders multiple destinations and inline notes", () => {
		const lines = renderPreflightRow({
			context: createCliDesignContext({ columns: 72, env: process.env, isTTY: true }),
			count: 4,
			destinations: ["~/.codex/prompts", "~/.agents/skills"],
			label: "Commands",
			notes: ["Codex: global-only"],
		});

		expect(lines[0]).toContain("Commands");
		expect(lines[0]).toContain("~/.codex/prompts");
		expect(lines[1]).toContain("~/.agents/skills");
		expect(lines[2]).toContain("Codex: global-only");
	});

	it("falls back gracefully when no destination is available", () => {
		const lines = renderPreflightRow({
			context: createCliDesignContext({ columns: 72, env: process.env, isTTY: true }),
			count: 2,
			destinations: [],
			label: "Commands",
			notes: ["Cline: unsupported"],
		});

		expect(lines[0]).toContain("unsupported for selected provider(s)");
		expect(lines[1]).toContain("Cline: unsupported");
	});
});
