/**
 * Commands command — install Claude Code commands to other coding providers
 * Only 4 providers support commands: Claude Code, OpenCode, Codex, Gemini CLI
 * Unsupported providers are warned and skipped.
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
import { discoverCommands, findCommandByName, getCommandSourcePath } from "./commands-discovery.js";
import {
	forceUninstallCommandFromProvider,
	getInstalledCommands,
	uninstallCommandFromProvider,
} from "./commands-uninstaller.js";

/**
 * List available or installed commands
 */
async function listCommands(showInstalled: boolean): Promise<void> {
	if (showInstalled) {
		const installations = await getInstalledCommands();
		if (installations.length === 0) {
			p.log.warn("No commands installed via ck commands.");
			return;
		}

		console.log();
		p.log.step(pc.bold("Installed Commands"));
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
		console.log(
			pc.dim(`  ${installations.length} installation(s) across ${byItem.size} command(s)`),
		);
		console.log();
		return;
	}

	const sourcePath = getCommandSourcePath();
	if (!sourcePath) {
		logger.error("No commands found. Check ~/.claude/commands/ or .claude/commands/");
		process.exit(1);
	}

	const items = await discoverCommands(sourcePath);
	if (items.length === 0) {
		logger.warning("No command files found in source directory.");
		return;
	}

	console.log();
	p.log.step(pc.bold("Available Commands"));
	console.log();

	for (const item of items) {
		const label = item.displayName || item.name;
		console.log(`  ${pc.cyan(`/${label}`)}`);
		if (item.description) {
			const desc =
				item.description.length > 80 ? `${item.description.slice(0, 77)}...` : item.description;
			console.log(`    ${pc.dim(desc)}`);
		}
	}

	console.log();
	console.log(pc.dim(`  ${items.length} command(s) available`));
	console.log(pc.dim(`  Source: ${sourcePath}`));
	console.log();
}

/**
 * Handle uninstall flow
 */
async function handleUninstall(options: PortableCommandOptions): Promise<void> {
	if (!options.name) {
		const installations = await getInstalledCommands();
		if (installations.length === 0) {
			p.log.warn("No commands installed via ck commands.");
			return;
		}

		const choices = installations.map((i) => ({
			value: i,
			label: `${i.item} -> ${i.provider}`,
			hint: `${i.global ? "global" : "project"}: ${i.path}`,
		}));

		const selected = await p.multiselect({
			message: "Select commands to uninstall",
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
				message: `Uninstall ${toUninstall.length} command(s)?`,
			});
			if (p.isCancel(confirmed) || !confirmed) {
				p.cancel("Uninstall cancelled");
				return;
			}
		}

		const spinner = p.spinner();
		spinner.start("Uninstalling...");

		for (const inst of toUninstall) {
			await uninstallCommandFromProvider(inst.item, inst.provider as ProviderType, inst.global);
		}

		spinner.stop("Uninstall complete");
		p.log.success(`Removed ${toUninstall.length} command(s)`);
		return;
	}

	// Named uninstall
	const trimmedName = options.name.trim();
	if (!trimmedName) {
		p.log.error("Command name cannot be empty");
		process.exit(1);
	}

	const runForceUninstall = async (): Promise<boolean> => {
		if (!options.agent || options.agent.length === 0) {
			p.log.error("--agent required with --force when command is not tracked in registry");
			process.exit(1);
		}

		const supportedProviders = getProvidersSupporting("commands");
		const invalidProviders = options.agent.filter(
			(provider) => !supportedProviders.includes(provider as ProviderType),
		);
		if (invalidProviders.length > 0) {
			p.log.error(`Invalid or unsupported providers for commands: ${invalidProviders.join(", ")}`);
			p.log.info(`Supported: ${supportedProviders.join(", ")}`);
			process.exit(1);
		}

		const spinner = p.spinner();
		spinner.start("Force uninstalling...");

		const targets = options.agent as ProviderType[];
		const results = await Promise.all(
			targets.map((provider) =>
				forceUninstallCommandFromProvider(
					trimmedName,
					provider,
					options.global ?? provider === "codex",
				),
			),
		);
		const successCount = results.filter((result) => result.success).length;

		spinner.stop("Force uninstall complete");
		for (const result of results) {
			if (result.success) {
				p.log.success(`Removed ${trimmedName} from ${providers[result.provider].displayName}`);
			} else {
				p.log.error(
					`${providers[result.provider].displayName}: ${result.error || "Failed to remove command"}`,
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
		(i) => i.type === "command" && i.item.toLowerCase() === trimmedName.toLowerCase(),
	);

	if (matches.length === 0) {
		if (options.force) {
			await runForceUninstall();
			return;
		}
		p.log.error(`Command "${trimmedName}" not found in registry.`);
		p.log.info("Use --force with --agent to remove untracked commands.");
		process.exit(1);
	}

	let toRemove = matches;
	if (options.agent && options.agent.length > 0) {
		toRemove = matches.filter((m) => options.agent?.includes(m.provider));
	}
	// Apply scope filter when --global is explicitly set
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
		const result = await uninstallCommandFromProvider(
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
 * Main commands command handler
 */
export async function commandsCommand(options: PortableCommandOptions): Promise<void> {
	console.log();
	p.intro(pc.bgCyan(pc.black(" ck commands ")));

	try {
		const validOptions = PortableCommandOptionsSchema.parse(options);

		// Handle sync
		if (validOptions.sync) {
			const spinner = p.spinner();
			spinner.start("Syncing registry...");
			const { removed } = await syncPortableRegistry();
			spinner.stop("Sync complete");
			if (removed.length > 0) {
				const cmdRemoved = removed.filter((r) => r.type === "command");
				p.log.info(`Cleaned ${cmdRemoved.length} orphaned command entries`);
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
			await listCommands(validOptions.installed ?? false);
			p.outro(pc.dim("Use --name <command> to install a specific command"));
			return;
		}

		// Check command source exists
		const sourcePath = getCommandSourcePath();
		if (!sourcePath) {
			p.log.error("No commands found. Check ~/.claude/commands/ or .claude/commands/");
			p.outro(pc.red("Installation failed"));
			process.exit(1);
		}

		// Discover available commands
		const availableItems = await discoverCommands(sourcePath);
		if (availableItems.length === 0) {
			p.log.error("No valid command files found in source directory.");
			p.outro(pc.red("Installation failed"));
			process.exit(1);
		}

		// Get providers that support commands (only 4: claude-code, opencode, codex, gemini-cli)
		const cmdProviders = getProvidersSupporting("commands");
		const detectedProviders = await detectInstalledProviders();
		const relevantProviders = detectedProviders.filter((prov) => cmdProviders.includes(prov));

		// Phase 1: Select command(s)
		let selectedItems = availableItems;
		if (validOptions.name) {
			const trimmedName = validOptions.name.trim();
			if (!trimmedName) {
				p.log.error("Command name cannot be empty");
				p.outro(pc.red("Installation failed"));
				process.exit(1);
			}

			const item = await findCommandByName(trimmedName, sourcePath);
			if (!item) {
				p.log.error(`Command not found: ${trimmedName}`);
				p.log.info("Available commands:");
				for (const c of availableItems) {
					p.log.message(`  - ${c.displayName || c.name}`);
				}
				p.outro(pc.red("Installation failed"));
				process.exit(1);
			}
			selectedItems = [item];
			p.log.info(`Command: ${pc.cyan(`/${item.displayName || item.name}`)}`);
		} else if (availableItems.length === 1) {
			selectedItems = [availableItems[0]];
			p.log.info(
				`Command: ${pc.cyan(`/${selectedItems[0].displayName || selectedItems[0].name}`)}`,
			);
		} else if (validOptions.yes) {
			selectedItems = availableItems;
			p.log.info(`Installing all ${availableItems.length} commands`);
		} else {
			const choices = availableItems.map((c) => ({
				value: c,
				label: `/${c.displayName || c.name}`,
				hint:
					c.description && c.description.length > 50
						? `${c.description.slice(0, 47)}...`
						: c.description,
			}));

			const selected = await p.multiselect({
				message: "Select command(s) to install",
				options: choices,
				required: true,
			});

			if (p.isCancel(selected)) {
				p.cancel("Installation cancelled");
				return;
			}

			selectedItems = selected as typeof availableItems;
			p.log.info(`Selected ${selectedItems.length} command(s)`);
		}

		// Phase 2: Select providers
		let selectedProviders: ProviderType[];

		// Show info about limited command support
		p.log.info(
			pc.dim(
				`Commands supported by: ${cmdProviders.map((prov) => providers[prov].displayName).join(", ")}`,
			),
		);

		if (validOptions.agent && validOptions.agent.length > 0) {
			// Warn about unsupported providers
			const unsupported = validOptions.agent.filter(
				(a) => !cmdProviders.includes(a as ProviderType),
			);
			if (unsupported.length > 0) {
				p.log.warn(`Skipping providers without command support: ${unsupported.join(", ")}`);
			}
			selectedProviders = validOptions.agent.filter((a) =>
				cmdProviders.includes(a as ProviderType),
			) as ProviderType[];
			if (selectedProviders.length === 0) {
				p.log.error("None of the specified providers support commands.");
				process.exit(1);
			}
		} else if (validOptions.all) {
			selectedProviders = cmdProviders;
			p.log.info(`Installing to all ${cmdProviders.length} providers with command support`);
		} else if (relevantProviders.length === 0) {
			if (validOptions.yes) {
				selectedProviders = cmdProviders;
				p.log.info("No command-capable providers detected, installing to all");
			} else {
				p.log.warn("No providers with command support detected on your system.");
				const providerChoices = cmdProviders.map((key) => ({
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

		if (selectedProviders.includes("codex") && !installGlobally) {
			installGlobally = true;
			p.log.warn(
				pc.yellow(
					"[!] Codex commands are global-only (~/.codex/prompts/). Scope forced to Global.",
				),
			);
		}

		// Phase 4: Summary
		console.log();
		p.log.step(pc.bold("Installation Summary"));

		const itemNames = selectedItems.map((i) => pc.cyan(`/${i.displayName || i.name}`)).join(", ");
		p.log.message(`  Commands: ${itemNames}`);
		const providerNames = selectedProviders
			.map((prov) => pc.cyan(providers[prov].displayName))
			.join(", ");
		p.log.message(`  Providers: ${providerNames}`);
		p.log.message(`  Scope: ${installGlobally ? "Global" : "Project"}`);
		console.log();

		// Phase 5: Confirm and install
		if (!validOptions.yes) {
			const confirmed = await p.confirm({
				message: `Install ${selectedItems.length} command(s) to ${selectedProviders.length} provider(s)?`,
			});
			if (p.isCancel(confirmed) || !confirmed) {
				p.cancel("Installation cancelled");
				return;
			}
		}

		const spinner = p.spinner();
		spinner.start(`Installing ${selectedItems.length} command(s)...`);

		const results = await installPortableItems(selectedItems, selectedProviders, "command", {
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
