import ora, { type Ora, type Options } from "ora";

/**
 * Create a spinner with simple ASCII characters to avoid unicode rendering issues
 */
export function createSpinner(options: string | Options): Ora {
	const spinnerOptions: Options = typeof options === "string" ? { text: options } : options;

	const spinner = ora({
		...spinnerOptions,
		// Use simple ASCII spinner instead of unicode
		spinner: "dots",
		// Override symbols to use ASCII
		prefixText: "",
	});

	// Override succeed and fail methods to use ASCII symbols
	spinner.succeed = (text?: string) => {
		spinner.stopAndPersist({
			symbol: "[+]",
			text: text || spinner.text,
		});
		return spinner;
	};

	spinner.fail = (text?: string) => {
		spinner.stopAndPersist({
			symbol: "[x]",
			text: text || spinner.text,
		});
		return spinner;
	};

	return spinner;
}

// Re-export Ora type for convenience
export type { Ora } from "ora";
