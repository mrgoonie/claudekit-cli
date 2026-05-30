import { createRequire } from "node:module";
import type { Database as BetterSqliteDatabase } from "better-sqlite3";

export type Database = BetterSqliteDatabase;

type BetterSqlite3Constructor = new (dbPath: string) => Database;
type BetterSqlite3Module =
	| BetterSqlite3Constructor
	| {
			default?: BetterSqlite3Constructor;
	  };

const require = createRequire(import.meta.url);
let cachedBetterSqlite3: BetterSqlite3Constructor | null = null;

export class OptionalSqliteDriverError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "OptionalSqliteDriverError";
	}
}

export function createMissingSqliteDriverError(cause: unknown): OptionalSqliteDriverError {
	const detail =
		cause instanceof Error && cause.message ? `\n\nOriginal error: ${cause.message}` : "";
	return new OptionalSqliteDriverError(
		[
			"`ck content` requires the optional native package `better-sqlite3`, but it is not available in this CLI install.",
			"Most ClaudeKit CLI commands do not need it and should continue to work.",
			"",
			"To use `ck content`, reinstall the CLI with optional dependencies for your active Node.js runtime:",
			"  npm install -g claudekit-cli --include=optional",
			"",
			"If npm attempts a source build on Windows, install Visual Studio Build Tools with the Desktop development with C++ workload.",
		].join("\n") + detail,
		{ cause },
	);
}

export function resolveBetterSqlite3Constructor(
	sqliteModule: BetterSqlite3Module,
): BetterSqlite3Constructor {
	if (typeof sqliteModule === "function") {
		return sqliteModule;
	}

	if (sqliteModule.default && typeof sqliteModule.default === "function") {
		return sqliteModule.default;
	}

	throw new OptionalSqliteDriverError(
		"`better-sqlite3` loaded, but did not expose a database constructor.",
	);
}

export function loadBetterSqlite3Driver(
	loadModule: () => BetterSqlite3Module = () => require("better-sqlite3") as BetterSqlite3Module,
): BetterSqlite3Constructor {
	try {
		return resolveBetterSqlite3Constructor(loadModule());
	} catch (error) {
		if (error instanceof OptionalSqliteDriverError) {
			throw error;
		}
		throw createMissingSqliteDriverError(error);
	}
}

export function openDatabase(dbPath: string): Database {
	const BetterSqlite3 = cachedBetterSqlite3 ?? loadBetterSqlite3Driver();
	cachedBetterSqlite3 = BetterSqlite3;
	return new BetterSqlite3(dbPath);
}
