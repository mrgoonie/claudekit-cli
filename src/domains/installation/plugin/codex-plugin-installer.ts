import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
	CK_MARKETPLACE_NAME,
	CK_PLUGIN_NAME,
} from "@/domains/installation/plugin/install-mode-detector.js";

const execFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 120_000;

export interface CodexRunResult {
	ok: boolean;
	stdout: string;
	stderr: string;
	code: number | null;
}

export interface CodexRunOptions {
	/** Override CODEX_HOME for tests and isolated smoke runs. */
	codexHome?: string;
	timeoutMs?: number;
}

export type CodexRunner = (args: string[], opts?: CodexRunOptions) => Promise<CodexRunResult>;

export interface CodexExecutableCandidate {
	command: string;
	argsPrefix: string[];
}

export function resolveCodexExecutable(_platformName: NodeJS.Platform = process.platform): string {
	return "codex";
}

export function shouldRunCodexInShell(_platformName: NodeJS.Platform = process.platform): boolean {
	return false;
}

export function resolveCodexExecutableCandidates(
	platformName: NodeJS.Platform = process.platform,
): CodexExecutableCandidate[] {
	if (platformName === "win32") {
		return [
			{ command: "codex", argsPrefix: [] },
			{ command: "cmd.exe", argsPrefix: ["/d", "/s", "/c", "codex.cmd"] },
		];
	}
	return [{ command: resolveCodexExecutable(platformName), argsPrefix: [] }];
}

export const defaultCodexRunner: CodexRunner = async (args, opts) => {
	const env = { ...process.env };
	if (opts?.codexHome) env.CODEX_HOME = opts.codexHome;

	let lastError: unknown = null;
	const candidates = resolveCodexExecutableCandidates();
	for (const [index, candidate] of candidates.entries()) {
		try {
			const { stdout, stderr } = await execFileAsync(
				candidate.command,
				[...candidate.argsPrefix, ...args],
				{
					env,
					shell: shouldRunCodexInShell(),
					timeout: opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
					maxBuffer: 10 * 1024 * 1024,
				},
			);
			return { ok: true, stdout: String(stdout), stderr: String(stderr), code: 0 };
		} catch (err) {
			lastError = err;
			if (index < candidates.length - 1 && isSpawnResolutionError(err)) {
				continue;
			}
			break;
		}
	}

	const e = lastError as {
		stdout?: string | Buffer;
		stderr?: string | Buffer;
		code?: number | string;
		message?: string;
	};
	return {
		ok: false,
		stdout: e?.stdout ? String(e.stdout) : "",
		stderr: e?.stderr ? String(e.stderr) : (e?.message ?? ""),
		code: typeof e?.code === "number" ? e.code : null,
	};
};

function isSpawnResolutionError(err: unknown): boolean {
	const code = (err as { code?: unknown })?.code;
	return code === "ENOENT" || code === "EACCES" || code === "EINVAL";
}

export type CodexPluginInstallAction = "installed" | "skipped-codex-unsupported" | "install-failed";

export interface CodexPluginInstallResult {
	action: CodexPluginInstallAction;
	pluginVerified: boolean;
	error?: string;
}

export interface RemoveCodexPluginResult {
	removed: boolean;
	marketplaceRemoved: boolean;
}

export interface InstallCodexPluginOptions {
	/** Staged kit dir containing .agents/plugins/marketplace.json. */
	pluginSourceDir: string;
	installer?: CodexPluginInstaller;
	codexHome?: string;
}

export class CodexPluginInstaller {
	constructor(
		private readonly run: CodexRunner = defaultCodexRunner,
		private readonly codexHome?: string,
	) {}

	private opts(timeoutMs?: number): CodexRunOptions {
		return { codexHome: this.codexHome, timeoutMs };
	}

	async isCodexAvailable(): Promise<boolean> {
		return (await this.run(["--version"], this.opts(15_000))).ok;
	}

	async isPluginSupported(): Promise<boolean> {
		const r = await this.run(["plugin", "--help"], this.opts(15_000));
		return r.ok && /marketplace/i.test(r.stdout + r.stderr);
	}

	async marketplaceAdd(source: string): Promise<CodexRunResult> {
		return this.run(["plugin", "marketplace", "add", source], this.opts());
	}

	async marketplaceRemove(name: string = CK_MARKETPLACE_NAME): Promise<CodexRunResult> {
		return this.run(["plugin", "marketplace", "remove", name], this.opts());
	}

	async add(): Promise<CodexRunResult> {
		return this.run(["plugin", "add", `${CK_PLUGIN_NAME}@${CK_MARKETPLACE_NAME}`], this.opts());
	}

	async remove(): Promise<CodexRunResult> {
		return this.run(["plugin", "remove", `${CK_PLUGIN_NAME}@${CK_MARKETPLACE_NAME}`], this.opts());
	}

	async listJson(): Promise<CodexRunResult> {
		return this.run(["plugin", "list", "--json"], this.opts(15_000));
	}

	async listText(): Promise<CodexRunResult> {
		return this.run(["plugin", "list"], this.opts(15_000));
	}

	async verifyInstalled(): Promise<boolean> {
		const r = await this.listJson();
		if (!r.ok) {
			const text = await this.listText();
			return text.ok && parseTextPluginList(text.stdout + text.stderr);
		}
		try {
			const parsed = JSON.parse(r.stdout) as {
				installed?: Array<{ pluginId?: string; enabled?: boolean; installed?: boolean }>;
			};
			return (parsed.installed ?? []).some(
				(plugin) =>
					plugin.pluginId === `${CK_PLUGIN_NAME}@${CK_MARKETPLACE_NAME}` &&
					plugin.installed === true &&
					plugin.enabled === true,
			);
		} catch {
			const text = await this.listText();
			return text.ok && parseTextPluginList(text.stdout + text.stderr);
		}
	}
}

function parseTextPluginList(output: string): boolean {
	const pluginId = `${CK_PLUGIN_NAME}@${CK_MARKETPLACE_NAME}`.replace(
		/[.*+?^${}()|[\]\\]/g,
		"\\$&",
	);
	const row = new RegExp(`^\\s*${pluginId}\\s+.*\\binstalled\\b.*\\benabled\\b`, "im");
	return row.test(output);
}

export async function installCodexPlugin(
	opts: InstallCodexPluginOptions,
): Promise<CodexPluginInstallResult> {
	const installer = opts.installer ?? new CodexPluginInstaller(undefined, opts.codexHome);

	if (!(await installer.isCodexAvailable()) || !(await installer.isPluginSupported())) {
		return { action: "skipped-codex-unsupported", pluginVerified: false };
	}

	const added = await installer.marketplaceAdd(opts.pluginSourceDir);
	if (!added.ok) {
		return {
			action: "install-failed",
			pluginVerified: false,
			error: `codex marketplace add failed: ${added.stderr.trim()}`,
		};
	}

	const installed = await installer.add();
	if (!installed.ok) {
		return {
			action: "install-failed",
			pluginVerified: false,
			error: `codex plugin add failed: ${installed.stderr.trim()}`,
		};
	}

	const verified = await installer.verifyInstalled();
	if (!verified) {
		return {
			action: "install-failed",
			pluginVerified: false,
			error: "codex plugin did not verify after install",
		};
	}

	return { action: "installed", pluginVerified: true };
}

export async function removeCodexPlugin(
	opts: { installer?: CodexPluginInstaller; codexHome?: string } = {},
): Promise<RemoveCodexPluginResult> {
	const installer = opts.installer ?? new CodexPluginInstaller(undefined, opts.codexHome);

	if (!(await installer.isCodexAvailable()) || !(await installer.isPluginSupported())) {
		return { removed: false, marketplaceRemoved: false };
	}

	const removed = await installer.remove();
	const marketplaceRemoved = await installer.marketplaceRemove();
	return {
		removed: removed.ok,
		marketplaceRemoved: marketplaceRemoved.ok,
	};
}

export async function shouldRefreshCodexPlugin(
	installer: CodexPluginInstaller = new CodexPluginInstaller(),
): Promise<boolean> {
	if (!(await installer.isCodexAvailable()) || !(await installer.isPluginSupported())) {
		return false;
	}
	return !(await installer.verifyInstalled());
}
