import { describe, expect, it } from "bun:test";
import {
	type Database,
	OptionalSqliteDriverError,
	createMissingSqliteDriverError,
	loadBetterSqlite3Driver,
	resolveBetterSqlite3Constructor,
} from "@/commands/content/phases/sqlite-client.js";

describe("sqlite-client optional driver loading", () => {
	it("resolves CommonJS better-sqlite3 constructor exports", () => {
		const DatabaseStub = class {} as unknown as new (dbPath: string) => Database;

		expect(resolveBetterSqlite3Constructor(DatabaseStub)).toBe(DatabaseStub);
	});

	it("resolves default-wrapped better-sqlite3 constructor exports", () => {
		const DatabaseStub = class {} as unknown as new (dbPath: string) => Database;

		expect(resolveBetterSqlite3Constructor({ default: DatabaseStub })).toBe(DatabaseStub);
	});

	it("throws targeted guidance when the optional driver is missing", () => {
		const missingModuleError = new Error("Cannot find module 'better-sqlite3'");

		expect(() =>
			loadBetterSqlite3Driver(() => {
				throw missingModuleError;
			}),
		).toThrow(OptionalSqliteDriverError);

		try {
			loadBetterSqlite3Driver(() => {
				throw missingModuleError;
			});
		} catch (error) {
			expect(error).toBeInstanceOf(OptionalSqliteDriverError);
			const message = error instanceof Error ? error.message : String(error);
			expect(message).toContain("`ck content` requires the optional native package");
			expect(message).toContain("npm install -g claudekit-cli --include=optional");
			expect(message).toContain("Most ClaudeKit CLI commands do not need it");
			expect(message).toContain("Cannot find module 'better-sqlite3'");
		}
	});

	it("formats missing-driver guidance without an Error instance", () => {
		const error = createMissingSqliteDriverError("missing native package");

		expect(error.message).toContain("`ck content` requires the optional native package");
		expect(error.message).not.toContain("Original error:");
	});
});
