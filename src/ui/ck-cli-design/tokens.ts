import { homedir, platform } from "node:os";
import { resolve, win32 } from "node:path";
import pc from "picocolors";

export const PANEL_MIN_WIDTH = 60;
export const PANEL_MAX_WIDTH = 72;
const DEFAULT_WIDTH = PANEL_MAX_WIDTH;

export interface BoxChars {
	tl: string;
	tr: string;
	bl: string;
	br: string;
	h: string;
	v: string;
	bullet: string;
}

export interface CliDesignContext {
	box: BoxChars;
	platform: NodeJS.Platform;
	rawWidth: number;
	supportsPanels: boolean;
	useColor: boolean;
	width: number;
}

export interface CliDesignContextOptions {
	columns?: number;
	env?: NodeJS.ProcessEnv;
	isTTY?: boolean;
	platform?: NodeJS.Platform;
}

const UNICODE_BOX: BoxChars = {
	tl: "╔",
	tr: "╗",
	bl: "╚",
	br: "╝",
	h: "═",
	v: "║",
	bullet: "●",
};

const ASCII_BOX: BoxChars = {
	tl: "+",
	tr: "+",
	bl: "+",
	br: "+",
	h: "-",
	v: "|",
	bullet: "+",
};

export function createCliDesignContext(options: CliDesignContextOptions = {}): CliDesignContext {
	const env = options.env ?? process.env;
	const isTTY = options.isTTY ?? process.stdout.isTTY === true;
	const rawWidth = options.columns ?? process.stdout.columns ?? DEFAULT_WIDTH;
	const width = Math.max(40, Math.min(rawWidth, PANEL_MAX_WIDTH));
	const currentPlatform = options.platform ?? platform();

	return {
		box: supportsCliUnicode({ env, isTTY, platform: currentPlatform }) ? UNICODE_BOX : ASCII_BOX,
		platform: currentPlatform,
		rawWidth,
		supportsPanels: width >= PANEL_MIN_WIDTH,
		useColor: isTTY && !env.NO_COLOR,
		width,
	};
}

function supportsCliUnicode(options: {
	env: NodeJS.ProcessEnv;
	isTTY: boolean;
	platform: NodeJS.Platform;
}): boolean {
	const { env, isTTY, platform } = options;
	if (env.CK_FORCE_ASCII === "1" || env.NO_UNICODE === "1") return false;
	if (env.TERM === "dumb") return false;
	if (env.WT_SESSION) return true;
	const ci = (env.CI ?? "").trim().toLowerCase();
	if (ci === "true" || ci === "1") return true;
	if (!isTTY) return false;
	if (env.TERM_PROGRAM === "iTerm.app") return true;
	if (env.TERM_PROGRAM === "Apple_Terminal") return true;
	if (env.TERM_PROGRAM === "vscode") return true;
	if (env.KONSOLE_VERSION) return true;

	const locale = `${env.LANG ?? ""}${env.LC_ALL ?? ""}`.toLowerCase();
	if (locale.includes("utf")) return true;
	if (platform === "win32") return false;
	return true;
}

export function stripAnsi(value: string): string {
	let result = "";
	for (let index = 0; index < value.length; index += 1) {
		const code = value.charCodeAt(index);
		if (code !== 27) {
			result += value[index];
			continue;
		}

		const next = value[index + 1];
		if (next === "[") {
			index += 2;
			while (index < value.length) {
				const char = value.charCodeAt(index);
				if (char >= 0x40 && char <= 0x7e) break;
				index += 1;
			}
			continue;
		}

		if (next === "]") {
			index += 2;
			while (index < value.length) {
				if (value.charCodeAt(index) === 7) break;
				if (value.charCodeAt(index) === 27 && value[index + 1] === "\\") {
					index += 1;
					break;
				}
				index += 1;
			}
			continue;
		}

		if (next !== undefined) index += 1;
	}
	return result;
}

export function visibleWidth(value: string): number {
	return stripAnsi(value).length;
}

export function padVisible(value: string, width: number): string {
	const padding = Math.max(0, width - visibleWidth(value));
	return `${value}${" ".repeat(padding)}`;
}

// value must be plain text; ANSI sequences in input corrupt slice offsets
export function truncateMiddle(value: string, width: number): string {
	if (width <= 0) return "";
	if (visibleWidth(value) <= width) return value;
	if (width <= 3) return ".".repeat(width);
	const keep = width - 3;
	const front = Math.ceil(keep / 2);
	const back = Math.floor(keep / 2);
	return `${value.slice(0, front)}...${value.slice(value.length - back)}`;
}

export function wrapText(value: string, width: number): string[] {
	if (width <= 0) return [""];
	const words = value.split(/\s+/).filter(Boolean);
	if (words.length === 0) return [""];

	const lines: string[] = [];
	let current = "";
	for (const word of words) {
		const candidate = current.length === 0 ? word : `${current} ${word}`;
		if (visibleWidth(candidate) <= width) {
			current = candidate;
			continue;
		}
		if (current.length > 0) {
			lines.push(current);
			current = "";
		}
		if (visibleWidth(word) <= width) {
			current = word;
			continue;
		}
		let remaining = word;
		while (visibleWidth(remaining) > width) {
			lines.push(`${remaining.slice(0, Math.max(1, width - 3))}...`);
			remaining = remaining.slice(Math.max(1, width - 3));
		}
		current = remaining;
	}

	if (current.length > 0) {
		lines.push(current);
	}

	return lines;
}

export function formatDisplayPath(value: string): string {
	const normalized = value.replace(/\\/g, "/");
	const home = homedir().replace(/\\/g, "/");
	if (normalized === home) return "~";
	if (normalized.startsWith(`${home}/`)) {
		return normalized.replace(home, "~");
	}
	return normalized;
}

// Paths containing embedded double quotes (legal on POSIX, rare on Windows) are
// rendered as-is — shell-correct escaping would require quote-escape logic per
// platform. If a real user hits this we will add proper escaping.
export function formatCdHint(value: string, currentPlatform: NodeJS.Platform = platform()): string {
	if (currentPlatform === "win32") {
		const absolutePath = win32.resolve(value);
		return `cd /d "${absolutePath}"`;
	}

	const absolutePath = resolve(value);
	const displayPath = formatDisplayPath(absolutePath);
	if (displayPath.includes(" ")) {
		return `cd "${displayPath}"`;
	}
	return `cd ${displayPath}`;
}

export function paint(
	value: string,
	tone: "accent" | "muted" | "success" | "warning" | "heading",
	context: CliDesignContext,
): string {
	if (!context.useColor) return value;
	switch (tone) {
		case "accent":
			return pc.cyan(value);
		case "muted":
			return pc.dim(value);
		case "success":
			return pc.green(value);
		case "warning":
			return pc.yellow(value);
		case "heading":
			return pc.bold(value);
	}
}
