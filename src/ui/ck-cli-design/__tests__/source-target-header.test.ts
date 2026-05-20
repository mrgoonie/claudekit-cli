import { describe, expect, it } from "bun:test";
import { renderSourceTargetHeader } from "../source-target-header.js";
import { createCliDesignContext } from "../tokens.js";

describe("renderSourceTargetHeader", () => {
	it("renders source and destination zones in the same panel", () => {
		const output = renderSourceTargetHeader({
			context: createCliDesignContext({ columns: 72, env: process.env, isTTY: true }),
			sourceLines: ["14 agents · 82 skills", "from ~/.claude/agents · ~/.claude/skills"],
			subtitle: "Codex -> project",
			targetLines: [".codex/agents", ".agents/skills"],
			title: "ck migrate",
		}).join("\n");

		expect(output).toContain("SOURCE");
		expect(output).toContain("DESTINATION");
		expect(output).toContain(".agents/skills");
	});
});
