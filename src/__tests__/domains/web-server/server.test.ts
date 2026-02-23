import { describe, expect, test } from "bun:test";
import { createAppServer, resolveUiRootPath } from "@/domains/web-server/server.js";

describe("web-server lifecycle", () => {
	test("resolveUiRootPath returns decoded filesystem path", () => {
		const uiRoot = resolveUiRootPath();
		expect(uiRoot.includes("%20")).toBe(false);
		expect(/src[\\/]+ui$/.test(uiRoot)).toBe(true);
	});

	test("close is safe when called more than once", async () => {
		const app = await createAppServer({ openBrowser: false, devMode: false });
		expect(app.server.listening).toBe(true);

		await app.close();
		await app.close();

		expect(app.server.listening).toBe(false);
	});
});
