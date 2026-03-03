import { describe, expect, it } from "bun:test";
import type { ProviderPathCollision } from "@/commands/portable/provider-registry.js";
import type { PortableInstallResult } from "@/commands/portable/types.js";
import {
	annotateResultsWithCollisions,
	toDiscoveryCounts,
} from "@/domains/web-server/routes/migration-result-utils.js";

function makeResult(
	overrides: Partial<PortableInstallResult> & { provider: PortableInstallResult["provider"] },
): PortableInstallResult {
	return {
		providerDisplayName: overrides.provider,
		success: true,
		path: "/test",
		...overrides,
	};
}

describe("migration-result-utils", () => {
	describe("toDiscoveryCounts", () => {
		it("counts unique items per portable type", () => {
			const results: PortableInstallResult[] = [
				makeResult({ provider: "codex", portableType: "skill", itemName: "scout" }),
				makeResult({ provider: "amp", portableType: "skill", itemName: "scout" }),
				makeResult({ provider: "codex", portableType: "agent", itemName: "planner" }),
			];
			const counts = toDiscoveryCounts(results);
			expect(counts.skills).toBe(1); // deduped by itemName
			expect(counts.agents).toBe(1);
		});

		it("includes providerBreakdown with per-provider counts", () => {
			const results: PortableInstallResult[] = [
				makeResult({ provider: "codex", portableType: "skill", itemName: "scout" }),
				makeResult({ provider: "codex", portableType: "skill", itemName: "debug" }),
				makeResult({ provider: "amp", portableType: "skill", itemName: "scout" }),
			];
			const counts = toDiscoveryCounts(results);
			expect(counts.providerBreakdown.codex).toEqual({ total: 2, types: { skill: 2 } });
			expect(counts.providerBreakdown.amp).toEqual({ total: 1, types: { skill: 1 } });
		});

		it("tracks multiple types per provider in breakdown", () => {
			const results: PortableInstallResult[] = [
				makeResult({ provider: "codex", portableType: "skill", itemName: "a" }),
				makeResult({ provider: "codex", portableType: "agent", itemName: "b" }),
				makeResult({ provider: "codex", portableType: "config", itemName: "c" }),
			];
			const counts = toDiscoveryCounts(results);
			expect(counts.providerBreakdown.codex).toEqual({
				total: 3,
				types: { skill: 1, agent: 1, config: 1 },
			});
		});

		it("returns zeros and empty breakdown for empty results", () => {
			const counts = toDiscoveryCounts([]);
			expect(counts.agents).toBe(0);
			expect(counts.skills).toBe(0);
			expect(counts.providerBreakdown).toEqual({});
		});

		it("counts rules and hooks portable types", () => {
			const results: PortableInstallResult[] = [
				makeResult({ provider: "claude-code", portableType: "rules", itemName: "rule-a" }),
				makeResult({ provider: "droid", portableType: "hooks", itemName: "pre-commit" }),
				makeResult({ provider: "claude-code", portableType: "hooks", itemName: "pre-push" }),
			];
			const counts = toDiscoveryCounts(results);
			expect(counts.rules).toBe(1);
			expect(counts.hooks).toBe(2);
			expect(counts.providerBreakdown["claude-code"]).toEqual({
				total: 2,
				types: { rules: 1, hooks: 1 },
			});
		});
	});

	describe("annotateResultsWithCollisions", () => {
		it("annotates results with colliding providers", () => {
			const results: PortableInstallResult[] = [
				makeResult({ provider: "codex", portableType: "skill", itemName: "scout" }),
				makeResult({ provider: "amp", portableType: "skill", itemName: "scout" }),
			];
			const collisions: ProviderPathCollision[] = [
				{
					path: ".agents/skills",
					portableType: "skills",
					global: false,
					providers: ["codex", "amp"],
				},
			];
			annotateResultsWithCollisions(results, collisions);
			expect(results[0].collidingProviders).toEqual(["amp"]);
			expect(results[1].collidingProviders).toEqual(["codex"]);
		});

		it("adds warning text with display names", () => {
			const results: PortableInstallResult[] = [
				makeResult({ provider: "codex", portableType: "skill", itemName: "scout" }),
			];
			const collisions: ProviderPathCollision[] = [
				{
					path: ".agents/skills",
					portableType: "skills",
					global: false,
					providers: ["codex", "amp"],
				},
			];
			annotateResultsWithCollisions(results, collisions);
			expect(results[0].warnings).toBeDefined();
			expect(results[0].warnings?.[0]).toContain("Amp");
		});

		it("merges with already-annotated colliding providers", () => {
			const results: PortableInstallResult[] = [
				makeResult({
					provider: "codex",
					portableType: "skill",
					itemName: "scout",
					collidingProviders: ["cursor"],
				}),
			];
			const collisions: ProviderPathCollision[] = [
				{
					path: ".agents/skills",
					portableType: "skills",
					global: false,
					providers: ["codex", "amp"],
				},
			];
			annotateResultsWithCollisions(results, collisions);
			expect(results[0].collidingProviders).toContain("cursor"); // preserved
			expect(results[0].collidingProviders).toContain("amp"); // merged
		});

		it("handles empty collisions array (no-op)", () => {
			const results: PortableInstallResult[] = [
				makeResult({ provider: "codex", portableType: "skill", itemName: "scout" }),
			];
			annotateResultsWithCollisions(results, []);
			expect(results[0].collidingProviders).toBeUndefined();
			expect(results[0].warnings).toBeUndefined();
		});

		it("maps plural portable types to singular correctly", () => {
			const results: PortableInstallResult[] = [
				makeResult({ provider: "codex", portableType: "agent", itemName: "planner" }),
				makeResult({ provider: "amp", portableType: "agent", itemName: "planner" }),
			];
			const collisions: ProviderPathCollision[] = [
				{
					path: "AGENTS.md",
					portableType: "agents",
					global: false,
					providers: ["codex", "amp"],
				},
			];
			annotateResultsWithCollisions(results, collisions);
			expect(results[0].collidingProviders).toEqual(["amp"]);
		});

		it("does not annotate unrelated portable types", () => {
			const results: PortableInstallResult[] = [
				makeResult({ provider: "codex", portableType: "agent", itemName: "planner" }),
			];
			const collisions: ProviderPathCollision[] = [
				{
					path: ".agents/skills",
					portableType: "skills",
					global: false,
					providers: ["codex", "amp"],
				},
			];
			annotateResultsWithCollisions(results, collisions);
			expect(results[0].collidingProviders).toBeUndefined();
		});

		it("deduplicates warnings on repeated calls with same collisions", () => {
			const results: PortableInstallResult[] = [
				makeResult({ provider: "codex", portableType: "skill", itemName: "scout" }),
			];
			const collisions: ProviderPathCollision[] = [
				{
					path: ".agents/skills",
					portableType: "skills",
					global: false,
					providers: ["codex", "amp"],
				},
			];
			annotateResultsWithCollisions(results, collisions);
			const warningCount = results[0].warnings?.length || 0;
			// Second call with same data should not duplicate warnings
			annotateResultsWithCollisions(results, collisions);
			expect(results[0].warnings?.length).toBe(warningCount);
		});
	});
});
