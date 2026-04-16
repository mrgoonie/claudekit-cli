#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import { buildDesktopReleaseManifest } from "../src/domains/desktop/desktop-release-manifest.js";
import type { GitHubReleaseAsset } from "../src/types";

interface ReleasePayload {
	tag_name: string;
	published_at?: string;
	assets: GitHubReleaseAsset[];
}

function getVersionFromTag(tag: string): string {
	if (!tag.startsWith("desktop-v")) {
		throw new Error(`Expected desktop release tag, received: ${tag}`);
	}
	return tag.slice("desktop-v".length);
}

async function main(): Promise<void> {
	const inputPath = process.argv[2];
	if (!inputPath) {
		throw new Error("Usage: bun scripts/generate-desktop-release-manifest.ts <release-json>");
	}

	const raw = await readFile(inputPath, "utf-8");
	const payload = JSON.parse(raw) as ReleasePayload;
	const manifest = buildDesktopReleaseManifest({
		version: getVersionFromTag(payload.tag_name),
		publishedAt: payload.published_at || new Date().toISOString(),
		assets: payload.assets,
	});

	process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(message);
	process.exit(1);
});
