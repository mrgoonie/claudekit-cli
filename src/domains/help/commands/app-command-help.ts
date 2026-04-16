import type { CommandHelp } from "../help-types.js";

export const appCommandHelp: CommandHelp = {
	name: "app",
	description: "Launch the ClaudeKit Control Center desktop app",
	usage: "ck app [options]",
	examples: [
		{
			command: "ck app",
			description: "Launch the native desktop app, downloading it on first run",
		},
		{
			command: "ck app --web",
			description: "Open the existing web dashboard instead of the desktop app",
		},
	],
	optionGroups: [
		{
			title: "Desktop Actions",
			options: [
				{
					flags: "--web",
					description: "Open the browser dashboard instead of launching the desktop app",
				},
				{
					flags: "--update",
					description: "Re-download and install the latest desktop build before launch",
				},
				{
					flags: "--path",
					description: "Print the installed path, or the target install path if absent",
				},
				{
					flags: "--uninstall",
					description: "Remove the installed desktop app and exit",
				},
			],
		},
	],
	sections: [
		{
			title: "Notes",
			content:
				"`ck app` uses the Phase 3 desktop distribution manifest (`desktop-manifest.json`) and platform install helpers. Use `ck config` when you need web-only dashboard flags such as `--host` or `--port`.",
		},
	],
};
