import { describe, expect, it } from "bun:test";
import {
	buildPreflightRows,
	buildProviderScopeSubtitle,
	buildSourceSummaryLines,
	buildTargetSummaryLines,
} from "../migrate-ui-summary.js";

describe("migrate UI summary helpers", () => {
	it("marks codex commands as global-only when project scope was requested", () => {
		const rows = buildPreflightRows(
			{ agents: 0, commands: 4, config: 0, hooks: 0, rules: 0, skills: 0 },
			["codex"],
			{ actualGlobal: true, requestedGlobal: false },
		);

		expect(rows[0]?.destinations).toContain("~/.codex/prompts");
		expect(rows[0]?.notes).toContain("Codex: global-only");
	});

	it("surfaces shared project skill roots across compatible providers", () => {
		const rows = buildPreflightRows(
			{ agents: 0, commands: 0, config: 0, hooks: 0, rules: 0, skills: 3 },
			["codex", "gemini-cli"],
			{ actualGlobal: false, requestedGlobal: false },
		);

		expect(rows[0]?.destinations).toEqual([".agents/skills"]);
		expect(rows[0]?.notes.some((note) => note.includes("share .agents/skills"))).toBe(true);
	});

	it("summarizes destinations when more than three distinct targets exist", () => {
		const lines = buildTargetSummaryLines([
			{ count: 1, destinations: ["a", "b"], label: "Agents", notes: [] },
			{ count: 1, destinations: ["c", "d"], label: "Skills", notes: [] },
		]);

		expect(lines).toEqual(["a", "b", "c", "+1 more destination(s)"]);
	});

	it("builds readable provider and source summary lines", () => {
		expect(buildProviderScopeSubtitle(["codex", "gemini-cli"], true)).toBe(
			"Codex, Gemini CLI -> global",
		);
		expect(
			buildSourceSummaryLines(
				{ agents: 2, commands: 1, config: 1, hooks: 0, rules: 0, skills: 3 },
				["/Users/test/.claude/agents", "/Users/test/.claude/skills"],
			)[0],
		).toContain("2 agents");
	});
});
