/**
 * Unit tests for version-display helper functions
 */
import { describe, expect, it } from "bun:test";
import type { Metadata } from "@/types";

// Re-implement helpers for testing (these are private in the module)
function formatInstalledKits(metadata: Metadata): string | null {
	if (!metadata.kits || Object.keys(metadata.kits).length === 0) {
		if (metadata.version) {
			const kitName = metadata.name || "ClaudeKit";
			return `${metadata.version} (${kitName})`;
		}
		return null;
	}

	const kitVersions = Object.entries(metadata.kits)
		.filter(([_, meta]) => meta.version && meta.version.trim() !== "")
		.map(([kit, meta]) => `${kit}@${meta.version}`)
		.sort()
		.join(", ");

	return kitVersions.length > 0 ? kitVersions : null;
}

function getInstalledKitTypes(metadata: Metadata): string[] {
	if (!metadata.kits) return [];
	return Object.keys(metadata.kits);
}

describe("version-display helpers", () => {
	describe("formatInstalledKits", () => {
		it("formats multiple kits alphabetically", () => {
			const metadata: Metadata = {
				kits: {
					marketing: { version: "v1.0.0", installedAt: "2024-01-01T00:00:00.000Z" },
					engineer: { version: "v2.2.0", installedAt: "2024-01-01T00:00:00.000Z" },
				},
			};

			const result = formatInstalledKits(metadata);
			expect(result).toBe("engineer@v2.2.0, marketing@v1.0.0");
		});

		it("formats single kit", () => {
			const metadata: Metadata = {
				kits: {
					engineer: { version: "v2.2.0", installedAt: "2024-01-01T00:00:00.000Z" },
				},
			};

			const result = formatInstalledKits(metadata);
			expect(result).toBe("engineer@v2.2.0");
		});

		it("filters out kits with undefined versions", () => {
			const metadata: Metadata = {
				kits: {
					engineer: { version: "v2.2.0", installedAt: "2024-01-01T00:00:00.000Z" },
					marketing: {
						version: undefined as unknown as string,
						installedAt: "2024-01-01T00:00:00.000Z",
					},
				},
			};

			const result = formatInstalledKits(metadata);
			expect(result).toBe("engineer@v2.2.0");
		});

		it("filters out kits with empty string versions", () => {
			const metadata: Metadata = {
				kits: {
					engineer: { version: "v2.2.0", installedAt: "2024-01-01T00:00:00.000Z" },
					marketing: { version: "", installedAt: "2024-01-01T00:00:00.000Z" },
				},
			};

			const result = formatInstalledKits(metadata);
			expect(result).toBe("engineer@v2.2.0");
		});

		it("filters out kits with whitespace-only versions", () => {
			const metadata: Metadata = {
				kits: {
					engineer: { version: "v2.2.0", installedAt: "2024-01-01T00:00:00.000Z" },
					marketing: { version: "   ", installedAt: "2024-01-01T00:00:00.000Z" },
				},
			};

			const result = formatInstalledKits(metadata);
			expect(result).toBe("engineer@v2.2.0");
		});

		it("returns null when all kits have invalid versions", () => {
			const metadata: Metadata = {
				kits: {
					engineer: { version: "", installedAt: "2024-01-01T00:00:00.000Z" },
					marketing: { version: "   ", installedAt: "2024-01-01T00:00:00.000Z" },
				},
			};

			const result = formatInstalledKits(metadata);
			expect(result).toBeNull();
		});

		it("returns null for empty kits object", () => {
			const metadata: Metadata = {
				kits: {},
			};

			const result = formatInstalledKits(metadata);
			expect(result).toBeNull();
		});

		it("returns null for undefined kits", () => {
			const metadata: Metadata = {};

			const result = formatInstalledKits(metadata);
			expect(result).toBeNull();
		});

		it("falls back to legacy format when no kits but has root version", () => {
			const metadata: Metadata = {
				name: "ClaudeKit Engineer",
				version: "v2.0.0",
			};

			const result = formatInstalledKits(metadata);
			expect(result).toBe("v2.0.0 (ClaudeKit Engineer)");
		});

		it("uses default name in legacy fallback when name is undefined", () => {
			const metadata: Metadata = {
				version: "v2.0.0",
			};

			const result = formatInstalledKits(metadata);
			expect(result).toBe("v2.0.0 (ClaudeKit)");
		});

		it("returns null when no kits and no root version", () => {
			const metadata: Metadata = {
				name: "ClaudeKit Engineer",
			};

			const result = formatInstalledKits(metadata);
			expect(result).toBeNull();
		});
	});

	describe("getInstalledKitTypes", () => {
		it("returns kit types from kits object", () => {
			const metadata: Metadata = {
				kits: {
					engineer: { version: "v2.2.0", installedAt: "2024-01-01T00:00:00.000Z" },
					marketing: { version: "v1.0.0", installedAt: "2024-01-01T00:00:00.000Z" },
				},
			};

			const result = getInstalledKitTypes(metadata);
			expect(result).toContain("engineer");
			expect(result).toContain("marketing");
			expect(result.length).toBe(2);
		});

		it("returns empty array when kits is undefined", () => {
			const metadata: Metadata = {};

			const result = getInstalledKitTypes(metadata);
			expect(result).toEqual([]);
		});

		it("returns empty array when kits is empty object", () => {
			const metadata: Metadata = {
				kits: {},
			};

			const result = getInstalledKitTypes(metadata);
			expect(result).toEqual([]);
		});

		it("returns single kit type", () => {
			const metadata: Metadata = {
				kits: {
					engineer: { version: "v2.2.0", installedAt: "2024-01-01T00:00:00.000Z" },
				},
			};

			const result = getInstalledKitTypes(metadata);
			expect(result).toEqual(["engineer"]);
		});
	});
});
