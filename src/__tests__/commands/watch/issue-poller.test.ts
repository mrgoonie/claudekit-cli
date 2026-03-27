import { describe, expect, test } from "bun:test";
import { checkRateLimit, isBot } from "../../../commands/watch/phases/issue-poller.js";

describe("isBot", () => {
	test("detects [bot] suffix", () => {
		expect(isBot("dependabot[bot]", [])).toBe(true);
		expect(isBot("renovate[bot]", [])).toBe(true);
		expect(isBot("github-actions[bot]", [])).toBe(true);
	});

	test("detects excludeAuthors list", () => {
		expect(isBot("my-ci-bot", ["my-ci-bot"])).toBe(true);
		expect(isBot("release-bot", ["release-bot", "deploy-bot"])).toBe(true);
	});

	test("passes normal users", () => {
		expect(isBot("johndoe", [])).toBe(false);
		expect(isBot("alice", ["bob"])).toBe(false);
	});

	test("bot suffix is case-sensitive", () => {
		expect(isBot("user[BOT]", [])).toBe(false);
		expect(isBot("user[Bot]", [])).toBe(false);
	});
});

describe("checkRateLimit", () => {
	test("allows under limit", () => {
		expect(checkRateLimit(5, 10)).toBe(true);
	});

	test("allows at zero", () => {
		expect(checkRateLimit(0, 10)).toBe(true);
	});

	test("blocks at limit", () => {
		expect(checkRateLimit(10, 10)).toBe(false);
	});

	test("blocks over limit", () => {
		expect(checkRateLimit(15, 10)).toBe(false);
	});
});
