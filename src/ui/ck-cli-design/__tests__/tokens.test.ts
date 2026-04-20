import { describe, expect, it } from "bun:test";
import { homedir } from "node:os";
import {
	createCliDesignContext,
	formatCdHint,
	formatDisplayPath,
	truncateMiddle,
} from "../tokens.js";

describe("ck-cli-design tokens", () => {
	it("forces ASCII when CK_FORCE_ASCII is enabled", () => {
		const context = createCliDesignContext({
			columns: 72,
			env: { ...process.env, CK_FORCE_ASCII: "1" },
			isTTY: true,
			platform: "win32",
		});

		expect(context.box.h).toBe("-");
		expect(context.box.v).toBe("|");
	});

	it("drops boxed panels on narrow terminals", () => {
		const context = createCliDesignContext({
			columns: 48,
			env: process.env,
			isTTY: true,
			platform: "darwin",
		});

		expect(context.supportsPanels).toBe(false);
		expect(context.width).toBe(48);
	});

	it("formats home-relative paths with a tilde prefix", () => {
		expect(formatDisplayPath(`${homedir()}/.agents/skills`)).toBe("~/.agents/skills");
	});

	it("truncates long paths through the middle", () => {
		expect(truncateMiddle("~/.very/long/path/to/skills/example", 20)).toBe("~/.very/l.../example");
	});

	it("keeps Windows cd hints readable without doubled separators", () => {
		expect(formatCdHint("C:\\Users\\kai\\.agents\\skills", "win32")).toBe(
			'cd /d "C:\\Users\\kai\\.agents\\skills"',
		);
	});

	it("returns unicode context for WT_SESSION regardless of TTY", () => {
		const context = createCliDesignContext({
			columns: 72,
			env: { WT_SESSION: "1" },
			isTTY: false,
			platform: "win32",
		});
		expect(context.box.bullet).toBe("●");
	});

	it("returns ASCII context when TERM=dumb even if WT_SESSION is set", () => {
		const context = createCliDesignContext({
			columns: 72,
			env: { WT_SESSION: "1", TERM: "dumb" },
			isTTY: false,
			platform: "win32",
		});
		expect(context.box.bullet).toBe("+");
	});
});
