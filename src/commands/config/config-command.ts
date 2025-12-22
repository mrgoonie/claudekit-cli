import { editConfig } from "./subcommands/edit.js";
import { getConfig } from "./subcommands/get.js";
import { previewConfig } from "./subcommands/preview.js";
import { resetConfig } from "./subcommands/reset.js";
import { showSchema } from "./subcommands/schema.js";
import { setConfig } from "./subcommands/set.js";
import { showConfig } from "./subcommands/show.js";
import { launchDashboard } from "./subcommands/ui/server.js";
import { unsetConfig } from "./subcommands/unset.js";
import { validateConfig } from "./subcommands/validate.js";

export type ConfigSubcommand =
	| "show"
	| "get"
	| "set"
	| "unset"
	| "reset"
	| "schema"
	| "validate"
	| "preview"
	| "edit"
	| "ui";

export interface ConfigCommandOptions {
	subcommand: ConfigSubcommand;
	args: string[];
	global?: boolean;
	json?: boolean;
	yes?: boolean;
}

export async function configCommand(options: ConfigCommandOptions): Promise<void> {
	switch (options.subcommand) {
		case "show":
			await showConfig({ global: options.global, json: options.json });
			break;
		case "get":
			await getConfig(options.args[0], { global: options.global });
			break;
		case "set":
			await setConfig(options.args[0], options.args[1], { global: options.global });
			break;
		case "unset":
			await unsetConfig(options.args[0], { global: options.global });
			break;
		case "reset":
			await resetConfig({
				section: options.args[0],
				global: options.global,
				yes: options.yes,
			});
			break;
		case "schema":
			showSchema({ json: options.json });
			break;
		case "validate":
			await validateConfig({ global: options.global });
			break;
		case "preview":
			await previewConfig({ json: options.json });
			break;
		case "edit":
			await editConfig({ global: options.global });
			break;
		case "ui":
			await launchDashboard({ open: true });
			break;
	}
}
