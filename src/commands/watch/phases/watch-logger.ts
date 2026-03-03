/**
 * Watch logger — structured file logging for overnight debugging
 * Writes timestamped entries to ~/.claudekit/logs/watch-YYYYMMDD.log
 * Also pipes to console via existing logger singleton
 */

import { type WriteStream, createWriteStream } from "node:fs";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import type { WatchStats } from "../types.js";

export class WatchLogger {
	private logStream: WriteStream | null = null;
	private logDir: string;

	constructor(logDir?: string) {
		this.logDir = logDir ?? join(PathResolver.getClaudeKitDir(), "logs");
	}

	/**
	 * Initialize the log file stream (call once at startup)
	 */
	async init(): Promise<void> {
		try {
			if (!existsSync(this.logDir)) {
				await mkdir(this.logDir, { recursive: true });
			}
			const dateStr = formatDate(new Date());
			const logPath = join(this.logDir, `watch-${dateStr}.log`);
			this.logStream = createWriteStream(logPath, { flags: "a", mode: 0o600 });
		} catch (error) {
			// Fall back to console-only if log dir fails
			logger.warning(
				`Cannot create watch log file: ${error instanceof Error ? error.message : "Unknown"}`,
			);
		}
	}

	info(message: string): void {
		this.write("INFO", message);
		logger.info(message);
	}

	warn(message: string): void {
		this.write("WARN", message);
		logger.warning(message);
	}

	error(message: string, error?: Error): void {
		const full = error ? `${message}: ${error.message}` : message;
		this.write("ERROR", full);
		logger.error(full);
		if (error?.stack) {
			this.write("ERROR", error.stack);
		}
	}

	/**
	 * Print a run summary (called on shutdown)
	 */
	printSummary(stats: WatchStats): void {
		const elapsed = Math.round((Date.now() - stats.startedAt.getTime()) / 1000);
		const summary = [
			"Watch session summary:",
			`  Duration: ${formatElapsed(elapsed)}`,
			`  Issues processed: ${stats.issuesProcessed}`,
			`  Plans created: ${stats.plansCreated}`,
			`  Errors: ${stats.errors}`,
		].join("\n");

		this.write("INFO", summary);
		logger.info(summary);
	}

	/**
	 * Flush and close the log stream
	 */
	close(): void {
		if (this.logStream) {
			try {
				this.logStream.end();
			} catch {
				// Ignore close errors during shutdown
			}
			this.logStream = null;
		}
	}

	private write(level: string, message: string): void {
		if (!this.logStream) return;
		const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
		const sanitized = logger.sanitize(message);
		this.logStream.write(`[${timestamp}] ${level.padEnd(5)} ${sanitized}\n`);
	}
}

function formatDate(d: Date): string {
	return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function formatElapsed(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}
