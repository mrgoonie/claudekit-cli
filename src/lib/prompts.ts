import * as clack from "@clack/prompts";
import { AVAILABLE_KITS, type KitType } from "../types.js";
import { intro, note, outro } from "../utils/safe-prompts.js";

export class PromptsManager {
	/**
	 * Prompt user to select a kit
	 */
	async selectKit(defaultKit?: KitType): Promise<KitType> {
		const kit = await clack.select({
			message: "Select a ClaudeKit:",
			options: Object.entries(AVAILABLE_KITS).map(([key, config]) => ({
				value: key as KitType,
				label: config.name,
				hint: config.description,
			})),
			initialValue: defaultKit,
		});

		if (clack.isCancel(kit)) {
			throw new Error("Kit selection cancelled");
		}

		return kit as KitType;
	}

	/**
	 * Prompt user to select a version
	 */
	async selectVersion(versions: string[], defaultVersion?: string): Promise<string> {
		if (versions.length === 0) {
			throw new Error("No versions available");
		}

		// If only one version or default is latest, return first version
		if (versions.length === 1 || !defaultVersion) {
			return versions[0];
		}

		const version = await clack.select({
			message: "Select a version:",
			options: versions.map((v) => ({
				value: v,
				label: v,
			})),
			initialValue: defaultVersion,
		});

		if (clack.isCancel(version)) {
			throw new Error("Version selection cancelled");
		}

		return version as string;
	}

	/**
	 * Prompt user for target directory
	 */
	async getDirectory(defaultDir = "."): Promise<string> {
		const dir = await clack.text({
			message: "Enter target directory:",
			placeholder: defaultDir,
			defaultValue: defaultDir,
			validate: (value) => {
				if (!value || value.trim().length === 0) {
					return "Directory path is required";
				}
				return;
			},
		});

		if (clack.isCancel(dir)) {
			throw new Error("Directory input cancelled");
		}

		return dir.trim();
	}

	/**
	 * Confirm action
	 */
	async confirm(message: string): Promise<boolean> {
		const result = await clack.confirm({
			message,
		});

		if (clack.isCancel(result)) {
			return false;
		}

		return result;
	}

	/**
	 * Show intro message
	 */
	intro(message: string): void {
		intro(message);
	}

	/**
	 * Show outro message
	 */
	outro(message: string): void {
		outro(message);
	}

	/**
	 * Show note
	 */
	note(message: string, title?: string): void {
		note(message, title);
	}
}
