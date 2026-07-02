import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
	CK_MARKETPLACE_NAME,
	CK_PLUGIN_NAME,
} from "@/domains/installation/plugin/install-mode-detector.js";
import { versionsMatch } from "@/domains/versioning/checking/version-utils.js";

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

export type CodexPluginStatus =
	| "codex-unavailable"
	| "plugins-unsupported"
	| "missing"
	| "disabled"
	| "installed-current"
	| "installed-stale-version"
	| "installed-stale-source"
	| "unknown";

export interface CodexPluginStateOptions {
	expectedVersion?: string | null;
	expectedMarketplace?: string | null;
	expectedSource?: string | null;
}

export interface CodexPluginState {
	status: CodexPluginStatus;
	pluginId: string;
	enabled: boolean;
	installed: boolean;
	installedVersion: string | null;
	expectedVersion: string | null;
	marketplace: string | null;
	expectedMarketplace: string | null;
	source: string | null;
	expectedSource: string | null;
	shouldRefresh: boolean;
	error?: string;
}

export interface CodexPluginInstallResult {
	action: CodexPluginInstallAction;
	pluginVerified: boolean;
	error?: string;
}

export interface RemoveCodexPluginResult {
	removed: boolean;
	marketplaceRemoved: boolean;
	pluginStillInstalled?: boolean;
	error?: string;
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
		const state = await detectCodexPluginListState(this);
		return (
			state.status === "installed-current" ||
			state.status === "installed-stale-version" ||
			state.status === "installed-stale-source"
		);
	}
}

interface CodexPluginListEntry {
	pluginId: string | null;
	installed: boolean;
	enabled: boolean;
	version: string | null;
	marketplace: string | null;
	source: string | null;
}

function createState(
	status: CodexPluginStatus,
	entry: CodexPluginListEntry | null,
	options: CodexPluginStateOptions = {},
	error?: string,
): CodexPluginState {
	const pluginId = `${CK_PLUGIN_NAME}@${CK_MARKETPLACE_NAME}`;
	return {
		status,
		pluginId,
		enabled: entry?.enabled ?? false,
		installed: entry?.installed ?? false,
		installedVersion: entry?.version ?? null,
		expectedVersion: options.expectedVersion ?? null,
		marketplace: entry?.marketplace ?? null,
		expectedMarketplace: options.expectedMarketplace ?? CK_MARKETPLACE_NAME,
		source: entry?.source ?? null,
		expectedSource: options.expectedSource ?? null,
		shouldRefresh:
			status === "missing" ||
			status === "disabled" ||
			status === "installed-stale-version" ||
			status === "installed-stale-source",
		...(error ? { error } : {}),
	};
}

function classifyCodexPluginEntry(
	entry: CodexPluginListEntry | null,
	options: CodexPluginStateOptions = {},
): CodexPluginState {
	if (!entry) return createState("missing", null, options);
	if (!entry.enabled || !entry.installed) return createState("disabled", entry, options);

	const expectedMarketplace = options.expectedMarketplace ?? CK_MARKETPLACE_NAME;
	if (entry.marketplace && entry.marketplace !== expectedMarketplace) {
		return createState("installed-stale-source", entry, options);
	}
	if (options.expectedSource && entry.source && entry.source !== options.expectedSource) {
		return createState("installed-stale-source", entry, options);
	}
	if (
		options.expectedVersion &&
		entry.version &&
		!versionsMatch(entry.version, options.expectedVersion)
	) {
		return createState("installed-stale-version", entry, options);
	}

	return createState("installed-current", entry, options);
}

function parseTextPluginList(output: string): CodexPluginListEntry | null {
	const pluginId = `${CK_PLUGIN_NAME}@${CK_MARKETPLACE_NAME}`.replace(
		/[.*+?^${}()|[\]\\]/g,
		"\\$&",
	);
	const row = new RegExp(`^\\s*(${pluginId})\\s+(.*)$`, "im").exec(output);
	if (!row) return null;
	const details = row[2] ?? "";
	const versionMatch = details.match(/\b(v?\d+\.\d+\.\d+(?:[-+][^\s]+)?)\b/);
	return {
		pluginId: `${CK_PLUGIN_NAME}@${CK_MARKETPLACE_NAME}`,
		installed: /\binstalled\b/i.test(details),
		enabled: /\benabled\b/i.test(details) && !/\bdisabled\b/i.test(details),
		version: versionMatch?.[1] ?? null,
		marketplace: CK_MARKETPLACE_NAME,
		source: null,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(source: Record<string, unknown>, keys: string[]): string | null {
	for (const key of keys) {
		const value = source[key];
		if (typeof value === "string" && value.trim() !== "") return value;
	}
	return null;
}

function sourceField(source: Record<string, unknown>, keys: string[]): string | null {
	for (const key of keys) {
		const value = source[key];
		if (typeof value === "string" && value.trim() !== "") return value;
		if (isRecord(value)) {
			const nested = stringField(value, ["path", "sourcePath", "url"]);
			if (nested) return nested;
		}
	}
	return null;
}

function booleanField(
	source: Record<string, unknown>,
	key: string,
	defaultValue: boolean,
): boolean {
	const value = source[key];
	return typeof value === "boolean" ? value : defaultValue;
}

function parseJsonPluginList(output: string): CodexPluginListEntry[] | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(output);
	} catch {
		return null;
	}

	const rawEntries = Array.isArray(parsed)
		? parsed
		: isRecord(parsed)
			? (parsed.installed ?? parsed.plugins ?? parsed.entries)
			: null;
	if (!Array.isArray(rawEntries)) return null;

	return rawEntries.flatMap((entry) => {
		if (!isRecord(entry)) return [];
		const pluginId =
			stringField(entry, ["pluginId", "id"]) ??
			(stringField(entry, ["name"]) === CK_PLUGIN_NAME
				? `${CK_PLUGIN_NAME}@${stringField(entry, ["marketplace", "marketplaceName"]) ?? CK_MARKETPLACE_NAME}`
				: null);
		if (pluginId !== `${CK_PLUGIN_NAME}@${CK_MARKETPLACE_NAME}`) return [];

		return [
			{
				pluginId,
				installed: booleanField(entry, "installed", true),
				enabled: booleanField(entry, "enabled", false),
				version: stringField(entry, ["version", "pluginVersion", "manifestVersion"]),
				marketplace: stringField(entry, ["marketplace", "marketplaceName"]),
				source: sourceField(entry, ["source", "path", "sourcePath"]),
			},
		];
	});
}

export async function detectCodexPluginState(
	installer: CodexPluginInstaller = new CodexPluginInstaller(),
	options: CodexPluginStateOptions = {},
): Promise<CodexPluginState> {
	if (!(await installer.isCodexAvailable())) {
		return createState("codex-unavailable", null, options);
	}
	if (!(await installer.isPluginSupported())) {
		return createState("plugins-unsupported", null, options);
	}

	return detectCodexPluginListState(installer, options);
}

async function detectCodexPluginListState(
	installer: CodexPluginInstaller,
	options: CodexPluginStateOptions = {},
): Promise<CodexPluginState> {
	const json = await installer.listJson();
	if (json.ok) {
		const entries = parseJsonPluginList(json.stdout);
		if (entries) return classifyCodexPluginEntry(entries[0] ?? null, options);
	}

	const text = await installer.listText();
	if (text.ok)
		return classifyCodexPluginEntry(parseTextPluginList(text.stdout + text.stderr), options);

	return createState(
		"unknown",
		null,
		options,
		json.stderr || text.stderr || "codex plugin list failed",
	);
}

export async function installCodexPlugin(
	opts: InstallCodexPluginOptions,
): Promise<CodexPluginInstallResult> {
	const installer = opts.installer ?? new CodexPluginInstaller(undefined, opts.codexHome);

	if (!(await installer.isCodexAvailable()) || !(await installer.isPluginSupported())) {
		return { action: "skipped-codex-unsupported", pluginVerified: false };
	}

	const added = await addOrReplaceMarketplace(installer, opts.pluginSourceDir);
	if (!added.ok) {
		return {
			action: "install-failed",
			pluginVerified: false,
			error: added.error,
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

async function addOrReplaceMarketplace(
	installer: CodexPluginInstaller,
	pluginSourceDir: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
	const added = await installer.marketplaceAdd(pluginSourceDir);
	if (added.ok) return { ok: true };

	const error = added.stderr.trim();
	if (!isReplaceableMarketplaceAddFailure(error)) {
		return { ok: false, error: `codex marketplace add failed: ${error}` };
	}

	await installer.marketplaceRemove(CK_MARKETPLACE_NAME);
	const readded = await installer.marketplaceAdd(pluginSourceDir);
	if (readded.ok) return { ok: true };

	return {
		ok: false,
		error: `codex marketplace refresh failed: ${readded.stderr.trim() || error}`,
	};
}

function isReplaceableMarketplaceAddFailure(error: string): boolean {
	return /\balready\b/i.test(error) && /\bmarketplace\b/i.test(error);
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
	const state = await detectCodexPluginListState(installer);
	return {
		removed: removed.ok,
		marketplaceRemoved: marketplaceRemoved.ok,
		pluginStillInstalled: state.installed,
		...(state.installed
			? { error: `codex plugin still installed after removal (${state.status})` }
			: {}),
	};
}

export async function shouldRefreshCodexPlugin(
	installer: CodexPluginInstaller = new CodexPluginInstaller(),
	options: CodexPluginStateOptions = {},
): Promise<boolean> {
	return (await detectCodexPluginState(installer, options)).shouldRefresh;
}
