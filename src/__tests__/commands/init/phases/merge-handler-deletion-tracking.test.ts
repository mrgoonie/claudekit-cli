import { describe, expect, it } from "bun:test";
import { filterDeletedInstalledFiles } from "@/commands/init/phases/merge-handler.js";

describe("filterDeletedInstalledFiles", () => {
	it("removes deleted files before manifest tracking", () => {
		const result = filterDeletedInstalledFiles(
			["commands/old.md", "commands/oldish.md", ".claude/commands/old.md", "skills/cook/SKILL.md"],
			["commands/old.md"],
		);

		expect(result).toEqual(["commands/oldish.md", "skills/cook/SKILL.md"]);
	});

	it("removes children under deleted directories", () => {
		const result = filterDeletedInstalledFiles(
			[
				"commands/old/index.md",
				".claude/commands/old/nested.md",
				"commands/oldish/index.md",
				"commands/current.md",
			],
			["commands\\old"],
		);

		expect(result).toEqual(["commands/oldish/index.md", "commands/current.md"]);
	});
});
