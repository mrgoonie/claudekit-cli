import pc from "picocolors";
import { output } from "./output-manager.js";
import { isTTY, supportsUnicode } from "./terminal-utils.js";

/**
 * Progress bar options
 */
export interface ProgressBarOptions {
	total: number;
	width?: number;
	format?: "download" | "percentage" | "count";
	label?: string;
	showEta?: boolean;
}

/**
 * Bar characters for different terminal capabilities
 */
const BAR_CHARS = {
	unicode: { filled: "█", empty: "░" },
	ascii: { filled: "=", empty: "-" },
} as const;

/**
 * Progress bar constants
 */
const RENDER_RATE_LIMIT_MS = 100; // Max 10 updates/sec to prevent flicker
const JSON_MILESTONE_INTERVAL = 25; // Log progress at 25%, 50%, 75%, 100%
const MIN_ELAPSED_SECONDS = 0.1; // Min elapsed time for ETA calculation (avoid div/0)
const MAX_LABEL_WIDTH = 14; // Max visible label width (16 total - 2 leading spaces)

/**
 * TTY-aware progress bar component
 *
 * Features:
 * - Unicode/ASCII bar characters based on terminal capabilities
 * - Hidden in JSON mode or non-TTY environments
 * - Size formatting for downloads (KB, MB, GB)
 * - ETA calculation
 */
export class ProgressBar {
	private current = 0;
	private total: number;
	private label: string;
	private width: number;
	private format: "download" | "percentage" | "count";
	private showEta: boolean;
	private startTime: number;
	private lastRenderTime = 0;
	private lastRenderContent = "";
	private isCompleted = false;

	constructor(options: ProgressBarOptions) {
		this.total = options.total;
		this.label = options.label || "";
		this.width = options.width || 20;
		this.format = options.format || "percentage";
		this.showEta = options.showEta ?? false;
		this.startTime = Date.now();
	}

	/**
	 * Update progress to a specific value
	 */
	update(current: number): void {
		if (this.isCompleted) return; // Ignore updates after completion
		this.current = Math.min(current, this.total);
		this.render();
	}

	/**
	 * Increment progress by delta
	 */
	increment(delta = 1): void {
		this.update(this.current + delta);
	}

	/**
	 * Mark progress as complete
	 */
	complete(message?: string): void {
		if (this.isCompleted) return;
		this.isCompleted = true;
		this.current = this.total;

		if (output.isJson()) {
			output.addJsonEntry({
				type: "progress",
				message: message || `${this.label} complete`,
				data: { current: this.current, total: this.total, percent: 100 },
			});
			return;
		}

		if (!this.shouldRender()) {
			// Non-TTY: just print completion
			console.log(message || `${this.label} complete`);
			return;
		}

		// Clear the progress line and print completion
		this.clearLine();
		if (message) {
			const symbols = output.getSymbols();
			console.log(`${pc.green(symbols.success)} ${message}`);
		}
	}

	/**
	 * Clear the current line (TTY only)
	 */
	private clearLine(): void {
		if (isTTY()) {
			process.stdout.write("\r\x1b[K");
		}
	}

	/**
	 * Check if progress should be rendered
	 */
	private shouldRender(): boolean {
		if (output.isJson()) return false;
		if (!isTTY()) return false;
		return true;
	}

	/**
	 * Render the progress bar
	 */
	private render(): void {
		// Rate limit rendering to avoid flicker
		const now = Date.now();
		if (now - this.lastRenderTime < RENDER_RATE_LIMIT_MS && this.current < this.total) {
			return;
		}
		this.lastRenderTime = now;

		if (output.isJson()) {
			// In JSON mode, only log at certain milestones
			const percent = Math.floor((this.current / this.total) * 100);
			if (percent % JSON_MILESTONE_INTERVAL === 0 || this.current === this.total) {
				output.addJsonEntry({
					type: "progress",
					data: { current: this.current, total: this.total, percent },
				});
			}
			return;
		}

		if (!this.shouldRender()) {
			// Non-TTY: print progress at milestones
			const percent = Math.floor((this.current / this.total) * 100);
			if (percent % JSON_MILESTONE_INTERVAL === 0 && this.lastRenderContent !== `${percent}%`) {
				this.lastRenderContent = `${percent}%`;
				console.log(`  ${this.label} ${this.formatProgress()}`);
			}
			return;
		}

		// TTY: render progress bar inline
		const content = this.formatBar();
		process.stdout.write(`\r${content}`);
	}

	/**
	 * Format the progress bar string
	 */
	private formatBar(): string {
		const chars = this.getBarCharacters();
		const percent = this.total > 0 ? this.current / this.total : 0;
		const filledCount = Math.round(percent * this.width);
		const emptyCount = this.width - filledCount;

		const bar = chars.filled.repeat(filledCount) + chars.empty.repeat(emptyCount);
		const progress = this.formatProgress();

		// Truncate long labels with ellipsis (consistent width: 2 leading spaces + 14 chars)
		const displayLabel =
			this.label.length > MAX_LABEL_WIDTH
				? `${this.label.slice(0, MAX_LABEL_WIDTH - 3)}...`
				: this.label;
		let line = `  ${displayLabel}`.padEnd(16);
		line += `[${bar}] ${progress}`;

		if (this.showEta && this.current > 0 && this.current < this.total) {
			const elapsed = Math.max((Date.now() - this.startTime) / 1000, MIN_ELAPSED_SECONDS);
			const rate = this.current / elapsed;
			const remaining = (this.total - this.current) / rate;
			line += ` ETA: ${this.formatTime(remaining)}`;
		}

		return line;
	}

	/**
	 * Format progress value based on format type
	 */
	private formatProgress(): string {
		switch (this.format) {
			case "download":
				return `${this.formatSize(this.current)} / ${this.formatSize(this.total)}`;
			case "count":
				return `${this.current}/${this.total}`;
			default: {
				const percent = this.total > 0 ? Math.round((this.current / this.total) * 100) : 0;
				return `${percent}%`;
			}
		}
	}

	/**
	 * Format bytes as human-readable size
	 */
	private formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
	}

	/**
	 * Format seconds as human-readable time
	 */
	private formatTime(seconds: number): string {
		if (seconds < 60) return `${Math.round(seconds)}s`;
		const mins = Math.floor(seconds / 60);
		const secs = Math.round(seconds % 60);
		return `${mins}m${secs}s`;
	}

	/**
	 * Get appropriate bar characters based on terminal capabilities
	 */
	private getBarCharacters(): { filled: string; empty: string } {
		return supportsUnicode() ? BAR_CHARS.unicode : BAR_CHARS.ascii;
	}
}

/**
 * Create a progress bar with sensible defaults
 */
export function createProgressBar(options: ProgressBarOptions): ProgressBar {
	return new ProgressBar(options);
}
