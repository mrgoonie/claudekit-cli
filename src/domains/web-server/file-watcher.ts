/**
 * File watcher for real-time config updates
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { CkConfigManager } from "@/domains/config/index.js";
import { logger } from "@/shared/logger.js";
import chokidar, { type FSWatcher } from "chokidar";
import type { WebSocketManager } from "./websocket-manager.js";

interface WatcherOptions {
	wsManager: WebSocketManager;
	debounceMs?: number;
}

export class FileWatcher {
	private watcher: FSWatcher | null = null;
	private wsManager: WebSocketManager;
	private debounceMs: number;
	private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

	constructor(options: WatcherOptions) {
		this.wsManager = options.wsManager;
		this.debounceMs = options.debounceMs ?? 400;
	}

	start(): void {
		const paths = this.getWatchPaths();

		this.watcher = chokidar.watch(paths, {
			persistent: true,
			ignoreInitial: true,
		});

		this.watcher
			.on("change", (path: string) => this.handleFileChange(path, "change"))
			.on("add", (path: string) => this.handleFileChange(path, "add"))
			.on("unlink", (path: string) => this.handleFileChange(path, "unlink"))
			.on("error", (error: unknown) =>
				logger.error(`Watcher error: ${error instanceof Error ? error.message : String(error)}`),
			);

		logger.debug(`Watching: ${paths.join(", ")}`);
	}

	private getWatchPaths(): string[] {
		const paths: string[] = [];

		// Global config
		const globalDir = join(homedir(), ".claudekit");
		paths.push(join(globalDir, "config.json"));

		// Global kit config
		const globalKitDir = join(homedir(), ".claude");
		paths.push(join(globalKitDir, ".ck.json"));
		paths.push(join(globalKitDir, "settings.json"));
		paths.push(join(globalKitDir, "settings.local.json"));

		// Local project config
		const cwd = process.cwd();
		paths.push(join(cwd, ".claude", ".ck.json"));
		paths.push(join(cwd, ".claude", "settings.json"));
		paths.push(join(cwd, ".claude", "settings.local.json"));

		return paths;
	}

	private handleFileChange(path: string, type: "change" | "add" | "unlink"): void {
		// Debounce rapid changes to same file
		const existing = this.debounceTimers.get(path);
		if (existing) {
			clearTimeout(existing);
		}

		const timer = setTimeout(async () => {
			this.debounceTimers.delete(path);
			await this.broadcastChange(path, type);
		}, this.debounceMs);

		this.debounceTimers.set(path, timer);
	}

	private async broadcastChange(path: string, type: "change" | "add" | "unlink"): Promise<void> {
		logger.debug(`File ${type}: ${path}`);

		// Broadcast file change event
		this.wsManager.broadcast({
			type: "file:changed",
			payload: { path, changeType: type },
		});

		// If config file changed, broadcast updated config
		if (this.isConfigFile(path)) {
			try {
				const scope = this.getConfigScope(path);

				// Reload and broadcast config via CkConfigManager
				const ckScope = scope === "global" ? "global" : "project";
				const projectDir = scope === "global" ? null : process.cwd();
				const config = await CkConfigManager.loadScope(ckScope, projectDir);

				this.wsManager.broadcast({
					type: "config:updated",
					payload: { scope, config: config ?? {} },
				});
			} catch (error) {
				logger.error(`Failed to reload config: ${error}`);
				this.wsManager.broadcast({
					type: "error",
					payload: { message: "Failed to reload configuration", code: "CONFIG_RELOAD_ERROR" },
				});
			}
		}
	}

	private isConfigFile(path: string): boolean {
		return (
			path.endsWith("config.json") ||
			path.endsWith(".ck.json") ||
			path.endsWith("settings.json") ||
			path.endsWith("settings.local.json")
		);
	}

	private getConfigScope(path: string): "global" | "local" {
		const globalDir = join(homedir(), ".claudekit");
		const globalKitDir = join(homedir(), ".claude");
		return path.startsWith(globalDir) || path.startsWith(globalKitDir) ? "global" : "local";
	}

	stop(): void {
		this.debounceTimers.forEach((timer) => clearTimeout(timer));
		this.debounceTimers.clear();

		if (this.watcher) {
			this.watcher.close();
			this.watcher = null;
			logger.debug("File watcher stopped");
		}
	}
}
