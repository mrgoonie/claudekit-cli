import { describe, expect, it } from "bun:test";
import { renderNextStepsFooter } from "../next-steps-footer.js";
import { createCliDesignContext } from "../tokens.js";

describe("renderNextStepsFooter", () => {
	it("uses a unicode bullet when unicode rendering is available", () => {
		const lines = renderNextStepsFooter({
			commands: ["ck doctor"],
			context: createCliDesignContext({
				columns: 72,
				env: { LANG: "en_US.UTF-8" } as NodeJS.ProcessEnv,
				isTTY: true,
				platform: "darwin",
			}),
		});

		expect(lines[0]).toBe("• ck doctor");
	});

	it("uses an ASCII bullet when the ASCII fallback is forced", () => {
		const lines = renderNextStepsFooter({
			commands: ["ck doctor"],
			context: createCliDesignContext({
				columns: 72,
				env: { ...process.env, CK_FORCE_ASCII: "1" },
				isTTY: true,
				platform: "win32",
			}),
		});

		expect(lines[0]).toBe("- ck doctor");
	});
});
