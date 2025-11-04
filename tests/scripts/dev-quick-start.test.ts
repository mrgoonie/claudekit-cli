import { describe, test, expect } from "bun:test";
import { execSync } from "node:child_process";

describe("dev-quick-start.sh", () => {
	test("should show help message", () => {
		const result = execSync("./scripts/dev-quick-start.sh help", {
			encoding: "utf-8",
		});

		expect(result).toContain("Usage:");
		expect(result).toContain("Commands:");
		expect(result).toContain("lint");
		expect(result).toContain("test");
		expect(result).toContain("commit");
	});

	test("should reject dangerous commit messages", () => {
		try {
			execSync("./scripts/dev-quick-start.sh commit 'fix: message; rm -rf /'", {
				encoding: "utf-8",
			});
			expect(true).toBe(false); // Should not reach here
		} catch (error) {
			const output = error.stderr?.toString() || error.stdout?.toString();
			expect(output).toContain("Invalid commit message");
		}
	});

	test("should reject dangerous test patterns", () => {
		try {
			execSync("./scripts/dev-quick-start.sh test 'utils; rm -rf /'", {
				encoding: "utf-8",
			});
			expect(true).toBe(false); // Should not reach here
		} catch (error) {
			const output = error.stderr?.toString() || error.stdout?.toString();
			expect(output).toContain("Invalid test pattern");
		}
	});
});