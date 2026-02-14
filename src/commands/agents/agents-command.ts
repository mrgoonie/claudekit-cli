/**
 * Agents command — install Claude Code agents to other coding providers
 * Mirrors skills-command.ts architecture with portable installer.
 */
import * as p from "@clack/prompts";
import pc from "picocolors";
import { logger } from "../../shared/logger.js";
import { installPortableItems } from "../portable/portable-installer.js";
import { readPortableRegistry, syncPortableRegistry } from "../portable/portable-registry.js";
import {
	detectInstalledProviders,
	getProvidersSupporting,
	providers,
} from "../portable/provider-registry.js";
import type {
	PortableCommandOptions,
	PortableInstallResult,
	ProviderType,
} from "../portable/types.js";
import { PortableCommandOptionsSchema } from "../portable/types.js";
import { discoverAgents, findAgentByName, getAgentSourcePath } from "./agents-discovery.js";
import {
	forceUninstallAgentFromProvider,
	getInstalledAgents,
	uninstallAgentFromProvider,
} from "./agents-uninstaller.js";

/**
 * List available or installed agents
 */
async function listAgents(showInstalled: boolean): Promise<void> {
	if (showInstalled) {
		const installations = await getInstalledAgents();
		if (installations.length === 0) {
			p.log.warn("No agents installed via ck agents.");
			return;
		}

		console.log();
		p.log.step(pc.bold("Installed Agents"));
		console.log();

		const byItem = new Map<string, typeof installations>();
		for (const inst of installations) {
			const list = byItem.get(inst.item) || [];
			list.push(inst);
			byItem.set(inst.item, list);
		}

		for (const [item, installs] of byItem) {
			console.log(`  ${pc.cyan(item)}`);
			for (const inst of installs) {
				const scope = inst.global ? "global" : "project";
				console.log(`    ${pc.dim("->")} ${inst.provider} (${scope}): ${pc.dim(inst.path)}`);
			}
		}

		console.log();
		console.log(pc.dim(`  ${installations.length} installation(s) across ${byItem.size} agent(s)`));
		console.log();
		return;
	}

	const sourcePath = getAgentSourcePath();
	if (!sourcePath) {
		logger.error("No agents found. Check ~/.claude/agents/ or .claude/agents/");
		process.exit(1);
	}

	const items = await discoverAgents(sourcePath);
	if (items.length === 0) {
		logger.warning("No agent files found in source directory.");
		return;
	}

	console.log();
	p.log.step(pc.bold("Available Agents"));
	console.log();

	for (const item of items) {
		console.log(`  ${pc.cyan(item.name)}`);
		if (item.description) {
			const desc =
				item.description.length > 80 ? `${item.description.slice(0, 77)}...` : item.description;
			console.log(`    ${pc.dim(desc)}`);
		}
	}

	console.log();
	console.log(pc.dim(`  ${items.length} agent(s) available`));
	console.log(pc.dim(`  Source: ${sourcePath}`));
	console.log();
}

/**
 * Handle uninstall flow
 */
async function handleUninstall(options: PortableCommandOptions): Promise<void> {
	if (!options.name) {
		const installations = await getInstalledAgents();
		if (installations.length === 0) {
			p.log.warn("No agents installed via ck agents.");
			return;
		}

		const choices = installations.map((i) => ({
			value: i,
			label: `${i.item} -> ${i.provider}`,
			hint: `${i.global ? "global" : "project"}: ${i.path}`,
		}));

		const selected = await p.multiselect({
			message: "Select agents to uninstall",
			options: choices,
			required: true,
		});

		if (p.isCancel(selected)) {
			p.cancel("Uninstall cancelled");
			return;
		}

		const toUninstall = selected as typeof installations;

		if (!options.yes) {
			const confirmed = await p.confirm({
				message: `Uninstall ${toUninstall.length} agent(s)?`,
			});
			if (p.isCancel(confirmed) || !confirmed) {
				p.cancel("Uninstall cancelled");
				return;
			}
		}

		const spinner = p.spinner();
		spinner.start("Uninstalling...");

		for (const inst of toUninstall) {
			await uninstallAgentFromProvider(inst.item, inst.provider as ProviderType, inst.global);
		}

		spinner.stop("Uninstall complete");
		p.log.success(`Removed ${toUninstall.length} agent(s)`);
		return;
	}

	// Named uninstall
	const trimmedName = options.name.trim();
	if (!trimmedName) {
		p.log.error("Agent name cannot be empty");
		process.exit(1);
	}

	const runForceUninstall = async (): Promise<boolean> => {
		if (!options.agent || options.agent.length === 0) {
			p.log.error("--agent required with --force when agent is not tracked in registry");
			process.exit(1);
		}

		const supportedProviders = getProvidersSupporting("agents");
		const invalidProviders = options.agent.filter(
			(provider) => !supportedProviders.includes(provider as ProviderType),
		);
		if (invalidProviders.length > 0) {
			p.log.error(`Invalid or unsupported providers for agents: ${invalidProviders.join(", ")}`);
			p.log.info(`Supported: ${supportedProviders.join(", ")}`);
			process.exit(1);
		}

		const scope = options.global ?? false;
		const spinner = p.spinner();
		spinner.start("Force uninstalling...");

		const targets = options.agent as ProviderType[];
		const results = await Promise.all(
			targets.map((provider) => forceUninstallAgentFromProvider(trimmedName, provider, scope)),
		);
		const successCount = results.filter((result) => result.success).length;

		spinner.stop("Force uninstall complete");
		for (const result of results) {
			if (result.success) {
				p.log.success(`Removed ${trimmedName} from ${providers[result.provider].displayName}`);
			} else {
				p.log.error(
					`${providers[result.provider].displayName}: ${result.error || "Failed to remove agent"}`,
				);
			}
		}

		if (successCount === 0) {
			process.exit(1);
		}

		return true;
	};

	const registry = await readPortableRegistry();
	const matches = registry.installations.filter(
		(i) => i.type === "agent" && i.item.toLowerCase() === trimmedName.toLowerCase(),
	);

	if (matches.length === 0) {
		if (options.force) {
			await runForceUninstall();
			return;
		}
		p.log.error(`Agent "${trimmedName}" not found in registry.`);
		p.log.info("Use --force with --agent to remove untracked agents.");
		process.exit(1);
	}

	let toRemove = matches;
	if (options.agent && options.agent.length > 0) {
		toRemove = matches.filter((m) => options.agent?.includes(m.provider));
	}
	// Filter by scope if --global is specified
	if (options.global !== undefined) {
		toRemove = toRemove.filter((m) => m.global === options.global);
	}

	if (toRemove.length === 0) {
		if (options.force) {
			await runForceUninstall();
			return;
		}
		p.log.error("No matching installations found with specified filters.");
		process.exit(1);
	}

	console.log();
	p.log.step(pc.bold("Will uninstall:"));
	for (const inst of toRemove) {
		p.log.message(`  ${pc.red("X")} ${inst.item} -> ${inst.provider}: ${pc.dim(inst.path)}`);
	}
	console.log();

	if (!options.yes) {
		const confirmed = await p.confirm({ message: "Proceed?" });
		if (p.isCancel(confirmed) || !confirmed) {
			p.cancel("Uninstall cancelled");
			return;
		}
	}

	const spinner = p.spinner();
	spinner.start("Uninstalling...");

	let successCount = 0;
	for (const inst of toRemove) {
		const result = await uninstallAgentFromProvider(
			inst.item,
			inst.provider as ProviderType,
			inst.global,
		);
		if (result.success) successCount++;
	}

	spinner.stop("Uninstall complete");
	p.log.success(`Removed ${successCount}/${toRemove.length} installation(s)`);
}

/**
 * Main agents command handler
 */
export async function agentsCommand(options: PortableCommandOptions): Promise<void> {
	console.log();
	p.intro(pc.bgCyan(pc.black(" ck agents ")));

	try {
		const validOptions = PortableCommandOptionsSchema.parse(options);

		// Handle sync
		if (validOptions.sync) {
			const spinner = p.spinner();
			spinner.start("Syncing registry...");
			const { removed } = await syncPortableRegistry();
			spinner.stop("Sync complete");
			if (removed.length > 0) {
				const agentRemoved = removed.filter((r) => r.type === "agent");
				p.log.info(`Cleaned ${agentRemoved.length} orphaned agent entries`);
			} else {
				p.log.info("Registry is in sync");
			}
			p.outro(pc.green("Done!"));
			return;
		}

		// Handle uninstall
		if (validOptions.uninstall) {
			await handleUninstall(validOptions);
			p.outro(pc.green("Done!"));
			return;
		}

		// Handle list
		if (validOptions.list) {
			await listAgents(validOptions.installed ?? false);
			p.outro(pc.dim("Use --name <agent> to install a specific agent"));
			return;
		}

		// Check agent source exists
		const sourcePath = getAgentSourcePath();
		if (!sourcePath) {
			p.log.error("No agents found. Check ~/.claude/agents/ or .claude/agents/");
			p.outro(pc.red("Installation failed"));
			process.exit(1);
		}

		// Discover available agents
		const availableItems = await discoverAgents(sourcePath);
		if (availableItems.length === 0) {
			p.log.error("No valid agent files found in source directory.");
			p.outro(pc.red("Installation failed"));
			process.exit(1);
		}

		// Get providers that support agents
		const agentProviders = getProvidersSupporting("agents");
		const detectedProviders = await detectInstalledProviders();
		const relevantProviders = detectedProviders.filter((p) => agentProviders.includes(p));

		// Phase 1: Select agent(s)
		let selectedItems = availableItems;
		if (validOptions.name) {
			const trimmedName = validOptions.name.trim();
			if (!trimmedName) {
				p.log.error("Agent name cannot be empty");
				p.outro(pc.red("Installation failed"));
				process.exit(1);
			}

			const item = await findAgentByName(trimmedName, sourcePath);
			if (!item) {
				p.log.error(`Agent not found: ${trimmedName}`);
				p.log.info("Available agents:");
				for (const a of availableItems) {
					p.log.message(`  - ${a.name}`);
				}
				p.outro(pc.red("Installation failed"));
				process.exit(1);
			}
			selectedItems = [item];
			p.log.info(`Agent: ${pc.cyan(item.name)}`);
			if (item.description) p.log.message(pc.dim(item.description));
		} else if (availableItems.length === 1) {
			selectedItems = [availableItems[0]];
			p.log.info(`Agent: ${pc.cyan(selectedItems[0].name)}`);
		} else if (validOptions.yes) {
			// Non-interactive: install all agents
			selectedItems = availableItems;
			p.log.info(`Installing all ${availableItems.length} agents`);
		} else {
			const choices = availableItems.map((a) => ({
				value: a,
				label: a.name,
				hint:
					a.description && a.description.length > 50
						? `${a.description.slice(0, 47)}...`
						: a.description,
			}));

			const selected = await p.multiselect({
				message: "Select agent(s) to install",
				options: choices,
				required: true,
			});

			if (p.isCancel(selected)) {
				p.cancel("Installation cancelled");
				return;
			}

			selectedItems = selected as typeof availableItems;
			p.log.info(`Selected ${selectedItems.length} agent(s)`);
		}

		// Phase 2: Select providers
		let selectedProviders: ProviderType[];

		if (validOptions.agent && validOptions.agent.length > 0) {
			const invalidProviders = validOptions.agent.filter(
				(a) => !agentProviders.includes(a as ProviderType),
			);
			if (invalidProviders.length > 0) {
				p.log.error(`Invalid or unsupported providers for agents: ${invalidProviders.join(", ")}`);
				p.log.info(`Supported: ${agentProviders.join(", ")}`);
				process.exit(1);
			}
			selectedProviders = validOptions.agent as ProviderType[];
		} else if (validOptions.all) {
			selectedProviders = agentProviders;
			p.log.info(`Installing to all ${agentProviders.length} providers`);
		} else if (relevantProviders.length === 0) {
			if (validOptions.yes) {
				selectedProviders = agentProviders;
				p.log.info("No providers detected, installing to all");
			} else {
				p.log.warn("No providers with agent support detected on your system.");
				const providerChoices = agentProviders.map((key) => ({
					value: key,
					label: providers[key].displayName,
				}));

				const selected = await p.multiselect({
					message: "Select providers to install to",
					options: providerChoices,
					required: true,
				});

				if (p.isCancel(selected)) {
					p.cancel("Installation cancelled");
					return;
				}

				selectedProviders = selected as ProviderType[];
			}
		} else if (relevantProviders.length === 1 || validOptions.yes) {
			selectedProviders = relevantProviders;
			p.log.info(
				`Installing to: ${relevantProviders.map((a) => pc.cyan(providers[a].displayName)).join(", ")}`,
			);
		} else {
			const providerChoices = relevantProviders.map((a) => ({
				value: a,
				label: providers[a].displayName,
			}));

			const selected = await p.multiselect({
				message: "Select providers to install to",
				options: providerChoices,
				required: true,
				initialValues: relevantProviders,
			});

			if (p.isCancel(selected)) {
				p.cancel("Installation cancelled");
				return;
			}

			selectedProviders = selected as ProviderType[];
		}

		// Phase 3: Select scope
		let installGlobally = validOptions.global ?? false;
		if (validOptions.global === undefined && !validOptions.yes) {
			const scope = await p.select({
				message: "Installation scope",
				options: [
					{
						value: false,
						label: "Project",
						hint: "Install in current directory (committed with project)",
					},
					{
						value: true,
						label: "Global",
						hint: "Install in home directory (available across projects)",
					},
				],
			});

			if (p.isCancel(scope)) {
				p.cancel("Installation cancelled");
				return;
			}

			installGlobally = scope as boolean;
		}

		// Phase 4: Summary
		console.log();
		p.log.step(pc.bold("Installation Summary"));

		const itemNames = selectedItems.map((i) => pc.cyan(i.name)).join(", ");
		p.log.message(`  Agents: ${itemNames}`);
		const providerNames = selectedProviders
			.map((prov) => pc.cyan(providers[prov].displayName))
			.join(", ");
		p.log.message(`  Providers: ${providerNames}`);
		p.log.message(`  Scope: ${installGlobally ? "Global" : "Project"}`);
		console.log();

		// Phase 5: Confirm and install
		if (!validOptions.yes) {
			const confirmed = await p.confirm({
				message: `Install ${selectedItems.length} agent(s) to ${selectedProviders.length} provider(s)?`,
			});
			if (p.isCancel(confirmed) || !confirmed) {
				p.cancel("Installation cancelled");
				return;
			}
		}

		const spinner = p.spinner();
		spinner.start(`Installing ${selectedItems.length} agent(s)...`);

		const results = await installPortableItems(selectedItems, selectedProviders, "agent", {
			global: installGlobally,
		});

		spinner.stop("Installation complete");

		// Show results
		displayResults(results);
	} catch (error) {
		logger.error(error instanceof Error ? error.message : "Unknown error");
		p.outro(pc.red("Installation failed"));
		process.exit(1);
	}
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
	const parts = [];
	if (successful.length > 0) parts.push(`${successful.length} installed`);
	if (skipped.length > 0) parts.push(`${skipped.length} skipped`);
	if (failed.length > 0) parts.push(`${failed.length} failed`);

	if (parts.length === 0) {
		p.outro(pc.yellow("No installations performed"));
	} else if (failed.length > 0 && successful.length === 0) {
		p.outro(pc.red("Installation failed"));
		process.exit(1);
	} else {
		p.outro(pc.green(`Done! ${parts.join(", ")}`));
	}
}
