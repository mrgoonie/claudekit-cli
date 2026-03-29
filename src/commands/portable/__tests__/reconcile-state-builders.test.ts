import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeContentChecksum } from "../checksum-utils.js";
import { convertItem } from "../converters/index.js";
import { buildMergeSectionContent } from "../merge-single-sections.js";
import { providers } from "../provider-registry.js";
import { buildSourceItemState, buildTargetStates } from "../reconcile-state-builders.js";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("reconcile state builders", () => {
	it("buildSourceItemState uses provider-converted checksum for merge-single targets", () => {
		const item = {
			name: "CLAUDE",
			description: "Config",
			type: "config" as const,
			sourcePath: "/src/CLAUDE.md",
			frontmatter: {},
			body: "See CLAUDE.md and use the Read tool before /fix.",
		};

		const state = buildSourceItemState(item, "config", ["codex"]);
		const converted = convertItem(item, providers.codex.config?.format ?? "md-strip", "codex");

		expect(state.sourceChecksum).toBe(computeContentChecksum(item.body));
		expect(state.convertedChecksums.codex).toBe(computeContentChecksum(converted.content));
		expect(state.targetChecksums?.codex).toBe(
			computeContentChecksum(buildMergeSectionContent("config", "config", converted.content)),
		);
		expect(state.convertedChecksums.codex).not.toBe(state.sourceChecksum);
		expect(state.targetChecksums?.codex).not.toBe(state.convertedChecksums.codex);
	});

	it("buildSourceItemState warns when it falls back to raw checksum after conversion failure", () => {
		const warnings: string[] = [];
		const item = {
			name: 42,
			description: "Broken agent",
			type: "agent" as const,
			sourcePath: "/src/broken-agent.md",
			frontmatter: {},
			body: "Agent body",
		} as unknown as Parameters<typeof buildSourceItemState>[0];

		const state = buildSourceItemState(item, "agent", ["codex"], {
			onConversionFallback: (warning) => warnings.push(`${warning.provider}:${warning.format}`),
		});

		expect(state.convertedChecksums.codex).toBe(computeContentChecksum(item.body));
		expect(warnings).toEqual(["codex:fm-to-codex-toml"]);
	});

	it("buildTargetStates indexes managed section checksums for merge-single paths", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "ck-reconcile-state-builders-"));
		tempDirs.push(tempDir);

		const mergedFile = join(tempDir, "AGENTS.md");
		await writeFile(
			mergedFile,
			[
				"## Config",
				"",
				"First line",
				"",
				"---",
				"",
				"## Rule: development-rules",
				"",
				"Follow the rules.",
				"",
			].join("\n"),
			"utf-8",
		);

		const targetStates = await buildTargetStates([
			{
				item: "CLAUDE",
				type: "config",
				provider: "codex",
				global: true,
				path: mergedFile,
				installedAt: new Date().toISOString(),
				sourcePath: "/src/CLAUDE.md",
				sourceChecksum: "source",
				targetChecksum: "target",
				installSource: "kit",
				ownedSections: ["config"],
			},
			{
				item: "development-rules",
				type: "rules",
				provider: "codex",
				global: true,
				path: mergedFile,
				installedAt: new Date().toISOString(),
				sourcePath: "/src/development-rules.md",
				sourceChecksum: "source",
				targetChecksum: "target",
				installSource: "kit",
				ownedSections: ["development-rules"],
			},
		]);

		const state = targetStates.get(mergedFile);
		expect(state?.exists).toBe(true);
		expect(state?.currentChecksum).toBeDefined();
		expect(state?.sectionChecksums).toBeDefined();
		expect(state?.sectionChecksums?.["config:config"]).toBeDefined();
		expect(state?.sectionChecksums?.["rule:development-rules"]).toBeDefined();
	});
});
