/**
 * Tests for checksum utilities (Phase 1)
 */
import { describe, expect, test } from "bun:test";
import { computeContentChecksum, computeSectionChecksums } from "../checksum-utils.js";

describe("computeContentChecksum", () => {
	test("computes SHA-256 hex for string content", () => {
		const content = "Hello, ClaudeKit!";
		const checksum = computeContentChecksum(content);

		// SHA-256 produces 64-character hex string
		expect(checksum).toMatch(/^[a-f0-9]{64}$/);
		expect(checksum.length).toBe(64);
	});

	test("produces consistent checksums for same content", () => {
		const content = "Consistent content";
		const checksum1 = computeContentChecksum(content);
		const checksum2 = computeContentChecksum(content);

		expect(checksum1).toBe(checksum2);
	});

	test("produces different checksums for different content", () => {
		const content1 = "Content A";
		const content2 = "Content B";

		const checksum1 = computeContentChecksum(content1);
		const checksum2 = computeContentChecksum(content2);

		expect(checksum1).not.toBe(checksum2);
	});

	test("handles empty string", () => {
		const checksum = computeContentChecksum("");
		expect(checksum).toMatch(/^[a-f0-9]{64}$/);
	});

	test("handles multiline content", () => {
		const content = `Line 1
Line 2
Line 3`;
		const checksum = computeContentChecksum(content);
		expect(checksum).toMatch(/^[a-f0-9]{64}$/);
	});

	test("handles UTF-8 content", () => {
		const content = "Hello 世界 🌍";
		const checksum = computeContentChecksum(content);
		expect(checksum).toMatch(/^[a-f0-9]{64}$/);
	});
});

describe("computeSectionChecksums", () => {
	test("computes checksums for multiple sections", () => {
		const sections = [
			{ name: "section1", content: "Content 1" },
			{ name: "section2", content: "Content 2" },
		];

		const checksums = computeSectionChecksums(sections);

		expect(Object.keys(checksums)).toHaveLength(2);
		expect(checksums.section1).toMatch(/^[a-f0-9]{64}$/);
		expect(checksums.section2).toMatch(/^[a-f0-9]{64}$/);
		expect(checksums.section1).not.toBe(checksums.section2);
	});

	test("handles empty sections array", () => {
		const checksums = computeSectionChecksums([]);
		expect(checksums).toEqual({});
	});

	test("handles single section", () => {
		const sections = [{ name: "only-section", content: "Only content" }];
		const checksums = computeSectionChecksums(sections);

		expect(Object.keys(checksums)).toHaveLength(1);
		expect(checksums["only-section"]).toMatch(/^[a-f0-9]{64}$/);
	});

	test("produces consistent checksums per section", () => {
		const sections = [
			{ name: "agent-1", content: "Agent 1 content" },
			{ name: "agent-2", content: "Agent 2 content" },
		];

		const checksums1 = computeSectionChecksums(sections);
		const checksums2 = computeSectionChecksums(sections);

		expect(checksums1).toEqual(checksums2);
	});
});
