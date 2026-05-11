import { describe, expect, it } from "bun:test";
import {
	buildDiscoverySummaryLines,
	buildPreflightRows,
	buildProviderScopeSubtitle,
	buildSourceSummaryLines,
	buildTargetSummaryLines,
} from "../migrate-ui-summary.js";

describe("migrate UI summary helpers", () => {
	it("shows Codex project command migrations as project-local skills", () => {
		const rows = buildPreflightRows(
			{ agents: 0, commands: 4, config: 0, hooks: 0, rules: 0, skills: 0 },
			["codex"],
			{ requestedGlobal: false },
		);

		expect(rows[0]?.destinations).toEqual([".agents/skills"]);
		expect(rows[0]?.notes).toEqual([]);
	});

	it("surfaces shared project skill roots across compatible providers", () => {
		const rows = buildPreflightRows(
			{ agents: 0, commands: 0, config: 0, hooks: 0, rules: 0, skills: 3 },
			["codex", "gemini-cli"],
			{ requestedGlobal: false },
		);

		expect(rows[0]?.destinations).toEqual([".agents/skills"]);
		expect(rows[0]?.notes.some((note) => note.includes("share .agents/skills"))).toBe(true);
	});

	it("lists every destination instead of hiding extra targets", () => {
		const lines = buildTargetSummaryLines([
			{ count: 1, destinations: ["a", "b"], label: "Agents", notes: [] },
			{ count: 1, destinations: ["c", "d"], label: "Skills", notes: [] },
		]);

		expect(lines).toEqual(["a", "b", "c", "d"]);
	});

	it("builds structured Found summary lines from preflight rows", () => {
		const rows = buildPreflightRows(
			{ agents: 1, commands: 0, config: 1, hooks: 0, rules: 0, skills: 2 },
			["codex"],
			{
				requestedGlobal: true,
				sourceDisplays: {
					agents: "~/.claude/agents",
					config: "~/.claude/CLAUDE.md",
					skills: "~/.claude/skills",
				},
			},
		);

		expect(buildDiscoverySummaryLines(rows)).toEqual([
			"Agents   1 agent <- ~/.claude/agents",
			"Skills   2 skills <- ~/.claude/skills",
			"Config   config <- ~/.claude/CLAUDE.md",
		]);
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

	it("keeps the summary project-scoped for Codex project command migrations", () => {
		expect(
			buildProviderScopeSubtitle(["codex"], false, {
				agents: 0,
				commands: 1,
				config: 1,
				hooks: 0,
				rules: 0,
				skills: 0,
			}),
		).toBe("Codex -> project");
	});
});
