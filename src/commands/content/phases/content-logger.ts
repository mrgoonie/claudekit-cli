/**
 * Daily-rotating file logger for the content daemon.
 * Writes to ~/.claudekit/logs/content-YYYYMMDD.log and also
 * echoes through the shared logger singleton for console output.
 */

import { type WriteStream, createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";

export class ContentLogger {
	private stream: WriteStream | null = null;
	private currentDate = "";
	private logDir: string;
	/** Max bytes per log file before size-based rotation (0 = disabled) */
	private maxBytes: number;

	constructor(maxBytes = 0) {
		this.logDir = join(homedir(), ".claudekit", "logs");
		this.maxBytes = maxBytes;
	}

	/** Ensure log directory exists and open the stream for today. */
	init(): void {
		if (!existsSync(this.logDir)) {
			mkdirSync(this.logDir, { recursive: true });
		}
		this.rotateIfNeeded();
	}

	info(message: string): void {
		this.write("INFO", message);
		logger.info(message);
	}

	warn(message: string): void {
		this.write("WARN", message);
		logger.warning(message);
	}

	error(message: string): void {
		this.write("ERROR", message);
		logger.error(message);
	}

	debug(message: string): void {
		this.write("DEBUG", message);
		logger.debug(message);
	}

	/** Flush and close the underlying write stream. */
	close(): void {
		if (this.stream) {
			this.stream.end();
			this.stream = null;
		}
	}

	/** Absolute path to today's log file. */
	getLogPath(): string {
		return join(this.logDir, `content-${this.getDateStr()}.log`);
	}

	// ---------------------------------------------------------------------------
	// Internal helpers
	// ---------------------------------------------------------------------------

	private write(level: string, message: string): void {
		this.rotateIfNeeded();
		const timestamp = new Date().toISOString();
		const sanitized = sanitizeSecrets(logger.sanitize(message));
		const line = `${timestamp} [${level}] ${sanitized}\n`;
		if (this.stream) {
			this.stream.write(line);
		}
	}

	/**
	 * Open a new stream when:
	 *  - The calendar date has advanced (daily rotation), or
	 *  - The current file has exceeded maxBytes (size rotation).
	 */
	private rotateIfNeeded(): void {
		const dateStr = this.getDateStr();

		// Date-based rotation
		if (dateStr !== this.currentDate) {
			this.close();
			this.currentDate = dateStr;
			const logPath = join(this.logDir, `content-${dateStr}.log`);
			this.stream = createWriteStream(logPath, { flags: "a", mode: 0o600 });
			return;
		}

		// Size-based rotation
		if (this.maxBytes > 0 && this.stream) {
			const logPath = join(this.logDir, `content-${this.currentDate}.log`);
			try {
				const stat = statSync(logPath);
				if (stat.size >= this.maxBytes) {
					this.close();
					// Rename current file to a timestamped archive then start fresh
					const suffix = Date.now();
					const rotatedPath = join(this.logDir, `content-${this.currentDate}-${suffix}.log`);
					// The old file is already closed; rename is synchronous here via a
					// dynamic import — but to keep things simple we just re-open for write
					// (old data stays in the archived path, new stream starts fresh).
					void import("node:fs/promises").then(({ rename }) =>
						rename(logPath, rotatedPath).catch(() => {
							// Non-fatal — worst case both files are written to
						}),
					);
					this.stream = createWriteStream(logPath, { flags: "w", mode: 0o600 });
				}
			} catch {
				// File may not exist yet — ignore
			}
		}
	}

	/** Returns date string like "20260304" */
	private getDateStr(): string {
		return new Date().toISOString().slice(0, 10).replace(/-/g, "");
	}
}

// ---------------------------------------------------------------------------
// Secret redaction
// ---------------------------------------------------------------------------

const SECRET_PATTERNS = [
	// Facebook page access tokens (EAA... prefix, 50+ chars)
	/EAA[A-Za-z0-9]{50,}/g,
	// Generic long tokens in key=value or key: value contexts
	/(?:token|access_token|bearer|authorization)[=:\s]["']?[A-Za-z0-9_\-./]{40,}/gi,
	// OAuth tokens in URL query strings
	/access_token=[A-Za-z0-9_\-%.]{20,}/gi,
];

/** Redact common token/secret patterns from log messages. */
function sanitizeSecrets(message: string): string {
	let result = message;
	for (const pattern of SECRET_PATTERNS) {
		// Reset regex lastIndex for global patterns
		pattern.lastIndex = 0;
		result = result.replace(pattern, (match) =>
			match.length > 10 ? `${match.slice(0, 6)}...[REDACTED]` : "[REDACTED]",
		);
	}
	return result;
}
