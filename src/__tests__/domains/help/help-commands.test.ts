import { describe, expect, test } from "bun:test";
import { getCommandHelp, hasCommand } from "@/domains/help/help-commands.js";

describe("help-commands", () => {
	test("registers help for the app command", () => {
		expect(hasCommand("app")).toBe(true);
		expect(getCommandHelp("app")).toMatchObject({
			name: "app",
			usage: "ck app [options]",
		});
	});
});
