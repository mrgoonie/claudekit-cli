import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
	CK_MARKETPLACE_NAME,
	CK_PLUGIN_NAME,
} from "@/domains/installation/plugin/install-mode-detector.js";

const execFileAsync = promisify(execFile);

/**
 * Thin, testable wrapper around the `claude plugin` CLI surface.
 *
 * All shelling-out goes through an injectable `ClaudeRunner` so the command
 * construction and result handling are unit-testable without a live `claude`
 * binary (the binary is exercised in the e2e migration suite instead).
 */

export interface ClaudeRunResult {
	ok: boolean;
	stdout: string;
	stderr: string;
	code: number | null;
}

export interface ClaudeRunOptions {
	/** Override CLAUDE_CONFIG_DIR for the spawned process (multi-profile / test isolation). */
	configDir?: string;
	timeoutMs?: number;
}

export type ClaudeRunner = (args: string[], opts?: ClaudeRunOptions) => Promise<ClaudeRunResult>;

const DEFAULT_TIMEOUT_MS = 120_000;

/** Real runner: spawns the `claude` binary on PATH and captures output. */
export const defaultClaudeRunner: ClaudeRunner = async (args, opts) => {
	const env = { ...process.env };
	if (opts?.configDir) env.CLAUDE_CONFIG_DIR = opts.configDir;
	try {
		const { stdout, stderr } = await execFileAsync("claude", args, {
			env,
			timeout: opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
			maxBuffer: 10 * 1024 * 1024,
		});
		return { ok: true, stdout: String(stdout), stderr: String(stderr), code: 0 };
	} catch (err) {
		const e = err as {
			stdout?: string | Buffer;
			stderr?: string | Buffer;
			code?: number;
			message?: string;
		};
		return {
			ok: false,
			stdout: e.stdout ? String(e.stdout) : "",
			stderr: e.stderr ? String(e.stderr) : (e.message ?? ""),
			code: typeof e.code === "number" ? e.code : null,
		};
	}
};

export type PluginScope = "user" | "project" | "local";

/**
 * Wraps marketplace + plugin lifecycle commands for the `ck` plugin.
 * Stateless apart from the injected runner and an optional config dir.
 */
export class PluginInstaller {
	constructor(
		private readonly run: ClaudeRunner = defaultClaudeRunner,
		private readonly configDir?: string,
	) {}

	private opts(timeoutMs?: number): ClaudeRunOptions {
		return { configDir: this.configDir, timeoutMs };
	}

	/** True if a `claude` binary is on PATH and responds to --version. */
	async isClaudeAvailable(): Promise<boolean> {
		return (await this.run(["--version"], this.opts(15_000))).ok;
	}

	/** True if this `claude` build exposes the plugin/marketplace subcommands. */
	async isPluginSupported(): Promise<boolean> {
		const r = await this.run(["plugin", "--help"], this.opts(15_000));
		return r.ok && /marketplace/i.test(r.stdout + r.stderr);
	}

	/** Register a marketplace from a path, URL, or GitHub repo. */
	async marketplaceAdd(source: string): Promise<ClaudeRunResult> {
		return this.run(["plugin", "marketplace", "add", source], this.opts());
	}

	async marketplaceUpdate(name: string = CK_MARKETPLACE_NAME): Promise<ClaudeRunResult> {
		return this.run(["plugin", "marketplace", "update", name], this.opts());
	}

	async marketplaceRemove(name: string = CK_MARKETPLACE_NAME): Promise<ClaudeRunResult> {
		return this.run(["plugin", "marketplace", "remove", name], this.opts());
	}

	/** Install ck@claudekit at the given scope. CC auto-enables by default. */
	async install(scope: PluginScope = "user"): Promise<ClaudeRunResult> {
		return this.run(
			["plugin", "install", `${CK_PLUGIN_NAME}@${CK_MARKETPLACE_NAME}`, "--scope", scope],
			this.opts(),
		);
	}

	async enable(): Promise<ClaudeRunResult> {
		return this.run(["plugin", "enable", CK_PLUGIN_NAME], this.opts());
	}

	async update(): Promise<ClaudeRunResult> {
		return this.run(["plugin", "update", CK_PLUGIN_NAME], this.opts());
	}

	async uninstall(): Promise<ClaudeRunResult> {
		return this.run(["plugin", "uninstall", CK_PLUGIN_NAME], this.opts());
	}

	async list(): Promise<ClaudeRunResult> {
		return this.run(["plugin", "list"], this.opts(15_000));
	}

	/** Verify the plugin resolves post-install: present in `plugin list` and enabled. */
	async verifyInstalled(): Promise<boolean> {
		const r = await this.list();
		if (!r.ok) return false;
		const out = r.stdout;
		const present = new RegExp(`\\b${CK_PLUGIN_NAME}@`).test(out);
		const enabled = /enabled/i.test(out);
		return present && enabled;
	}
}
