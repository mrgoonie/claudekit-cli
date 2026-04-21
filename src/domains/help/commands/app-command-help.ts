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
					description: "Install a newer desktop build before launch when one is available",
				},
				{
					flags: "--path",
					description: "Print the installed path, or the target install path if absent",
				},
				{
					flags: "--uninstall",
					description: "Remove the installed desktop app and exit",
				},
				{
					flags: "--dev",
					description: "Force dev channel for this invocation",
				},
				{
					flags: "--stable",
					description: "Force stable channel for this invocation",
				},
			],
		},
	],
	sections: [
		{
			title: "Notes",
			content:
				"`ck app` downloads the desktop app build for your platform when needed, then launches it. Use `ck config` when you need web-only dashboard flags such as `--host` or `--port`.",
		},
	],
};
