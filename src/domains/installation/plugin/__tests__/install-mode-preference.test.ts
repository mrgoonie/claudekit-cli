import { describe, expect, test } from "bun:test";
import {
	DEFAULT_INSTALL_MODE_PREFERENCE,
	readInstallModePreferenceFromMetadata,
	resolveEffectiveInstallModePreference,
	resolveInstallModePreferenceForUpdate,
} from "@/domains/installation/plugin/install-mode-preference.js";
import type { Metadata } from "@/types";

function metadataWith(preference?: unknown): Metadata {
	return {
		kits: {
			engineer: {
				version: "1.0.0",
				installedAt: "2026-07-11T00:00:00.000Z",
				...(preference === undefined ? {} : { installModePreference: preference }),
			},
		},
	} as Metadata;
}

describe("Engineer install mode preference", () => {
	test("normal copied skills are the default", () => {
		expect(DEFAULT_INSTALL_MODE_PREFERENCE).toBe("legacy");
		expect(resolveInstallModePreferenceForUpdate(null, "engineer")).toBe("legacy");
		expect(resolveInstallModePreferenceForUpdate(metadataWith(), "engineer")).toBe("legacy");
	});

	test.each([
		["auto", "legacy"],
		["legacy", "legacy"],
		["plugin", "plugin"],
		["unexpected", "legacy"],
		[42, "legacy"],
	] as const)("canonicalizes stored preference %p to %s for update", (stored, effective) => {
		expect(resolveInstallModePreferenceForUpdate(metadataWith(stored), "engineer")).toBe(effective);
	});

	test.each([
		[undefined, "legacy"],
		[null, "legacy"],
		["auto", "legacy"],
		["legacy", "legacy"],
		["plugin", "plugin"],
	] as const)("resolves effective preference %p to %s", (input, expected) => {
		expect(resolveEffectiveInstallModePreference(input)).toBe(expected);
	});

	test("only a literal plugin preference is durable consent", () => {
		expect(readInstallModePreferenceFromMetadata(metadataWith("plugin"), "engineer")).toBe(
			"plugin",
		);
		expect(readInstallModePreferenceFromMetadata(metadataWith("auto"), "engineer")).toBe("auto");
		expect(
			readInstallModePreferenceFromMetadata(metadataWith("unexpected"), "engineer"),
		).toBeNull();
	});

	test("non-Engineer kits do not own an install mode", () => {
		expect(
			resolveInstallModePreferenceForUpdate(metadataWith("plugin"), "marketing"),
		).toBeUndefined();
	});
});
