import { describe, expect, test } from "bun:test";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

const ICONS_DIR = join(import.meta.dir, "..", "src-tauri", "icons");
const REQUIRED = [
	"32x32.png",
	"128x128.png",
	"128x128@2x.png",
	"icon.icns",
	"icon.ico",
	"icon.png",
	"256x256.png",
	"512x512.png",
] as const;

describe("desktop icon bundle integrity", () => {
	for (const name of REQUIRED) {
		test(`${name} exists and is non-empty`, () => {
			const path = join(ICONS_DIR, name);
			expect(existsSync(path)).toBe(true);
			expect(statSync(path).size).toBeGreaterThan(0);
		});
	}
});
