import pc from "picocolors";
import { isTTY, supportsUnicode } from "./terminal-utils.js";

/**
 * Output configuration for verbosity and format control
 */
export interface OutputConfig {
	verbose: boolean;
	json: boolean;
	quiet: boolean;
}

/**
 * Symbol sets for Unicode and ASCII terminals
 * Based on issue #210 specification
 */
export const SYMBOLS = {
	unicode: {
		prompt: "◇",
		success: "✓",
		error: "✗",
		warning: "⚠",
		info: "ℹ",
		line: "│",
		selected: "●",
		unselected: "○",
		pointer: ">",
	},
	ascii: {
		prompt: "?",
		success: "+",
		error: "x",
		warning: "!",
		info: "i",
		line: "|",
		selected: ">",
		unselected: " ",
		pointer: ">",
	},
} as const;

export type SymbolSet = (typeof SYMBOLS)["unicode"] | (typeof SYMBOLS)["ascii"];

/**
 * JSON output entry for machine-readable output
 */
export interface JsonOutputEntry {
	type: "success" | "error" | "warning" | "info" | "progress" | "result";
	message?: string;
	data?: Record<string, unknown>;
	timestamp: string;
}

/**
 * Centralized output manager for consistent CLI output
 *
 * Features:
 * - Unicode/ASCII symbol switching based on terminal capabilities
 * - Verbosity levels (quiet, default, verbose)
 * - JSON output mode for machine-readable output
 * - TTY-aware progress/spinner visibility
 */
class OutputManager {
	private config: OutputConfig = {
		verbose: false,
		json: false,
		quiet: false,
	};
	private jsonBuffer: JsonOutputEntry[] = [];
	private unicodeSupported: boolean;
	private flushPromise: Promise<void> | null = null; // Async mutex for JSON flush

	constructor() {
		this.unicodeSupported = supportsUnicode();
	}

	/**
	 * Configure output options
	 */
	configure(config: Partial<OutputConfig>): void {
		this.config = { ...this.config, ...config };
	}

	/**
	 * Get current configuration
	 */
	getConfig(): OutputConfig {
		return { ...this.config };
	}

	/**
	 * Check if verbose mode is enabled
	 */
	isVerbose(): boolean {
		return this.config.verbose;
	}

	/**
	 * Check if JSON mode is enabled
	 */
	isJson(): boolean {
		return this.config.json;
	}

	/**
	 * Check if quiet mode is enabled
	 */
	isQuiet(): boolean {
		return this.config.quiet;
	}

	/**
	 * Get appropriate symbol set based on terminal capabilities
	 */
	getSymbols(): SymbolSet {
		return this.unicodeSupported ? SYMBOLS.unicode : SYMBOLS.ascii;
	}

	/**
	 * Check if progress indicators should be shown
	 * Hidden in JSON mode or non-TTY environments
	 */
	shouldShowProgress(): boolean {
		if (this.config.json) return false;
		if (!isTTY()) return false;
		return true;
	}

	/**
	 * Output success message
	 */
	success(message: string, data?: Record<string, unknown>): void {
		if (this.config.json) {
			this.addJsonEntry({ type: "success", message, data });
			return;
		}
		if (this.config.quiet) return;
		const symbol = this.getSymbols().success;
		console.log(pc.green(`${symbol} ${message}`));
	}

	/**
	 * Output error message
	 */
	error(message: string, data?: Record<string, unknown>): void {
		if (this.config.json) {
			this.addJsonEntry({ type: "error", message, data });
			return;
		}
		const symbol = this.getSymbols().error;
		console.error(pc.red(`${symbol} ${message}`));
	}

	/**
	 * Output warning message
	 */
	warning(message: string, data?: Record<string, unknown>): void {
		if (this.config.json) {
			this.addJsonEntry({ type: "warning", message, data });
			return;
		}
		if (this.config.quiet) return;
		const symbol = this.getSymbols().warning;
		console.log(pc.yellow(`${symbol} ${message}`));
	}

	/**
	 * Output info message
	 */
	info(message: string, data?: Record<string, unknown>): void {
		if (this.config.json) {
			this.addJsonEntry({ type: "info", message, data });
			return;
		}
		if (this.config.quiet) return;
		const symbol = this.getSymbols().info;
		console.log(pc.blue(`${symbol} ${message}`));
	}

	/**
	 * Output verbose message (only in verbose mode)
	 */
	verbose(message: string, data?: Record<string, unknown>): void {
		if (!this.config.verbose) return;
		if (this.config.json) {
			this.addJsonEntry({ type: "info", message, data });
			return;
		}
		console.log(pc.dim(`  ${message}`));
	}

	/**
	 * Output indented message (for sub-items)
	 */
	indent(message: string): void {
		if (this.config.json) return;
		if (this.config.quiet) return;
		console.log(`  ${message}`);
	}

	/**
	 * Output a blank line
	 */
	newline(): void {
		if (this.config.json) return;
		if (this.config.quiet) return;
		console.log();
	}

	/**
	 * Output a section header for visual grouping
	 */
	section(title: string): void {
		if (this.config.json) {
			this.addJsonEntry({ type: "info", message: `[Section] ${title}` });
			return;
		}
		if (this.config.quiet) return;
		const symbols = this.getSymbols();
		console.log();
		console.log(pc.bold(pc.cyan(`${symbols.line} ${title}`)));
	}

	/**
	 * Add entry to JSON buffer (auto-flushes at 1000 entries to prevent memory issues)
	 */
	addJsonEntry(entry: Omit<JsonOutputEntry, "timestamp">): void {
		this.jsonBuffer.push({
			...entry,
			timestamp: new Date().toISOString(),
		});

		// Auto-flush if buffer gets too large (deferred to prevent recursion)
		if (this.jsonBuffer.length >= 1000 && !this.flushPromise) {
			queueMicrotask(() => this.flushJson());
		}
	}

	/**
	 * Add result data to JSON buffer
	 */
	addJsonResult(data: Record<string, unknown>): void {
		this.addJsonEntry({ type: "result", data });
	}

	/**
	 * Flush JSON buffer to stdout and clear (async mutex prevents race conditions)
	 */
	async flushJson(): Promise<void> {
		if (this.jsonBuffer.length === 0) return;
		if (this.flushPromise) return this.flushPromise;

		this.flushPromise = (async () => {
			// Copy and clear buffer atomically
			const bufferCopy = [...this.jsonBuffer];
			this.jsonBuffer = [];
			console.log(JSON.stringify(bufferCopy, null, 2));
		})().finally(() => {
			this.flushPromise = null;
		});

		return this.flushPromise;
	}

	/**
	 * Get JSON buffer without flushing (for testing)
	 */
	getJsonBuffer(): JsonOutputEntry[] {
		return [...this.jsonBuffer];
	}

	/**
	 * Clear JSON buffer
	 */
	clearJsonBuffer(): void {
		this.jsonBuffer = [];
	}

	/**
	 * Reset to default configuration
	 */
	reset(): void {
		this.config = { verbose: false, json: false, quiet: false };
		this.jsonBuffer = [];
		this.flushPromise = null;
		this.unicodeSupported = supportsUnicode();
	}
}

/**
 * Singleton output manager instance
 */
export const output = new OutputManager();
