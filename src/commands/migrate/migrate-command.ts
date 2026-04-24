/**
 * Migrate command — one-shot migration of all agents, commands, skills, config,
 * rules, and hooks to target providers. Thin orchestration layer over portable infrastructure.
 */
import { existsSync } from "node:fs";
import { readFile, rm, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { handleDeletions } from "../../domains/installation/deletion-handler.js";
import { logger } from "../../shared/logger.js";
import type { KitType } from "../../types/kit.js";
import type { ClaudeKitMetadata } from "../../types/metadata.js";
import {
	formatDisplayPath,
	renderPreflightRow,
	renderSourceTargetHeader,
} from "../../ui/ck-cli-design/index.js";
import { discoverAgents, getAgentSourcePath } from "../agents/agents-discovery.js";
import { discoverCommands, getCommandSourcePath } from "../commands/commands-discovery.js";
import { cleanupStaleCodexConfigEntries } from "../portable/codex-toml-installer.js";
import {
	copyHooksCompanionDirs,
	discoverConfig,
	discoverHooks,
	discoverRules,
	getHooksSourcePath,
	getRulesSourcePath,
} from "../portable/config-discovery.js";
import { resolveConflict } from "../portable/conflict-resolver.js";
import { convertItem } from "../portable/converters/index.js";
import { generateDiff } from "../portable/diff-display.js";
import { migrateHooksSettings } from "../portable/hooks-settings-merger.js";
import { setTaxonomyOverrides } from "../portable/model-taxonomy.js";
import { ensureOpenCodeModel } from "../portable/opencode-config-installer.js";
import { displayMigrationSummary, displayReconcilePlan } from "../portable/plan-display.js";
import { installPortableItems } from "../portable/portable-installer.js";
import { loadPortableManifest } from "../portable/portable-manifest.js";
import {
	readPortableRegistry,
	removeInstallationsByFilter,
	removePortableInstallation,
	updateAppliedManifestVersion,
} from "../portable/portable-registry.js";
import {
	detectInstalledProviders,
	getPortableBasePath,
	getProvidersSupporting,
	providers,
} from "../portable/provider-registry.js";
import { backfillRegistryChecksums } from "../portable/reconcile-registry-backfill.js";
import {
	type ConversionFallbackWarning,
	buildSourceItemState,
	buildTargetStates,
	buildTypeDirectoryStates,
} from "../portable/reconcile-state-builders.js";
import type {
	ReconcileAction,
	ReconcileBanner,
	ReconcileProviderInput,
	SourceItemState,
	TargetFileState,
} from "../portable/reconcile-types.js";
import { reconcile } from "../portable/reconciler.js";
import type { PortableInstallResult, PortableItem, ProviderType } from "../portable/types.js";
import { discoverSkills, getSkillSourcePath } from "../skills/skills-discovery.js";
import type { SkillInfo } from "../skills/types.js";
import { createMigrateProgressSink } from "./migrate-progress.js";
import { resolveMigrationScope } from "./migrate-scope-resolver.js";
import {
	type PortableSourceCounts,
	buildPreflightRows,
	buildProviderScopeSubtitle,
	buildSourceSummaryLines,
	buildTargetSummaryLines,
	renderBannerLines,
} from "./migrate-ui-summary.js";
import { installSkillDirectories } from "./skill-directory-installer.js";

/** Options for ck migrate */
export interface MigrateOptions {
	agent?: string[];
	global?: boolean;
	yes?: boolean;
	all?: boolean;
	config?: boolean;
	rules?: boolean;
	hooks?: boolean;
	skipConfig?: boolean;
	skipRules?: boolean;
	skipHooks?: boolean;
	source?: string;
	dryRun?: boolean;
	force?: boolean;
	// NEW — mode flags (P5)
	install?: boolean; // --install: opt-in install picker mode
	reconcile?: boolean; // --reconcile: explicit reconcile mode
	reinstallEmptyDirs?: boolean; // --reinstall-empty-dirs (default true)
	respectDeletions?: boolean; // --respect-deletions (default false)
}

/** Resolved migration mode */
export type MigrationMode = "reconcile" | "install";

/**
 * Validate mutually exclusive flag pairs.
 * Returns error message string if conflict detected, null if ok.
 */
export function validateMutualExclusion(options: MigrateOptions): string | null {
	if (options.install && options.reconcile) {
		return "Pass either --install or --reconcile, not both.";
	}
	if (options.reinstallEmptyDirs && options.respectDeletions) {
		return "Pass either --reinstall-empty-dirs or --respect-deletions, not both.";
	}
	return null;
}

/**
 * Resolve which migration mode to use based on flags and registry state.
 * Decision:
 *   --install                → install
 *   --reconcile              → reconcile
 *   neither + unknown checksums in registry → install (smart default per decisions Q6)
 *   neither + valid registry → reconcile
 */
export function resolveMigrationMode(
	options: MigrateOptions,
	hasUnknownChecksums: boolean,
): MigrationMode {
	if (options.install) return "install";
	if (options.reconcile) return "reconcile";
	// Smart default: any unknown checksum → install mode
	if (hasUnknownChecksums) return "install";
	return "reconcile";
}

/**
 * Render reconcile plan banners to stdout.
 * Each banner is an ASCII info box (design-principles.md: ASCII-only, [i]/[!]).
 * Delegates to renderBannerLines() from migrate-ui-summary for the actual formatting.
 */
export function renderBanners(banners: ReconcileBanner[]): void {
	if (banners.length === 0) return;
	for (const banner of banners) {
		const lines = renderBannerLines(banner);
		if (lines.length > 0) {
			console.log();
			for (const line of lines) {
				console.log(line);
			}
		}
	}
}

/**
 * Run install picker mode: show interactive per-type multiselect,
 * build a synthetic plan, and execute.
 * In non-interactive (--yes) mode, all items are selected without prompt.
 */
async function runInstallMode(
	options: MigrateOptions,
	discoveredItems: {
		agents: import("../portable/types.js").PortableItem[];
		commands: import("../portable/types.js").PortableItem[];
		skills: import("../skills/types.js").SkillInfo[];
		configItem: import("../portable/types.js").PortableItem | null;
		ruleItems: import("../portable/types.js").PortableItem[];
		hookItems: import("../portable/types.js").PortableItem[];
	},
	// Reserved for future provider-aware filtering (not yet used in picker UI)
	_selectedProviders: ProviderType[],
	_installGlobally: boolean,
): Promise<{
	agents: import("../portable/types.js").PortableItem[];
	commands: import("../portable/types.js").PortableItem[];
	skills: import("../skills/types.js").SkillInfo[];
	configItem: import("../portable/types.js").PortableItem | null;
	ruleItems: import("../portable/types.js").PortableItem[];
	hookItems: import("../portable/types.js").PortableItem[];
}> {
	const interactive = process.stdout.isTTY && !options.yes;

	if (!interactive) {
		// Non-interactive: return all discovered items
		return discoveredItems;
	}

	// Interactive: per-type multiselect grouped by type
	const toOption = (item: { name: string; recommended?: boolean }) => ({
		value: item.name,
		label: item.name,
		hint: item.recommended ? "Recommended" : undefined,
	});

	let selectedAgents = discoveredItems.agents;
	let selectedCommands = discoveredItems.commands;
	let selectedSkills = discoveredItems.skills;
	let selectedConfig = discoveredItems.configItem;
	let selectedRules = discoveredItems.ruleItems;
	let selectedHooks = discoveredItems.hookItems;

	if (discoveredItems.agents.length > 0) {
		const picked = await p.multiselect({
			message: `Select agents to install (${discoveredItems.agents.length} available)`,
			options: discoveredItems.agents.map(toOption),
			initialValues: discoveredItems.agents.map((a) => a.name),
			required: false,
		});
		if (p.isCancel(picked)) {
			p.cancel("Migrate cancelled");
			process.exit(0);
		}
		const pickedSet = new Set(picked as string[]);
		selectedAgents = discoveredItems.agents.filter((a) => pickedSet.has(a.name));
	}

	if (discoveredItems.commands.length > 0) {
		const picked = await p.multiselect({
			message: `Select commands to install (${discoveredItems.commands.length} available)`,
			options: discoveredItems.commands.map(toOption),
			initialValues: discoveredItems.commands.map((c) => c.name),
			required: false,
		});
		if (p.isCancel(picked)) {
			p.cancel("Migrate cancelled");
			process.exit(0);
		}
		const pickedSet = new Set(picked as string[]);
		selectedCommands = discoveredItems.commands.filter((c) => pickedSet.has(c.name));
	}

	// Skills are directory-level items — show directory names
	if (discoveredItems.skills.length > 0) {
		const picked = await p.multiselect({
			message: `Select skills to install (${discoveredItems.skills.length} available, directory-level)`,
			options: discoveredItems.skills.map((s) => ({
				value: s.name,
				label: s.name,
				hint: "skill directory",
			})),
			initialValues: discoveredItems.skills.map((s) => s.name),
			required: false,
		});
		if (p.isCancel(picked)) {
			p.cancel("Migrate cancelled");
			process.exit(0);
		}
		const pickedSet = new Set(picked as string[]);
		selectedSkills = discoveredItems.skills.filter((s) => pickedSet.has(s.name));
	}

	// Order: config → rules → hooks to match dashboard TYPE_ORDER
	// (agents, commands, skills prompted above; config+rules+hooks here)

	// Config: single item, yes/no
	if (discoveredItems.configItem) {
		const include = await p.confirm({
			message: "Include CLAUDE.md config?",
			initialValue: true,
		});
		if (p.isCancel(include)) {
			p.cancel("Migrate cancelled");
			process.exit(0);
		}
		if (!include) selectedConfig = null;
	}

	if (discoveredItems.ruleItems.length > 0) {
		const picked = await p.multiselect({
			message: `Select rules to install (${discoveredItems.ruleItems.length} available)`,
			options: discoveredItems.ruleItems.map(toOption),
			initialValues: discoveredItems.ruleItems.map((r) => r.name),
			required: false,
		});
		if (p.isCancel(picked)) {
			p.cancel("Migrate cancelled");
			process.exit(0);
		}
		const pickedSet = new Set(picked as string[]);
		selectedRules = discoveredItems.ruleItems.filter((r) => pickedSet.has(r.name));
	}

	if (discoveredItems.hookItems.length > 0) {
		const picked = await p.multiselect({
			message: `Select hooks to install (${discoveredItems.hookItems.length} available)`,
			options: discoveredItems.hookItems.map(toOption),
			initialValues: discoveredItems.hookItems.map((h) => h.name),
			required: false,
		});
		if (p.isCancel(picked)) {
			p.cancel("Migrate cancelled");
			process.exit(0);
		}
		const pickedSet = new Set(picked as string[]);
		selectedHooks = discoveredItems.hookItems.filter((h) => pickedSet.has(h.name));
	}

	return {
		agents: selectedAgents,
		commands: selectedCommands,
		skills: selectedSkills,
		configItem: selectedConfig,
		ruleItems: selectedRules,
		hookItems: selectedHooks,
	};
}

/**
 * Map portable item type to provider config path key.
 * Typed to the ReconcileAction.type union so the switch is exhaustive at
 * compile time — unknown types surface as a type error rather than silently
 * passing through.
 */
function getProviderPathKey(type: ReconcileAction["type"]): string {
	switch (type) {
		case "agent":
			return "agents";
		case "command":
			return "commands";
		case "config":
			return "config";
		case "rules":
			return "rules";
		case "hooks":
			return "hooks";
		case "skill":
			return "skills";
	}
}

function shouldExecuteAction(action: ReconcileAction): boolean {
	if (action.action === "install" || action.action === "update") {
		return true;
	}
	if (action.action === "conflict") {
		const resolution = action.resolution?.type;
		return resolution === "overwrite" || resolution === "smart-merge" || resolution === "resolved";
	}
	return false;
}

async function executeDeleteAction(
	action: ReconcileAction,
	options?: { preservePaths?: Set<string> },
): Promise<PortableInstallResult> {
	const preservePaths = options?.preservePaths ?? new Set<string>();
	const shouldPreserveTarget =
		action.targetPath.length > 0 && preservePaths.has(resolve(action.targetPath));

	try {
		if (!shouldPreserveTarget && action.targetPath && existsSync(action.targetPath)) {
			await rm(action.targetPath, { recursive: true, force: true });
		}
		await removePortableInstallation(
			action.item,
			action.type,
			action.provider as ProviderType,
			action.global,
		);
		return {
			operation: "delete",
			portableType: action.type,
			itemName: action.item,
			provider: action.provider as ProviderType,
			providerDisplayName:
				providers[action.provider as ProviderType]?.displayName || action.provider,
			success: true,
			path: action.targetPath,
			skipped: shouldPreserveTarget,
			skipReason: shouldPreserveTarget
				? "Registry entry removed; target preserved because newer action wrote same path"
				: undefined,
		};
	} catch (error) {
		return {
			operation: "delete",
			portableType: action.type,
			itemName: action.item,
			provider: action.provider as ProviderType,
			providerDisplayName:
				providers[action.provider as ProviderType]?.displayName || action.provider,
			success: false,
			path: action.targetPath,
			error: error instanceof Error ? error.message : "Delete action failed",
		};
	}
}

/**
 * Process source kit metadata.json deletions against the user's .claude/ directory.
 * Handles directory renames (e.g., skills/plan → skills/ck-plan) by removing
 * old paths listed in the source kit's deletions array.
 *
 * Source metadata is read from the kit source directory (adjacent to skills/),
 * NOT from the user's installed metadata — which uses a different multi-kit format.
 */
async function processMetadataDeletions(
	skillSourcePath: string | null,
	installGlobally: boolean,
): Promise<void> {
	// Derive source metadata.json from skill source path (skills/ and metadata.json are siblings under .claude/)
	if (!skillSourcePath) return;
	const sourceMetadataPath = join(resolve(skillSourcePath, ".."), "metadata.json");

	if (!existsSync(sourceMetadataPath)) return;

	let sourceMetadata: ClaudeKitMetadata;
	try {
		const content = await readFile(sourceMetadataPath, "utf-8");
		sourceMetadata = JSON.parse(content) as ClaudeKitMetadata;
	} catch (error) {
		logger.debug(`[migrate] Failed to parse source metadata.json: ${error}`);
		return;
	}

	if (!sourceMetadata.deletions || sourceMetadata.deletions.length === 0) return;

	// Deletions are .claude/-relative paths — only apply to claude-code provider target
	const claudeDir = installGlobally ? join(homedir(), ".claude") : join(process.cwd(), ".claude");

	if (!existsSync(claudeDir)) return;

	try {
		const result = await handleDeletions(
			sourceMetadata,
			claudeDir,
			inferKitTypeFromSourceMetadata(sourceMetadata),
		);
		if (result.deletedPaths.length > 0) {
			logger.verbose(
				`[migrate] Cleaned up ${result.deletedPaths.length} deprecated path(s): ${result.deletedPaths.join(", ")}`,
			);
		}
	} catch (error) {
		logger.warning(`[migrate] Deletion cleanup failed: ${error}`);
	}
}

function inferKitTypeFromSourceMetadata(sourceMetadata: ClaudeKitMetadata): KitType | undefined {
	// NOTE: This relies on the source metadata name following the current
	// claudekit-{kitType} naming convention used by published kits.
	if (sourceMetadata.name?.includes("marketing")) return "marketing";
	if (sourceMetadata.name?.includes("engineer")) return "engineer";
	return undefined;
}

/**
 * Main migrate command handler
 */
export async function migrateCommand(options: MigrateOptions): Promise<void> {
	console.log();

	// Validate mutually exclusive flags before doing any I/O
	const mutexError = validateMutualExclusion(options);
	if (mutexError) {
		p.log.error(mutexError);
		process.exit(1);
	}

	try {
		const scope = resolveMigrationScope(process.argv.slice(2), options);

		// Phase 1: Discover all portable items
		const spinner = p.spinner();
		spinner.start("Discovering portable items...");

		const agentSource = scope.agents ? getAgentSourcePath() : null;
		const commandSource = scope.commands ? getCommandSourcePath() : null;
		const skillSource = scope.skills ? getSkillSourcePath() : null;
		const hooksSource = scope.hooks ? getHooksSourcePath() : null;
		// Resolve rules source path for origin tracking (only needed when rules in scope)
		const rulesSourcePath = scope.rules ? getRulesSourcePath() : null;

		const agents = agentSource ? await discoverAgents(agentSource) : [];
		const commands = commandSource ? await discoverCommands(commandSource) : [];
		const skills = skillSource ? await discoverSkills(skillSource) : [];
		const configItem = scope.config ? await discoverConfig(options.source) : null;
		// rulesSourcePath is non-null when scope.rules is true (same guard)
		const ruleItems = rulesSourcePath ? await discoverRules(rulesSourcePath) : [];
		const { items: hookItems, skippedShellHooks } = hooksSource
			? await discoverHooks(hooksSource)
			: { items: [], skippedShellHooks: [] };
		if (skippedShellHooks.length > 0) {
			logger.warning(
				`[migrate] Skipping ${skippedShellHooks.length} shell hook(s) not supported for migration (node-runnable only): ${skippedShellHooks.join(", ")}`,
			);
		}

		spinner.stop("Discovery complete");

		const hasItems =
			agents.length > 0 ||
			commands.length > 0 ||
			skills.length > 0 ||
			configItem !== null ||
			ruleItems.length > 0 ||
			hookItems.length > 0;

		if (!hasItems) {
			p.log.error("Nothing to migrate.");
			p.log.info(
				pc.dim(
					"Check .claude/agents/, .claude/commands/, .claude/skills/, .claude/rules/, .claude/hooks/, and CLAUDE.md (project or ~/.claude/)",
				),
			);
			p.outro(pc.red("Nothing to migrate"));
			return;
		}

		// Phase 2: Select providers
		const detectedProviders = await detectInstalledProviders();
		let selectedProviders: ProviderType[];

		// Build the full set of providers that support at least one portable type
		const allSupportedProviders = Array.from(
			new Set<ProviderType>([
				...getProvidersSupporting("agents"),
				...getProvidersSupporting("commands"),
				...getProvidersSupporting("skills"),
				...getProvidersSupporting("config"),
				...getProvidersSupporting("rules"),
				...getProvidersSupporting("hooks"),
			]),
		);

		if (options.agent && options.agent.length > 0) {
			// Validate provider names
			const validProviders = Object.keys(providers);
			const invalid = options.agent.filter((a) => !validProviders.includes(a));
			if (invalid.length > 0) {
				p.log.error(`Unknown provider(s): ${invalid.join(", ")}`);
				p.log.info(pc.dim(`Valid providers: ${validProviders.join(", ")}`));
				p.outro(pc.red("Invalid provider"));
				return;
			}
			selectedProviders = options.agent as ProviderType[];
		} else if (options.all) {
			selectedProviders = allSupportedProviders;
			p.log.info(`Migrating to all ${selectedProviders.length} providers`);
		} else if (options.yes) {
			// Non-interactive: auto-select detected providers, fall back to all
			if (detectedProviders.length > 0) {
				selectedProviders = detectedProviders;
				p.log.info(
					`Migrating to: ${detectedProviders.map((a) => pc.cyan(providers[a].displayName)).join(", ")}`,
				);
			} else {
				selectedProviders = allSupportedProviders;
				p.log.info("No providers detected, migrating to all");
			}
		} else {
			// Interactive: grouped multiselect with detected + not-detected sections
			const detectedSet = new Set(detectedProviders);
			const notDetected = allSupportedProviders.filter((pv) => !detectedSet.has(pv));
			const toOption = (key: ProviderType) => ({
				value: key,
				label: providers[key].displayName,
			});

			if (detectedProviders.length > 0) {
				p.log.info(`Detected ${pc.cyan(String(detectedProviders.length))} installed provider(s)`);
			} else {
				p.log.warn("No providers detected on your system.");
			}

			const groupOptions: Record<string, Array<{ value: ProviderType; label: string }>> = {};

			if (detectedProviders.length > 0) {
				groupOptions[`Detected ${pc.dim("(installed)")}`] = detectedProviders.map(toOption);
			}
			if (notDetected.length > 0) {
				groupOptions[`Not detected ${pc.dim("(select manually if installed)")}`] =
					notDetected.map(toOption);
			}

			if (Object.keys(groupOptions).length === 0) {
				p.cancel("No providers available");
				return;
			}

			const selected = await p.groupMultiselect({
				message: "Select providers to migrate to",
				options: groupOptions,
				initialValues: detectedProviders,
				required: true,
			});
			if (p.isCancel(selected)) {
				p.cancel("Migrate cancelled");
				return;
			}
			selectedProviders = selected as ProviderType[];
		}
		selectedProviders = Array.from(new Set(selectedProviders));

		// Phase 3: Select scope
		let requestedGlobal = options.global ?? false;
		let installGlobally = requestedGlobal;
		if (options.global === undefined && !options.yes) {
			const projectTarget = join(process.cwd(), ".claude");
			const globalTarget = join(homedir(), ".claude");
			const scopeChoice = await p.select({
				message: "Installation scope",
				options: [
					{
						value: true,
						label: "Global",
						hint: `-> ${globalTarget}`,
					},
					{
						value: false,
						label: "Project",
						hint: `-> ${projectTarget}`,
					},
				],
			});
			if (p.isCancel(scopeChoice)) {
				p.cancel("Migrate cancelled");
				return;
			}
			requestedGlobal = scopeChoice as boolean;
			installGlobally = requestedGlobal;
		}

		const codexCommandsRequireGlobal =
			scope.commands &&
			selectedProviders.includes("codex") &&
			providers.codex.commands !== null &&
			providers.codex.commands.projectPath === null;
		if (codexCommandsRequireGlobal && !installGlobally) {
			installGlobally = true;
			p.log.info(pc.dim("Codex commands are global-only; scope adjusted to global."));
		}

		const sourceCounts: PortableSourceCounts = {
			agents: agents.length,
			commands: commands.length,
			config: configItem ? 1 : 0,
			hooks: hookItems.length,
			rules: ruleItems.length,
			skills: skills.length,
		};
		const sourceOrigins = [
			agentSource,
			commandSource,
			skillSource,
			configItem?.sourcePath ?? null,
			rulesSourcePath,
			hooksSource,
		].filter((origin): origin is string => origin !== null);
		const preflightRows = buildPreflightRows(sourceCounts, selectedProviders, {
			actualGlobal: installGlobally,
			requestedGlobal,
		});
		const discoveryParts: string[] = [];
		const agentSourceDisplay = agentSource ? formatDisplayPath(agentSource) : "source unavailable";
		const commandSourceDisplay = commandSource
			? formatDisplayPath(commandSource)
			: "source unavailable";
		const skillSourceDisplay = skillSource ? formatDisplayPath(skillSource) : "source unavailable";
		const rulesSourceDisplay = rulesSourcePath
			? formatDisplayPath(rulesSourcePath)
			: "source unavailable";
		const hooksSourceDisplay = hooksSource ? formatDisplayPath(hooksSource) : "source unavailable";
		if (agents.length > 0) {
			discoveryParts.push(`${agents.length} agent(s) ${pc.dim(`<- ${agentSourceDisplay}`)}`);
		}
		if (commands.length > 0) {
			discoveryParts.push(`${commands.length} command(s) ${pc.dim(`<- ${commandSourceDisplay}`)}`);
		}
		if (skills.length > 0) {
			discoveryParts.push(`${skills.length} skill(s) ${pc.dim(`<- ${skillSourceDisplay}`)}`);
		}
		if (configItem) {
			discoveryParts.push(`config ${pc.dim(`<- ${formatDisplayPath(configItem.sourcePath)}`)}`);
		}
		if (ruleItems.length > 0) {
			discoveryParts.push(`${ruleItems.length} rule(s) ${pc.dim(`<- ${rulesSourceDisplay}`)}`);
		}
		if (hookItems.length > 0) {
			discoveryParts.push(`${hookItems.length} hook(s) ${pc.dim(`<- ${hooksSourceDisplay}`)}`);
		}

		console.log();
		console.log(
			renderSourceTargetHeader({
				sourceLines: buildSourceSummaryLines(sourceCounts, sourceOrigins),
				subtitle: buildProviderScopeSubtitle(selectedProviders, installGlobally),
				targetLines: buildTargetSummaryLines(preflightRows),
				title: "ck migrate",
			}).join("\n"),
		);
		p.log.info(pc.dim(`  CWD: ${process.cwd()}`));
		p.log.info(`Found: ${discoveryParts.join(", ")}`);

		console.log();
		p.log.step(pc.bold("Migrate Summary"));
		const providerNames = selectedProviders
			.map((prov) => pc.cyan(providers[prov].displayName))
			.join(", ");
		p.log.message(`  Providers: ${providerNames}`);
		for (const row of preflightRows) {
			for (const line of renderPreflightRow(row)) {
				console.log(line);
			}
		}

		// Load CkConfig for taxonomy overrides and apply before conversion
		const { CkConfigManager } = await import("../../domains/config/ck-config-manager.js");
		const ckConfigResult = await CkConfigManager.loadFull(process.cwd());
		setTaxonomyOverrides(
			ckConfigResult.config.modelTaxonomy as
				| Record<string, Record<string, { model: string; effort?: string }>>
				| undefined,
		);

		// Phase 4: Reconciliation (compute plan before execution)
		const reconcileSpinner = p.spinner();
		reconcileSpinner.start("Computing migration plan...");

		const registry = await readPortableRegistry();

		// Smart mode resolution: any unknown checksums → suggest install mode
		const hasUnknownChecksums = registry.installations.some(
			(entry) =>
				!entry.sourceChecksum ||
				entry.sourceChecksum === "unknown" ||
				!entry.targetChecksum ||
				entry.targetChecksum === "unknown",
		);
		const migrationMode = resolveMigrationMode(options, hasUnknownChecksums);

		// In install mode, run interactive picker to narrow item selection
		let effectiveAgents = agents;
		let effectiveCommands = commands;
		let effectiveSkills = skills;
		let effectiveConfigItem = configItem;
		let effectiveRuleItems = ruleItems;
		let effectiveHookItems = hookItems;

		if (migrationMode === "install") {
			reconcileSpinner.stop("Discovery complete");
			if (!options.yes && process.stdout.isTTY) {
				p.log.info(
					`[i] Smart default: ${hasUnknownChecksums ? "unknown checksums detected" : "--install flag"} — entering install picker mode.`,
				);
			}
			const picked = await runInstallMode(
				options,
				{
					agents,
					commands,
					skills,
					configItem,
					ruleItems,
					hookItems,
				},
				selectedProviders,
				installGlobally,
			);
			effectiveAgents = picked.agents;
			effectiveCommands = picked.commands;
			effectiveSkills = picked.skills;
			effectiveConfigItem = picked.configItem;
			effectiveRuleItems = picked.ruleItems;
			effectiveHookItems = picked.hookItems;
			reconcileSpinner.start("Computing migration plan...");
		}

		const sourceStates = await computeSourceStates(
			{
				agents: effectiveAgents,
				commands: effectiveCommands,
				config: effectiveConfigItem,
				rules: effectiveRuleItems,
				hooks: effectiveHookItems,
			},
			selectedProviders,
		);

		const targetStates = await computeTargetStates(selectedProviders, installGlobally);

		const providerConfigs: ReconcileProviderInput[] = selectedProviders.map((provider) => ({
			provider,
			global: installGlobally,
		}));

		// Compute directory states for empty-dir override logic (P1 feature)
		const portableTypes = ["agent", "command", "config", "rules", "hooks"] as const;
		const typeDirectoryStates = buildTypeDirectoryStates(
			selectedProviders.map((provider) => ({ provider, global: installGlobally })),
			[...portableTypes],
		);

		// Determine reinstallEmptyDirs: default true unless --respect-deletions set
		const reinstallEmptyDirs = options.respectDeletions
			? false
			: (options.reinstallEmptyDirs ?? true);

		const plan = reconcile({
			sourceItems: sourceStates,
			registry,
			targetStates,
			providerConfigs,
			force: options.force,
			typeDirectoryStates,
			respectDeletions: !reinstallEmptyDirs,
		});

		reconcileSpinner.stop("Plan computed");

		// Display plan
		const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

		// Render banners (empty-dir notices) before the plan display
		renderBanners(plan.banners);

		displayReconcilePlan(plan, { color: useColor });

		// Dry-run: show plan and exit
		if (options.dryRun) {
			displayMigrationSummary(
				plan,
				buildDryRunFallbackResults(
					effectiveSkills,
					selectedProviders,
					installGlobally,
					plan.actions,
				),
				{ color: useColor, dryRun: true },
			);
			return;
		}

		// Phase 4.5: Resolve conflicts if any
		if (plan.hasConflicts) {
			const interactive = process.stdout.isTTY && !options.yes;
			const conflictActions = plan.actions.filter((a) => a.action === "conflict");

			for (const action of conflictActions) {
				// Compute diff if not already present
				if (!action.diff && action.targetPath && existsSync(action.targetPath)) {
					try {
						const targetContent = await readFile(action.targetPath, "utf-8");
						const sourceItem =
							effectiveAgents.find((a) => a.name === action.item) ||
							effectiveCommands.find((c) => c.name === action.item) ||
							(effectiveConfigItem?.name === action.item ? effectiveConfigItem : null) ||
							effectiveRuleItems.find((r) => r.name === action.item) ||
							effectiveHookItems.find((h) => h.name === action.item);

						if (sourceItem) {
							const providerConfig = providers[action.provider as ProviderType];
							const pathConfigKey = getProviderPathKey(action.type);
							const pathConfig = providerConfig[pathConfigKey as keyof typeof providerConfig];
							if (pathConfig && typeof pathConfig === "object" && "format" in pathConfig) {
								const converted = convertItem(
									sourceItem,
									pathConfig.format,
									action.provider as ProviderType,
								);
								action.diff = generateDiff(targetContent, converted.content, action.item);
							}
						}
					} catch {
						// Diff generation failed, continue without diff
					}
				}

				action.resolution = await resolveConflict(action, { interactive, color: useColor });
			}
		}

		console.log();

		// Phase 5: Confirm and install
		// Sort so config is installed first in merge-single targets (AGENTS.md) —
		// config content gets the most important first-token positions.
		const typePriority: Record<ReconcileAction["type"], number> = {
			config: 0,
			rules: 1,
			hooks: 2,
			agent: 3,
			command: 4,
			skill: 5,
		};
		const plannedExecActions = plan.actions
			.filter(shouldExecuteAction)
			.sort((a, b) => (typePriority[a.type] ?? 99) - (typePriority[b.type] ?? 99));
		const plannedDeleteActions = plan.actions.filter((a) => a.action === "delete");
		if (!options.yes) {
			const totalItems = plannedExecActions.length + plannedDeleteActions.length;
			const confirmed = await p.confirm({
				message: `Migrate ${totalItems} item(s) to ${selectedProviders.length} provider(s)?`,
			});
			if (p.isCancel(confirmed) || !confirmed) {
				p.cancel("Migrate cancelled");
				return;
			}
		}

		let allResults: PortableInstallResult[] = [];
		const installOpts = { global: installGlobally };
		const agentByName = new Map(effectiveAgents.map((item) => [item.name, item]));
		const commandByName = new Map(effectiveCommands.map((item) => [item.name, item]));
		const skillByName = new Map(effectiveSkills.map((item) => [item.name, item]));
		const configByName = new Map(
			effectiveConfigItem ? [[effectiveConfigItem.name, effectiveConfigItem]] : [],
		);
		const ruleByName = new Map(effectiveRuleItems.map((item) => [item.name, item]));
		const hookByName = new Map(effectiveHookItems.map((item) => [item.name, item]));
		const successfulHookFiles = new Map<ProviderType, string[]>();
		// Absolute paths of installed hook files, per target provider.
		// Passed to migrateHooksSettings so it can generate Codex wrapper scripts.
		const successfulHookAbsPaths = new Map<ProviderType, string[]>();
		const postProgressWarnings: string[] = [];
		const writeTasks: Array<
			| {
					item: PortableItem;
					provider: ProviderType;
					type: "agent" | "command" | "config" | "rules" | "hooks";
			  }
			| {
					item: SkillInfo;
					provider: ProviderType;
					type: "skill";
			  }
		> = [];

		for (const action of plannedExecActions) {
			const provider = action.provider as ProviderType;
			if (!selectedProviders.includes(provider)) continue;

			if (action.type === "agent") {
				const item = agentByName.get(action.item);
				if (!item || !getProvidersSupporting("agents").includes(provider)) continue;
				writeTasks.push({ item, provider, type: "agent" });
				continue;
			}

			if (action.type === "command") {
				const item = commandByName.get(action.item);
				if (!item || !getProvidersSupporting("commands").includes(provider)) continue;
				writeTasks.push({ item, provider, type: "command" });
				continue;
			}

			if (action.type === "skill") {
				const item = skillByName.get(action.item);
				if (!item || !getProvidersSupporting("skills").includes(provider)) continue;
				writeTasks.push({ item, provider, type: "skill" });
				continue;
			}

			if (action.type === "config") {
				const item = configByName.get(action.item);
				if (!item || !getProvidersSupporting("config").includes(provider)) continue;
				writeTasks.push({ item, provider, type: "config" });
				continue;
			}

			if (action.type === "rules") {
				const item = ruleByName.get(action.item);
				if (!item || !getProvidersSupporting("rules").includes(provider)) continue;
				writeTasks.push({ item, provider, type: "rules" });
				continue;
			}

			if (action.type === "hooks") {
				const item = hookByName.get(action.item);
				if (!item || !getProvidersSupporting("hooks").includes(provider)) continue;
				writeTasks.push({ item, provider, type: "hooks" });
			}
		}

		// Skills are directory-based and not fully represented in current reconcile source states.
		// Preserve existing migration behavior until skills become first-class reconcile actions.
		const plannedSkillActions = plannedExecActions.filter(
			(action) => action.type === "skill",
		).length;
		if (effectiveSkills.length > 0 && plannedSkillActions === 0) {
			const skillProviders = selectedProviders.filter((pv) =>
				getProvidersSupporting("skills").includes(pv),
			);
			for (const provider of skillProviders) {
				for (const skill of effectiveSkills) {
					writeTasks.push({ item: skill, provider, type: "skill" });
				}
			}
		}

		const progressSink = createMigrateProgressSink(writeTasks.length + plannedDeleteActions.length);
		const writtenPaths = new Set<string>();
		for (const task of writeTasks) {
			const taskResults =
				task.type === "skill"
					? annotateInstallResults(
							await installSkillDirectories([task.item], [task.provider], installOpts),
							"skill",
							task.item.name,
						)
					: annotateInstallResults(
							await installPortableItems([task.item], [task.provider], task.type, installOpts),
							task.type,
							task.item.name,
						);
			allResults.push(...taskResults);
			for (const result of taskResults.filter((entry) => entry.success && !entry.skipped)) {
				if (result.path.length > 0) {
					writtenPaths.add(resolve(result.path));
				}
				if (task.type === "hooks") {
					const existing = successfulHookFiles.get(task.provider) ?? [];
					existing.push(basename(result.path));
					successfulHookFiles.set(task.provider, existing);
					// Track absolute paths for Codex wrapper generation
					if (result.path.length > 0) {
						const absExisting = successfulHookAbsPaths.get(task.provider) ?? [];
						absExisting.push(resolve(result.path));
						successfulHookAbsPaths.set(task.provider, absExisting);
					}
				}
			}
			progressSink.tick(progressLabelForType(task.type));
		}

		// Ensure opencode.json has a `model` — migrated agents inherit from global
		// config; without it, OpenCode throws ProviderModelNotFoundError (#728).
		if (selectedProviders.includes("opencode")) {
			try {
				const result = await ensureOpenCodeModel({
					global: installGlobally,
					interactive: process.stdout.isTTY === true && !options.yes,
				});
				if (result.action === "created" || result.action === "added") {
					const reason = result.reason ? ` (${result.reason})` : "";
					p.log.info(`Set default model "${result.model}" in ${result.path}${reason}`);
				} else if (result.action === "skipped") {
					p.log.warn(
						"Skipped writing default model to opencode.json. Migrated agents may fail with ProviderModelNotFoundError until you set one.",
					);
				}
			} catch (err) {
				postProgressWarnings.push(
					`Could not update opencode.json model (${err instanceof Error ? err.message : String(err)}). Agents may fail with ProviderModelNotFoundError until a model is set.`,
				);
			}
		}

		// Copy hook companion directories (lib/, scout-block/, etc.) and .ckignore to each
		// provider's hooks directory so that `require('./lib/*.cjs')` calls inside hooks
		// resolve correctly. This runs after per-file hook installs and before settings merger.
		if (hooksSource && successfulHookFiles.size > 0) {
			for (const hooksProvider of successfulHookFiles.keys()) {
				const providerCfg = providers[hooksProvider];
				const targetHooksDir = installGlobally
					? providerCfg.hooks?.globalPath
					: providerCfg.hooks?.projectPath;
				if (!targetHooksDir) continue;
				const companionResult = await copyHooksCompanionDirs(hooksSource, targetHooksDir);
				if (companionResult.errors.length > 0) {
					for (const e of companionResult.errors) {
						postProgressWarnings.push(`Hook companion copy warning (${e.name}): ${e.error}`);
					}
				}
				logger.verbose(
					`[migrate] Copied hook companions to ${hooksProvider}: dirs=[${companionResult.copiedDirs.join(",")}] dotfiles=[${companionResult.copiedDotfiles.join(",")}]`,
				);
				const companionParts: string[] = [];
				if (companionResult.copiedDirs.length > 0) {
					companionParts.push(`${companionResult.copiedDirs.join(", ")}`);
				}
				if (companionResult.copiedDotfiles.length > 0) {
					companionParts.push(companionResult.copiedDotfiles.join(", "));
				}
				if (companionParts.length > 0) {
					p.log.info(
						pc.dim(`Copied hook companions to ${hooksProvider}: ${companionParts.join(" + ")}`),
					);
				}
			}
		}

		// After all actions executed, merge hooks into target settings.json per provider
		for (const [hooksProvider, files] of successfulHookFiles) {
			if (files.length === 0) continue;
			const mergeResult = await migrateHooksSettings({
				sourceProvider: "claude-code",
				targetProvider: hooksProvider,
				installedHookFiles: files,
				installedHookAbsolutePaths: successfulHookAbsPaths.get(hooksProvider),
				global: installGlobally,
			});
			if (mergeResult.success && mergeResult.hooksRegistered > 0) {
				logger.verbose(
					`Registered ${mergeResult.hooksRegistered} hook(s) in ${hooksProvider} settings.json`,
				);
			} else {
				const feedbackMessage = mergeResult.error ?? mergeResult.message;
				if (feedbackMessage) {
					postProgressWarnings.push(feedbackMessage);
				}
			}
		}

		// Process metadata.json deletions (handles directory renames like skills/plan → skills/ck-plan)
		// This runs AFTER skill installation so new dirs exist before old ones are removed.
		await processMetadataDeletions(skillSource, installGlobally);

		for (const deleteAction of plannedDeleteActions) {
			allResults.push(
				await executeDeleteAction(deleteAction, {
					preservePaths: writtenPaths,
				}),
			);
			progressSink.tick("Cleanup");
		}
		progressSink.done();
		for (const warning of postProgressWarnings) {
			p.log.warn(warning);
		}

		// Best-effort registry healing for checksum-only skips. This covers both
		// v2->v3 unknown checksums and older merge-single entries whose stored
		// target checksum drifted from the canonical managed-section checksum.
		try {
			await backfillRegistryChecksums(plan.actions, registry);
		} catch {
			logger.debug("Failed to backfill reconcile registry checksums — will retry on next run");
		}

		// Clean up stale codex-toml config.toml entries for deleted .toml files.
		// When target .toml files are deleted, the reconciler skips them (respecting
		// deletion) but the config.toml sentinel block still references them, causing
		// Codex to show warnings about missing agent files.
		for (const provider of selectedProviders) {
			const providerConfig = providers[provider];
			if (providerConfig.agents?.writeStrategy !== "codex-toml") continue;

			const staleSlugs = await cleanupStaleCodexConfigEntries({
				global: installGlobally,
				provider,
			});

			if (staleSlugs.length > 0) {
				// Batch registry cleanup under lock (consistent with syncPortableRegistry pattern).
				// Matches stale slugs by basename() for cross-platform path support.
				const staleSlugSet = new Set(staleSlugs.map((s) => `${s}.toml`));
				const removed = await removeInstallationsByFilter(
					(i) =>
						i.type === "agent" &&
						i.provider === provider &&
						i.global === installGlobally &&
						staleSlugSet.has(basename(i.path)),
				);
				for (const entry of removed) {
					logger.verbose(`[migrate] Cleaned stale registry entry: ${entry.item} (${provider})`);
				}
			}
		}

		// Update appliedManifestVersion so manifest entries aren't re-evaluated on future runs.
		// Kit layout assumption: agents/, commands/, and skills/ are exactly one level below the
		// kit root (.claude/), so resolving any source path with ".." yields the kit root.
		try {
			const kitRoot =
				(agentSource ? resolve(agentSource, "..") : null) ??
				(commandSource ? resolve(commandSource, "..") : null) ??
				(skillSource ? resolve(skillSource, "..") : null) ??
				null;
			const manifest = kitRoot ? await loadPortableManifest(kitRoot) : null;
			if (manifest?.cliVersion) {
				// Use cliVersion (the CK semver that produced this manifest) rather than
				// manifest.version (the schema version, e.g. "1.0"), so future runs can
				// compare against the actual CLI release that last applied migrations.
				await updateAppliedManifestVersion(manifest.cliVersion);
				logger.verbose(`[migrate] Updated appliedManifestVersion to ${manifest.cliVersion}`);
			}
		} catch {
			logger.debug("[migrate] Failed to update appliedManifestVersion — will retry on next run");
		}

		// Check for partial failure and offer rollback (#407)
		const failed = allResults.filter((r) => !r.success);
		const successful = allResults.filter((r) => r.success && !r.skipped);
		const hasEmbeddedPartialFailures = allResults.some((result) =>
			(result.warnings || []).some((warning) => warning.startsWith("Failed item:")),
		);

		if (failed.length > 0 && successful.length > 0) {
			if (!options.yes) {
				const newWrites = successful.filter((r) => !r.overwritten);
				const overwritten = successful.filter((r) => r.overwritten);
				let rollbackMsg = `${failed.length} item(s) failed. Rollback ${newWrites.length} new write(s)?`;
				if (overwritten.length > 0) {
					rollbackMsg += ` (${overwritten.length} overwrite(s) will be kept)`;
				}
				const shouldRollback = await p.confirm({
					message: rollbackMsg,
					initialValue: false,
				});

				if (!p.isCancel(shouldRollback) && shouldRollback) {
					const rolledBackPaths = await rollbackResults(successful);
					allResults = allResults.map((result) =>
						result.path.length > 0 && rolledBackPaths.has(result.path)
							? { ...result, skipped: true, skipReason: "Rolled back after failure" }
							: result,
					);
					p.log.info(`Rolled back ${newWrites.length} file(s)`);
				}
			}
		}

		// Display migration summary with plan context
		displayMigrationSummary(plan, allResults, { color: useColor });

		// Show detailed results if there are failures
		if (failed.length > 0) {
			console.log();
			displayResults(allResults);
		}
		if (failed.length > 0 || hasEmbeddedPartialFailures) {
			process.exitCode = 1;
		}
	} catch (error) {
		logger.error(error instanceof Error ? error.message : "Unknown error");
		p.outro(pc.red("Migrate failed"));
		process.exit(1);
	}
}

/**
 * Rollback successfully written files from a partial migration failure (#407).
 * Only removes files/dirs that were created in this run — not pre-existing content.
 */
async function rollbackResults(results: PortableInstallResult[]): Promise<Set<string>> {
	const rolledBackPaths = new Set<string>();
	for (const result of results) {
		if (!result.path || !existsSync(result.path)) continue;

		try {
			// Skip rollback for files that were overwritten (pre-existing data we shouldn't delete)
			if (result.overwritten) continue;

			const stat = await import("node:fs/promises").then((fs) => fs.stat(result.path));
			if (stat.isDirectory()) {
				await rm(result.path, { recursive: true, force: true });
			} else {
				await unlink(result.path);
			}
			rolledBackPaths.add(result.path);
		} catch {
			// Best-effort cleanup — don't fail on rollback errors
		}
	}
	return rolledBackPaths;
}

function warnConversionFallback(warning: ConversionFallbackWarning): void {
	logger.warning(
		logger.sanitize(
			`[migrate] Falling back to raw checksum for ${warning.provider} ${warning.type} "${warning.item}" because ${warning.format} conversion failed: ${warning.error}`,
		),
	);
}

/**
 * Compute source states with checksums for all discovered items
 * Note: For skills, we skip checksum computation (skills are directories, not single files)
 */
async function computeSourceStates(
	items: {
		agents: PortableItem[];
		commands: PortableItem[];
		config: PortableItem | null;
		rules: PortableItem[];
		hooks: PortableItem[];
	},
	selectedProviders: ProviderType[],
): Promise<SourceItemState[]> {
	const states: SourceItemState[] = [];

	// Helper to process items of a given type
	const processItems = (
		itemList: PortableItem[],
		type: "agent" | "command" | "config" | "rules" | "hooks",
	) => {
		for (const item of itemList) {
			states.push(
				buildSourceItemState(item, type, selectedProviders, {
					onConversionFallback: warnConversionFallback,
				}),
			);
		}
	};

	processItems(items.agents, "agent");
	processItems(items.commands, "command");
	if (items.config) {
		processItems([items.config], "config");
	}
	processItems(items.rules, "rules");
	processItems(items.hooks, "hooks");

	return states;
}

/**
 * Compute target states (what exists on disk) for registry entries
 */
async function computeTargetStates(
	selectedProviders: ProviderType[],
	global: boolean,
): Promise<Map<string, TargetFileState>> {
	const registry = await readPortableRegistry();
	const relevantEntries = registry.installations.filter((entry) => {
		if (!selectedProviders.includes(entry.provider as ProviderType)) return false;
		if (entry.global !== global) return false;
		return entry.type !== "skill";
	});

	return buildTargetStates(relevantEntries, {
		onReadFailure: (entryPath, error) => {
			// Keep exists=true without checksum so reconciler treats this as unknown,
			// matching dashboard behaviour and avoiding false "deleted" state.
			logger.debug(`[migrate] Failed to read target for checksum: ${entryPath} (${String(error)})`);
		},
	});
}

/**
 * Display install results summary
 */
function displayResults(results: PortableInstallResult[]): void {
	console.log();

	const successful = results.filter((r) => r.success && !r.skipped);
	const skipped = results.filter((r) => r.skipped);
	const failed = results.filter((r) => !r.success);

	if (successful.length > 0) {
		for (const r of successful) {
			p.log.success(`${pc.green("[OK]")} ${r.providerDisplayName}`);
			if (r.warnings) {
				for (const w of r.warnings) {
					p.log.warn(`  ${pc.yellow("[!]")} ${w}`);
				}
			}
		}
	}

	if (skipped.length > 0) {
		for (const r of skipped) {
			p.log.info(
				`${pc.yellow("[i]")} ${r.providerDisplayName}: ${pc.dim(r.skipReason || "Skipped")}`,
			);
		}
	}

	if (failed.length > 0) {
		for (const r of failed) {
			p.log.error(`${pc.red("[X]")} ${r.providerDisplayName}: ${pc.dim(r.error || "Failed")}`);
		}
	}

	console.log();
	const summaryParts = [];
	if (successful.length > 0) summaryParts.push(`${successful.length} installed`);
	if (skipped.length > 0) summaryParts.push(`${skipped.length} skipped`);
	if (failed.length > 0) summaryParts.push(`${failed.length} failed`);

	if (summaryParts.length === 0) {
	} else if (failed.length > 0 && successful.length === 0) {
		process.exit(1);
	}
}

function annotateInstallResults(
	results: PortableInstallResult[],
	portableType: PortableInstallResult["portableType"],
	itemName: string,
): PortableInstallResult[] {
	return results.map((result) => ({
		...result,
		itemName,
		operation: "apply",
		portableType,
	}));
}

function progressLabelForType(type: string): string {
	switch (type) {
		case "agent":
			return "Agents";
		case "command":
			return "Commands";
		case "config":
			return "Config";
		case "rules":
			return "Rules";
		case "hooks":
			return "Hooks";
		case "skill":
			return "Skills";
		default:
			return "Migrating";
	}
}

function buildDryRunFallbackResults(
	skills: SkillInfo[],
	selectedProviders: ProviderType[],
	installGlobally: boolean,
	plannedActions: ReconcileAction[],
): PortableInstallResult[] {
	const plannedSkillActions = plannedActions.filter((action) => action.type === "skill").length;
	if (skills.length === 0 || plannedSkillActions > 0) {
		return [];
	}

	const results: PortableInstallResult[] = [];
	for (const provider of selectedProviders.filter((entry) =>
		getProvidersSupporting("skills").includes(entry),
	)) {
		const basePath = getPortableBasePath(provider, "skills", { global: installGlobally });
		if (!basePath) continue;
		for (const skill of skills) {
			results.push({
				itemName: skill.name,
				operation: "apply",
				path: join(basePath, skill.name),
				portableType: "skill",
				provider,
				providerDisplayName: providers[provider].displayName,
				success: true,
			});
		}
	}

	return results;
}
