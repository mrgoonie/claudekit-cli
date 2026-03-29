import { computeContentChecksum } from "./checksum-utils.js";
import type { PortableItem } from "./types.js";

export type MergeSectionKind = "agent" | "rule" | "config";
export type ParsedSectionKind = MergeSectionKind | "unknown";

const SECTION_HEADING_PATTERNS: Record<MergeSectionKind, RegExp> = {
	agent: /^##\s*agent\s*:\s*(.+?)\s*$/im,
	rule: /^##\s*rule\s*:\s*(.+?)\s*$/im,
	config: /^##\s*config\s*$/im,
};

export interface ParsedSection {
	kind: ParsedSectionKind;
	key: string;
	content: string;
}

interface ParsedMergedSections {
	sections: ParsedSection[];
	preamble: string;
	warnings: string[];
}

function splitManagedContent(content: string): { preambleEnd: number; parts: string[] } {
	const lines = content.split(/\r?\n/);
	let inFence = false;
	let firstManagedIndex = -1;
	const separatorIndices: number[] = [];
	let currentLineIndex = 0;

	for (const line of lines) {
		const trimmedLine = line.trim();

		if (trimmedLine.startsWith("```") || trimmedLine.startsWith("~~~")) {
			inFence = !inFence;
		}

		if (!inFence) {
			const isManagedHeading = Object.values(SECTION_HEADING_PATTERNS).some((regex) =>
				regex.test(trimmedLine),
			);
			if (isManagedHeading && firstManagedIndex === -1) {
				firstManagedIndex = currentLineIndex;
			}

			if (/^[ \t]*---[ \t]*$/.test(trimmedLine)) {
				separatorIndices.push(currentLineIndex);
			}
		}

		currentLineIndex += line.length + 1;
	}

	if (firstManagedIndex === -1) {
		return { preambleEnd: content.length, parts: [] };
	}

	const managedContent = content.slice(firstManagedIndex);
	const managedStart = firstManagedIndex;
	const parts: string[] = [];
	let lastSplitPos = 0;

	for (const separatorIndex of separatorIndices) {
		if (separatorIndex < managedStart) continue;
		const relativeIndex = separatorIndex - managedStart;
		if (relativeIndex > lastSplitPos) {
			const part = managedContent.slice(lastSplitPos, relativeIndex).trim();
			if (part) parts.push(part);
		}

		const separatorLineEnd = managedContent.indexOf("\n", relativeIndex);
		lastSplitPos = separatorLineEnd >= 0 ? separatorLineEnd + 1 : managedContent.length;
	}

	const finalPart = managedContent.slice(lastSplitPos).trim();
	if (finalPart) parts.push(finalPart);

	return { preambleEnd: firstManagedIndex, parts };
}

function parseSectionMetadata(content: string): { kind: MergeSectionKind; key: string } | null {
	const agentMatch = content.match(SECTION_HEADING_PATTERNS.agent);
	if (agentMatch) {
		return { kind: "agent", key: agentMatch[1].trim() };
	}

	const ruleMatch = content.match(SECTION_HEADING_PATTERNS.rule);
	if (ruleMatch) {
		return { kind: "rule", key: ruleMatch[1].trim() };
	}

	if (SECTION_HEADING_PATTERNS.config.test(content)) {
		return { kind: "config", key: "config" };
	}

	return null;
}

export function parseMergedSections(content: string): ParsedMergedSections {
	const sections: ParsedSection[] = [];
	const warnings: string[] = [];
	const { preambleEnd, parts } = splitManagedContent(content);

	if (parts.length === 0) {
		return {
			sections,
			preamble: content.trim(),
			warnings,
		};
	}

	let unknownIndex = 0;
	const seenKeys = new Map<string, number>();

	for (const part of parts) {
		const trimmed = part.trim();
		if (!trimmed) continue;

		const metadata = parseSectionMetadata(trimmed);
		if (metadata) {
			const compositeKey = `${metadata.kind}:${metadata.key}`;
			const existingIndex = seenKeys.get(compositeKey);

			if (existingIndex !== undefined) {
				warnings.push(
					`Duplicate ${metadata.kind} section "${metadata.key}" in existing file; keeping last occurrence`,
				);
				sections.splice(existingIndex, 1);
				for (const [key, index] of seenKeys) {
					if (index > existingIndex) {
						seenKeys.set(key, index - 1);
					}
				}
			}

			const nextIndex = sections.length;
			sections.push({
				kind: metadata.kind,
				key: metadata.key,
				content: trimmed,
			});
			seenKeys.set(compositeKey, nextIndex);
			continue;
		}

		unknownIndex += 1;
		sections.push({
			kind: "unknown",
			key: `unknown-${unknownIndex}`,
			content: trimmed,
		});
	}

	let preamble = content.slice(0, preambleEnd).trimEnd();
	preamble = preamble
		.replace(
			/^# Agents\r?\n\r?\n> Ported from Claude Code agents via ClaudeKit CLI \(ck agents\)\r?\n> Target: .*\r?\n+/is,
			"",
		)
		.replace(
			/^# Rules\r?\n\r?\n> Ported from Claude Code rules via ClaudeKit CLI \(ck migrate --rules\)\r?\n> Target: .*\r?\n+/is,
			"",
		)
		.replace(/^# Config\r?\n\r?\n> Ported from Claude Code config via ClaudeKit CLI.*\r?\n+/is, "")
		.trimEnd();

	return {
		sections,
		preamble: preamble.trim(),
		warnings,
	};
}

export function getMergeSectionKey(kind: MergeSectionKind, item: PortableItem): string {
	if (kind === "config") return "config";
	if (kind === "agent") return item.frontmatter.name || item.name;
	return item.name;
}

export function buildMergeSectionContent(
	kind: MergeSectionKind,
	sectionKey: string,
	convertedContent: string,
): string {
	if (kind === "config") {
		return `## Config\n\n${convertedContent.trim()}\n`;
	}
	if (kind === "rule") {
		return `## Rule: ${sectionKey}\n\n${convertedContent.trim()}\n`;
	}
	return convertedContent.trimEnd();
}

export function getManagedSectionChecksumKey(kind: MergeSectionKind, key: string): string {
	return `${kind}:${key}`;
}

export function computeManagedSectionChecksums(content: string): Record<string, string> {
	const checksums: Record<string, string> = {};
	for (const section of parseMergedSections(content).sections) {
		if (section.kind === "unknown") continue;
		const normalizedContent =
			section.kind === "agent" ? section.content.trimEnd() : `${section.content.trimEnd()}\n`;
		checksums[getManagedSectionChecksumKey(section.kind, section.key)] =
			computeContentChecksum(normalizedContent);
	}
	return checksums;
}
