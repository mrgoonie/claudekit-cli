import BetterSqlite3 from "better-sqlite3";
import type { Database as BetterSqliteDatabase } from "better-sqlite3";

export type Database = BetterSqliteDatabase;

export function openDatabase(dbPath: string): Database {
	return new BetterSqlite3(dbPath);
}
