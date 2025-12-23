import { type WriteStream, createWriteStream } from "node:fs";
import pc from "picocolors";
import { output } from "./output-manager.js";

interface LogContext {
	[key: string]: any;
}

class Logger {
	private verboseEnabled = false;
	private logFileStream?: WriteStream;
	private exitHandlerRegistered = false;

	info(message: string): void {
		const symbols = output.getSymbols();
		console.log(pc.blue(symbols.info), message);
	}

	success(message: string): void {
		const symbols = output.getSymbols();
		console.log(pc.green(symbols.success), message);
	}

	warning(message: string): void {
		const symbols = output.getSymbols();
		console.log(pc.yellow(symbols.warning), message);
	}

	error(message: string): void {
		const symbols = output.getSymbols();
		console.error(pc.red(symbols.error), message);
	}

	debug(message: string): void {
		if (process.env.DEBUG) {
			console.log(pc.gray("[DEBUG]"), message);
		}
	}

	verbose(message: string, context?: LogContext): void {
		if (!this.verboseEnabled) return;

		const timestamp = this.getTimestamp();
		const sanitizedMessage = this.sanitize(message);
		const formattedContext = context ? this.formatContext(context) : "";

		const logLine = `${timestamp} ${pc.gray("[VERBOSE]")} ${sanitizedMessage}${formattedContext}`;

		console.error(logLine);

		if (this.logFileStream) {
			const plainLogLine = `${timestamp} [VERBOSE] ${sanitizedMessage}${formattedContext}`;
			this.logFileStream.write(`${plainLogLine}\n`);
		}
	}

	setVerbose(enabled: boolean): void {
		this.verboseEnabled = enabled;
		if (enabled) {
			this.verbose("Verbose logging enabled");
		}
	}

	isVerbose(): boolean {
		return this.verboseEnabled;
	}

	setLogFile(path?: string): void {
		if (this.logFileStream) {
			this.logFileStream.end();
			this.logFileStream = undefined;
		}

		if (path) {
			this.logFileStream = createWriteStream(path, {
				flags: "a",
				mode: 0o600,
			});
			this.registerExitHandler();
			this.verbose(`Logging to file: ${path}`);
		}
	}

	close(): void {
		if (this.logFileStream) {
			this.logFileStream.end();
			this.logFileStream = undefined;
		}
	}

	private registerExitHandler(): void {
		if (this.exitHandlerRegistered) return;
		this.exitHandlerRegistered = true;

		const cleanup = () => {
			if (this.logFileStream) {
				try {
					this.logFileStream.end();
				} catch {
					// Ignore errors during cleanup
				}
				this.logFileStream = undefined;
			}
		};

		// Handle normal exit
		process.on("exit", cleanup);

		// Handle Ctrl+C
		process.on("SIGINT", () => {
			cleanup();
			process.exit(130);
		});

		// Handle kill signal
		process.on("SIGTERM", () => {
			cleanup();
			process.exit(143);
		});

		// Handle uncaught exceptions
		process.on("uncaughtException", (error) => {
			if (this.logFileStream) {
				const timestamp = new Date().toISOString();
				this.logFileStream.write(`${timestamp} [FATAL] Uncaught exception: ${error.message}\n`);
				this.logFileStream.write(`${error.stack}\n`);
			}
			cleanup();
			process.exit(1);
		});
	}

	sanitize(text: string): string {
		return text
			.replace(/ghp_[a-zA-Z0-9]{36}/g, "ghp_***")
			.replace(/github_pat_[a-zA-Z0-9_]{82}/g, "github_pat_***")
			.replace(/gho_[a-zA-Z0-9]{36}/g, "gho_***")
			.replace(/ghu_[a-zA-Z0-9]{36}/g, "ghu_***")
			.replace(/ghs_[a-zA-Z0-9]{36}/g, "ghs_***")
			.replace(/ghr_[a-zA-Z0-9]{36}/g, "ghr_***")
			.replace(/Bearer [a-zA-Z0-9_-]+/g, "Bearer ***")
			.replace(/token=[a-zA-Z0-9_-]+/g, "token=***");
	}

	private getTimestamp(): string {
		return new Date().toISOString();
	}

	private formatContext(context: LogContext): string {
		const sanitized = Object.entries(context).reduce((acc, [key, value]) => {
			if (typeof value === "string") {
				acc[key] = this.sanitize(value);
			} else if (value && typeof value === "object") {
				// Recursively sanitize nested objects
				try {
					const stringified = JSON.stringify(value);
					const sanitizedStr = this.sanitize(stringified);
					acc[key] = JSON.parse(sanitizedStr);
				} catch {
					acc[key] = "[Object]";
				}
			} else {
				acc[key] = value;
			}
			return acc;
		}, {} as LogContext);

		return `\n  ${JSON.stringify(sanitized, null, 2).split("\n").join("\n  ")}`;
	}
}

export const logger = new Logger();
