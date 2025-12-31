import ora, { type Ora, type Options } from "ora";
import pc from "picocolors";
import { output } from "./output-manager.js";

/**
 * Custom ASCII spinner frames for legacy terminals
 */
const ASCII_SPINNER = {
	interval: 100,
	frames: ["-", "\\", "|", "/"],
};

/**
 * Unicode spinner frames for modern terminals
 */
const UNICODE_SPINNER = {
	interval: 80,
	frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
};

/**
 * Create a spinner with terminal-aware symbols
 * Uses Unicode on modern terminals, ASCII on legacy terminals
 * Hidden in JSON mode or non-TTY environments
 */
export function createSpinner(options: string | Options): Ora {
	const spinnerOptions: Options = typeof options === "string" ? { text: options } : options;
	const symbols = output.getSymbols();
	const shouldShow = output.shouldShowProgress();

	// Determine spinner type based on terminal capabilities
	const spinnerType =
		symbols === output.getSymbols() && symbols.success === "✓" ? UNICODE_SPINNER : ASCII_SPINNER;

	const spinner = ora({
		...spinnerOptions,
		spinner: spinnerType,
		prefixText: "",
		// Disable spinner in JSON mode or non-TTY
		isSilent: !shouldShow,
	});

	// Override succeed and fail methods to use terminal-aware symbols
	spinner.succeed = (text?: string) => {
		if (output.isJson()) {
			spinner.stop();
			output.addJsonEntry({ type: "success", message: text || spinner.text });
			return spinner;
		}
		spinner.stopAndPersist({
			symbol: pc.green(symbols.success),
			text: text || spinner.text,
		});
		return spinner;
	};

	spinner.fail = (text?: string) => {
		if (output.isJson()) {
			spinner.stop();
			output.addJsonEntry({ type: "error", message: text || spinner.text });
			return spinner;
		}
		spinner.stopAndPersist({
			symbol: pc.red(symbols.error),
			text: text || spinner.text,
		});
		return spinner;
	};

	return spinner;
}

// Re-export Ora type for convenience
export type { Ora } from "ora";
