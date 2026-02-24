/**
 * Migrate command — one-shot migration of all agents, commands, skills, config,
 * and rules to target providers. Thin orchestration layer over portable infrastructure.
 */
import { existsSync } from "node:fs";
import { readFile, rm, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { logger } from "../../shared/logger.js";
import { discoverAgents, getAgentSourcePath } from "../agents/agents-discovery.js";
import { discoverCommands, getCommandSourcePath } from "../commands/commands-discovery.js";
import { computeContentChecksum } from "../portable/checksum-utils.js";
import { discoverConfig, discoverRules } from "../portable/config-discovery.js";
import { resolveConflict } from "../portable/conflict-resolver.js";
import { convertItem } from "../portable/converters/index.js";
import { generateDiff } from "../portable/diff-display.js";
import { displayMigrationSummary, displayReconcilePlan } from "../portable/plan-display.js";
import { installPortableItems } from "../portable/portable-installer.js";
import { readPortableRegistry, removePortableInstallation } from "../portable/portable-registry.js";
import {
	detectInstalledProviders,
	getProvidersSupporting,
	providers,
} from "../portable/provider-registry.js";
import type {
	ReconcileAction,
	ReconcileProviderInput,
	SourceItemState,
	TargetFileState,
} from "../portable/reconcile-types.js";
import { reconcile } from "../portable/reconciler.js";
import type { PortableInstallResult, PortableItem, ProviderType } from "../portable/types.js";
import { discoverSkills, getSkillSourcePath } from "../skills/skills-discovery.js";
import { resolveMigrationScope } from "./migrate-scope-resolver.js";
import { installSkillDirectories } from "./skill-directory-installer.js";

/** Options for ck migrate */
export interface MigrateOptions {
	agent?: string[];
	global?: boolean;
	yes?: boolean;
	all?: boolean;
	config?: boolean;
	rules?: boolean;
	skipConfig?: boolean;
	skipRules?: boolean;
	source?: string;
	dryRun?: boolean;
	force?: boolean;
}

/**
 * Map portable item type to provider config path key.
 * Exhaustive switch ensures all types are handled correctly.
 */
function getProviderPathKey(type: string): string {
	switch (type) {
		case "agent":
			return "agents";
		case "command":
			return "commands";
		case "config":
			return "config";
		case "rules":
			return "rules";
		case "skill":
			return "skills";
		default:
			return type;
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
 * Main migrate command handler
 */
export async function migrateCommand(options: MigrateOptions): Promise<void> {
	console.log();
	p.intro(pc.bgMagenta(pc.black(" ck migrate ")));

	try {
		const scope = resolveMigrationScope(process.argv.slice(2), options);

		// Phase 1: Discover all portable items
		const spinner = p.spinner();
		spinner.start("Discovering portable items...");

		const agentSource = scope.agents ? getAgentSourcePath() : null;
		const commandSource = scope.commands ? getCommandSourcePath() : null;
		const skillSource = scope.skills ? getSkillSourcePath() : null;

		const agents = agentSource ? await discoverAgents(agentSource) : [];
		const commands = commandSource ? await discoverCommands(commandSource) : [];
		const skills = skillSource ? await discoverSkills(skillSource) : [];
		const configItem = scope.config ? await discoverConfig(options.source) : null;
		const ruleItems = scope.rules ? await discoverRules() : [];

		spinner.stop("Discovery complete");

		const hasItems =
			agents.length > 0 ||
			commands.length > 0 ||
			skills.length > 0 ||
			configItem !== null ||
			ruleItems.length > 0;

		if (!hasItems) {
			p.log.error("Nothing to migrate.");
			p.log.info(
				pc.dim(
					"Check ~/.claude/agents/, ~/.claude/commands/, ~/.claude/skills/, and ~/.claude/CLAUDE.md",
				),
			);
			p.outro(pc.red("Nothing to migrate"));
			return;
		}

		// Show discovery summary
		const parts: string[] = [];
		if (agents.length > 0) parts.push(`${agents.length} agent(s)`);
		if (commands.length > 0) parts.push(`${commands.length} command(s)`);
		if (skills.length > 0) parts.push(`${skills.length} skill(s)`);
		if (configItem) parts.push("config");
		if (ruleItems.length > 0) parts.push(`${ruleItems.length} rule(s)`);
		p.log.info(`Found: ${parts.join(", ")}`);

		// Phase 2: Select providers
		const detectedProviders = await detectInstalledProviders();
		let selectedProviders: ProviderType[];

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
			// All providers that support at least one type
			const allProviders = new Set<ProviderType>([
				...getProvidersSupporting("agents"),
				...getProvidersSupporting("commands"),
				...getProvidersSupporting("skills"),
				...getProvidersSupporting("config"),
				...getProvidersSupporting("rules"),
			]);
			selectedProviders = Array.from(allProviders);
			p.log.info(`Migrating to all ${selectedProviders.length} providers`);
		} else if (detectedProviders.length === 0) {
			if (options.yes) {
				const allProviders = new Set<ProviderType>([
					...getProvidersSupporting("agents"),
					...getProvidersSupporting("commands"),
					...getProvidersSupporting("skills"),
					...getProvidersSupporting("config"),
					...getProvidersSupporting("rules"),
				]);
				selectedProviders = Array.from(allProviders);
				p.log.info("No providers detected, migrating to all");
			} else {
				p.log.warn("No providers detected on your system.");
				const allProviders = new Set<ProviderType>([
					...getProvidersSupporting("agents"),
					...getProvidersSupporting("commands"),
					...getProvidersSupporting("skills"),
					...getProvidersSupporting("config"),
					...getProvidersSupporting("rules"),
				]);
				const selected = await p.multiselect({
					message: "Select providers to migrate to",
					options: Array.from(allProviders).map((key) => ({
						value: key,
						label: providers[key].displayName,
					})),
					required: true,
				});
				if (p.isCancel(selected)) {
					p.cancel("Migrate cancelled");
					return;
				}
				selectedProviders = selected as ProviderType[];
			}
		} else if (detectedProviders.length === 1 || options.yes) {
			selectedProviders = detectedProviders;
			p.log.info(
				`Migrating to: ${detectedProviders.map((a) => pc.cyan(providers[a].displayName)).join(", ")}`,
			);
		} else {
			const selected = await p.multiselect({
				message: "Select providers to migrate to",
				options: detectedProviders.map((a) => ({
					value: a,
					label: providers[a].displayName,
				})),
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
		let installGlobally = options.global ?? false;
		if (options.global === undefined && !options.yes) {
			const scopeChoice = await p.select({
				message: "Installation scope",
				options: [
					{
						value: false,
						label: "Project",
						hint: "Install in current directory",
					},
					{
						value: true,
						label: "Global",
						hint: "Install in home directory",
					},
				],
			});
			if (p.isCancel(scopeChoice)) {
				p.cancel("Migrate cancelled");
				return;
			}
			installGlobally = scopeChoice as boolean;
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

		// Phase 4: Summary
		console.log();
		p.log.step(pc.bold("Migrate Summary"));
		if (agents.length > 0) {
			p.log.message(`  Agents: ${agents.map((a) => pc.cyan(a.name)).join(", ")}`);
		}
		if (commands.length > 0) {
			const cmdNames = commands.map((c) => pc.cyan(`/${c.displayName || c.name}`)).join(", ");
			p.log.message(`  Commands: ${cmdNames}`);
		}
		if (skills.length > 0) {
			p.log.message(`  Skills: ${skills.map((s) => pc.cyan(s.name)).join(", ")}`);
		}
		if (configItem) {
			const lines = configItem.body.split("\n").length;
			p.log.message(`  Config: ${pc.cyan("CLAUDE.md")} (${lines} lines)`);
		}
		if (ruleItems.length > 0) {
			p.log.message(`  Rules: ${pc.cyan(`${ruleItems.length} file(s)`)}`);
		}
		const providerNames = selectedProviders
			.map((prov) => pc.cyan(providers[prov].displayName))
			.join(", ");
		p.log.message(`  Providers: ${providerNames}`);
		p.log.message(`  Scope: ${installGlobally ? "Global" : "Project"}`);

		// Show unsupported combos
		const cmdProviders = getProvidersSupporting("commands");
		const unsupportedCmd = selectedProviders.filter((pv) => !cmdProviders.includes(pv));
		if (commands.length > 0 && unsupportedCmd.length > 0) {
			p.log.info(
				pc.dim(
					`  [i] Commands skipped for: ${unsupportedCmd.map((pv) => providers[pv].displayName).join(", ")} (unsupported)`,
				),
			);
		}

		// Phase 4: Reconciliation (compute plan before execution)
		const reconcileSpinner = p.spinner();
		reconcileSpinner.start("Computing migration plan...");

		const sourceStates = await computeSourceStates(
			{
				agents,
				commands,
				config: configItem,
				rules: ruleItems,
			},
			selectedProviders,
		);

		const targetStates = await computeTargetStates(selectedProviders, installGlobally);
		const registry = await readPortableRegistry();

		const providerConfigs: ReconcileProviderInput[] = selectedProviders.map((provider) => ({
			provider,
			global: installGlobally,
		}));

		const plan = reconcile({
			sourceItems: sourceStates,
			registry,
			targetStates,
			providerConfigs,
			force: options.force,
		});

		reconcileSpinner.stop("Plan computed");

		// Display plan
		const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
		displayReconcilePlan(plan, { color: useColor });

		// Dry-run: show plan and exit
		if (options.dryRun) {
			console.log();
			p.outro(pc.green("Dry run complete — no files written"));
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
							agents.find((a) => a.name === action.item) ||
							commands.find((c) => c.name === action.item) ||
							(configItem?.name === action.item ? configItem : null) ||
							ruleItems.find((r) => r.name === action.item);

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
			agent: 2,
			command: 3,
			skill: 4,
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

		const installSpinner = p.spinner();
		installSpinner.start("Migrating...");

		const allResults: PortableInstallResult[] = [];
		const installOpts = { global: installGlobally };
		const agentByName = new Map(agents.map((item) => [item.name, item]));
		const commandByName = new Map(commands.map((item) => [item.name, item]));
		const skillByName = new Map(skills.map((item) => [item.name, item]));
		const configByName = new Map(configItem ? [[configItem.name, configItem]] : []);
		const ruleByName = new Map(ruleItems.map((item) => [item.name, item]));

		for (const action of plannedExecActions) {
			const provider = action.provider as ProviderType;
			if (!selectedProviders.includes(provider)) continue;

			if (action.type === "agent") {
				const item = agentByName.get(action.item);
				if (!item || !getProvidersSupporting("agents").includes(provider)) continue;
				allResults.push(...(await installPortableItems([item], [provider], "agent", installOpts)));
				continue;
			}

			if (action.type === "command") {
				const item = commandByName.get(action.item);
				if (!item || !getProvidersSupporting("commands").includes(provider)) continue;
				allResults.push(
					...(await installPortableItems([item], [provider], "command", installOpts)),
				);
				continue;
			}

			if (action.type === "skill") {
				const item = skillByName.get(action.item);
				if (!item || !getProvidersSupporting("skills").includes(provider)) continue;
				allResults.push(...(await installSkillDirectories([item], [provider], installOpts)));
				continue;
			}

			if (action.type === "config") {
				const item = configByName.get(action.item);
				if (!item || !getProvidersSupporting("config").includes(provider)) continue;
				allResults.push(...(await installPortableItems([item], [provider], "config", installOpts)));
				continue;
			}

			if (action.type === "rules") {
				const item = ruleByName.get(action.item);
				if (!item || !getProvidersSupporting("rules").includes(provider)) continue;
				allResults.push(...(await installPortableItems([item], [provider], "rules", installOpts)));
			}
		}

		// Skills are directory-based and not fully represented in current reconcile source states.
		// Preserve existing migration behavior until skills become first-class reconcile actions.
		const plannedSkillActions = plannedExecActions.filter(
			(action) => action.type === "skill",
		).length;
		if (skills.length > 0 && plannedSkillActions === 0) {
			const skillProviders = selectedProviders.filter((pv) =>
				getProvidersSupporting("skills").includes(pv),
			);
			if (skillProviders.length > 0) {
				allResults.push(...(await installSkillDirectories(skills, skillProviders, installOpts)));
			}
		}

		const writtenPaths = new Set(
			allResults
				.filter((result) => result.success && !result.skipped && result.path.length > 0)
				.map((result) => resolve(result.path)),
		);

		for (const deleteAction of plannedDeleteActions) {
			allResults.push(
				await executeDeleteAction(deleteAction, {
					preservePaths: writtenPaths,
				}),
			);
		}

		installSpinner.stop("Migrate complete");

		// Display migration summary with plan context
		displayMigrationSummary(plan, allResults, { color: useColor });

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
					await rollbackResults(successful);
					p.log.info(`Rolled back ${newWrites.length} file(s)`);
				}
			}
		}

		// Show detailed results if there are failures
		if (failed.length > 0) {
			console.log();
			displayResults(allResults);
		} else {
			p.outro(pc.green("Migration complete!"));
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
async function rollbackResults(results: PortableInstallResult[]): Promise<void> {
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
		} catch {
			// Best-effort cleanup — don't fail on rollback errors
		}
	}
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
	},
	selectedProviders: ProviderType[],
): Promise<SourceItemState[]> {
	const states: SourceItemState[] = [];

	// Helper to process items of a given type
	const processItems = async (
		itemList: PortableItem[],
		type: "agent" | "command" | "config" | "rules",
	) => {
		for (const item of itemList) {
			const sourceChecksum = computeContentChecksum(item.body);
			const convertedChecksums: Record<string, string> = {};

			// Compute converted checksum for each provider
			for (const provider of selectedProviders) {
				const providerConfig = providers[provider];
				const pathConfigKey = getProviderPathKey(type);
				const pathConfig = providerConfig[pathConfigKey as keyof typeof providerConfig];

				if (pathConfig && typeof pathConfig === "object" && "format" in pathConfig) {
					const converted = convertItem(item, pathConfig.format, provider);
					if (converted.content) {
						convertedChecksums[provider] = computeContentChecksum(converted.content);
					}
				}
			}

			states.push({
				item: item.name,
				type,
				sourceChecksum,
				convertedChecksums,
			});
		}
	};

	await processItems(items.agents, "agent");
	await processItems(items.commands, "command");
	if (items.config) {
		await processItems([items.config], "config");
	}
	await processItems(items.rules, "rules");

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
	const states = new Map<string, TargetFileState>();

	for (const entry of registry.installations) {
		// Only check entries matching our selected providers and scope
		if (!selectedProviders.includes(entry.provider as ProviderType)) continue;
		if (entry.global !== global) continue;
		// Skills are directory-based — readFile throws EISDIR on directories.
		// Reconciler already excludes skills from orphan detection.
		if (entry.type === "skill") continue;

		const exists = existsSync(entry.path);
		if (!exists) {
			states.set(entry.path, {
				path: entry.path,
				exists: false,
			});
			continue;
		}

		const state: TargetFileState = {
			path: entry.path,
			exists: true,
		};

		try {
			const content = await readFile(entry.path, "utf-8");
			state.currentChecksum = computeContentChecksum(content);
		} catch (error) {
			// Keep exists=true without checksum so reconciler treats this as unknown,
			// matching dashboard behaviour and avoiding false "deleted" state.
			logger.debug(
				`[migrate] Failed to read target for checksum: ${entry.path} (${String(error)})`,
			);
		}

		states.set(entry.path, state);
	}

	return states;
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
		p.outro(pc.yellow("No installations performed"));
	} else if (failed.length > 0 && successful.length === 0) {
		p.outro(pc.red("Migrate failed"));
		process.exit(1);
	} else {
		p.outro(pc.green(`Done! ${summaryParts.join(", ")}`));
	}
}
