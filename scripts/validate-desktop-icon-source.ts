import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Anchor check: only validates 512x512.png against the logo source. icon.ico,
// icon.icns, and smaller PNGs are derived by the Tauri CLI and aren't hash-
// comparable to a PNG. Run `bun run icons:regen` to rebuild the full bundle.
const LOGO = fileURLToPath(new URL("../src/ui/public/images/logo-512.png", import.meta.url));
const ICON = fileURLToPath(new URL("../src-tauri/icons/512x512.png", import.meta.url));

function md5(path: string): string {
	return createHash("md5").update(readFileSync(path)).digest("hex");
}

try {
	const logoHash = md5(LOGO);
	const iconHash = md5(ICON);
	if (logoHash !== iconHash) {
		console.error(
			`[desktop-icons] drift detected: src-tauri/icons/512x512.png (${iconHash}) != src/ui/public/images/logo-512.png (${logoHash}). Run: bun run icons:regen`,
		);
		process.exitCode = 1;
	} else {
		console.log(`[desktop-icons] 512x512.png matches logo source (${logoHash})`);
	}
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`[desktop-icons] ${message}`);
	process.exitCode = 1;
}
