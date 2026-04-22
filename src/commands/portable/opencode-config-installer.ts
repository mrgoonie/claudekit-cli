/**
 * OpenCode config installer — ensures opencode.json has a `model` set so migrated
 * agents can resolve a provider. Without a global model, OpenCode throws
 * `ProviderModelNotFoundError` on every agent invocation (#728).
 *
 * Writes to the minimal location: global at `~/.config/opencode/opencode.json`,
 * project at `<cwd>/opencode.json`. Preserves any existing fields; only fills in
 * `model` when missing.
 *
 * UX scope:
 * - Never overwrites an existing non-empty `model` field — power users with custom
 *   provider setups are left untouched.
 * - Detects authenticated providers from `~/.local/share/opencode/auth.json` and
 *   shows them to the user so they can type a provider-specific model.
 * - In interactive mode, prompts before writing; in non-interactive/--yes mode,
 *   writes the fallback default (verified anthropic model).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { logger } from "@/shared/logger.js";
import * as p from "@clack/prompts";
import { OPENCODE_DEFAULT_MODEL, getOpenCodeDefaultModelOverride } from "./model-taxonomy.js";

export interface EnsureOpenCodeModelResult {
	path: string;
	action: "added" | "existing" | "created" | "skipped";
	model: string;
	/** Human-readable reason for the chosen default. */
	reason?: string;
}

/**
 * Prompter abstraction — default uses `@clack/prompts`. Tests inject a stub.
 * Return `{ action: "accept" }` to use the suggested model, `{ action: "custom", value }`
 * to override, or `{ action: "skip" }` to skip writing.
 */
export type OpenCodeModelPrompter = (ctx: {
	suggestion: string;
	reason: string;
	detectedProviders: string[];
}) => Promise<{ action: "accept" } | { action: "custom"; value: string } | { action: "skip" }>;

export interface EnsureOpenCodeModelOptions {
	global: boolean;
	/** If true, call prompter before writing. Otherwise write suggested default silently. */
	interactive?: boolean;
	/** Override home directory (for tests). Defaults to `os.homedir()`. */
	homeDir?: string;
	/** Override project directory (for tests). Defaults to `process.cwd()`. */
	cwd?: string;
	/** Inject a prompter (for tests). Defaults to the clack-based prompter. */
	prompter?: OpenCodeModelPrompter;
}

function getOpenCodeConfigPath(options: EnsureOpenCodeModelOptions): string {
	if (options.global) {
		// OpenCode's global config path — `~/.config/opencode/opencode.json` on all
		// platforms (OpenCode uses XDG layout even on Windows).
		return join(options.homeDir ?? homedir(), ".config", "opencode", "opencode.json");
	}
	return join(options.cwd ?? process.cwd(), "opencode.json");
}

/** Read authenticated provider IDs from OpenCode's auth.json. Returns [] on any failure. */
async function detectAuthenticatedProviders(homeDir?: string): Promise<string[]> {
	const authPath = join(homeDir ?? homedir(), ".local", "share", "opencode", "auth.json");
	try {
		const raw = await readFile(authPath, "utf-8");
		const parsed = JSON.parse(raw) as unknown;
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return Object.keys(parsed as Record<string, unknown>);
		}
	} catch {
		// Missing or malformed auth.json — silently return empty.
	}
	return [];
}

/**
 * Suggest a default model to write based on (in priority order):
 * 1. `.ck.json` taxonomy override (`opencode.default.model`)
 * 2. Hardcoded `OPENCODE_DEFAULT_MODEL` — only Anthropic is verified against the
 *    OpenCode provider registry. For other providers, we don't auto-guess a model
 *    ID (would risk reproducing the exact ProviderModelNotFoundError #728 fixes);
 *    the interactive prompt surfaces detected providers so the user can type
 *    their own `provider/model-id`.
 */
export async function suggestOpenCodeDefaultModel(
	homeDir?: string,
): Promise<{ model: string; reason: string }> {
	const override = getOpenCodeDefaultModelOverride();
	if (override) {
		return { model: override, reason: ".ck.json override" };
	}
	// Silence unused param lint — homeDir kept for API stability and future auth-aware logic.
	void homeDir;
	return { model: OPENCODE_DEFAULT_MODEL, reason: "fallback default" };
}

/** Default clack-based prompter. */
const clackPrompter: OpenCodeModelPrompter = async ({ suggestion, reason, detectedProviders }) => {
	const providersHint =
		detectedProviders.length > 0
			? `Authenticated providers in opencode: ${detectedProviders.join(", ")}`
			: "No authenticated providers detected in opencode.";
	const response = await p.select({
		message: `No default model in opencode.json. ${providersHint}`,
		options: [
			{
				value: "accept",
				label: `Write "${suggestion}"`,
				hint: reason,
			},
			{ value: "custom", label: "Enter a different model..." },
			{ value: "skip", label: "Skip — I'll configure opencode.json myself" },
		],
		initialValue: "accept",
	});

	if (p.isCancel(response) || response === "skip") return { action: "skip" };
	if (response === "accept") return { action: "accept" };

	const custom = await p.text({
		message: "Model (format: provider/model-id, e.g. openai/gpt-5)",
		placeholder: suggestion,
		validate: (value) => {
			if (!value || !value.includes("/")) return "Must be in 'provider/model-id' format";
			return undefined;
		},
	});
	if (p.isCancel(custom)) return { action: "skip" };
	return { action: "custom", value: custom };
};

/**
 * Ensure opencode.json has a `model` field. Returns the action taken.
 * - "existing": file already had a model, nothing changed
 * - "added": file existed but lacked model, field inserted
 * - "created": file did not exist, minimal config written
 * - "skipped": user declined the prompt in interactive mode
 */
export async function ensureOpenCodeModel(
	options: EnsureOpenCodeModelOptions,
): Promise<EnsureOpenCodeModelResult> {
	const configPath = getOpenCodeConfigPath(options);

	let existing: Record<string, unknown> | null = null;
	try {
		const raw = await readFile(configPath, "utf-8");
		const parsed = JSON.parse(raw) as unknown;
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			existing = parsed as Record<string, unknown>;
		} else {
			// Valid JSON but non-object (array/string/number) — overwriting will drop
			// whatever was there. Warn so user isn't surprised.
			logger.warning(
				`ensureOpenCodeModel: ${configPath} is valid JSON but not an object; overwriting with default model`,
			);
		}
	} catch (err) {
		const errno = (err as NodeJS.ErrnoException | null)?.code;
		if (errno === "ENOENT") {
			// expected when file doesn't exist yet
		} else if (err instanceof SyntaxError) {
			// Malformed JSON — existing non-model fields will be lost on overwrite.
			// Warn user-visibly rather than silently dropping their config.
			logger.warning(
				`ensureOpenCodeModel: ${configPath} is not valid JSON; overwriting with default model (existing contents will be lost)`,
			);
		} else {
			logger.verbose(
				`ensureOpenCodeModel: failed to read ${configPath} (${errno ?? String(err)}); recreating`,
			);
		}
	}

	if (existing && typeof existing.model === "string" && existing.model.trim().length > 0) {
		return { path: configPath, action: "existing", model: existing.model };
	}

	// No model configured — compute a suggestion and (maybe) prompt.
	const suggestion = await suggestOpenCodeDefaultModel(options.homeDir);
	let chosenModel = suggestion.model;

	if (options.interactive) {
		const detectedProviders = await detectAuthenticatedProviders(options.homeDir);
		const prompter = options.prompter ?? clackPrompter;
		const response = await prompter({
			suggestion: suggestion.model,
			reason: suggestion.reason,
			detectedProviders,
		});

		if (response.action === "skip") {
			return {
				path: configPath,
				action: "skipped",
				model: "",
				reason: "user declined",
			};
		}

		if (response.action === "custom") {
			chosenModel = response.value;
		}
	}

	const next = { ...(existing ?? {}), model: chosenModel };
	await mkdir(dirname(configPath), { recursive: true });
	await writeFile(configPath, `${JSON.stringify(next, null, 2)}\n`, "utf-8");

	return {
		path: configPath,
		action: existing ? "added" : "created",
		model: chosenModel,
		reason: suggestion.reason,
	};
}
