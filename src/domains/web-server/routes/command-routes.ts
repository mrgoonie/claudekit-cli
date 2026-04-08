/**
 * Command browser API routes
 *
 * Scans ~/.claude/commands/ recursively for *.md files and returns
 * a tree structure with frontmatter metadata.
 *
 * GET /api/commands         — tree of all commands
 * GET /api/commands/:path(*) — single command detail (raw markdown)
 */

import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { parseFrontmatter } from "@/commands/portable/frontmatter-parser.js";
import type { Express, Request, Response } from "express";

/** A command node in the tree */
export interface CommandNode {
	name: string;
	path: string;
	description?: string;
	children?: CommandNode[];
}

/**
 * Recursively scan a directory and build command tree.
 * Entries are sorted: directories first (alphabetical), then files.
 */
async function buildCommandTree(dir: string, baseDir: string): Promise<CommandNode[]> {
	let dirents: import("node:fs").Dirent[];
	try {
		dirents = await readdir(dir, { withFileTypes: true });
	} catch {
		return [];
	}

	const nodes: CommandNode[] = [];

	// Sort: dirs first, then files, both alphabetical
	const sorted = [...dirents].sort((a, b) => {
		const aDir = a.isDirectory();
		const bDir = b.isDirectory();
		if (aDir !== bDir) return aDir ? -1 : 1;
		return a.name.localeCompare(b.name);
	});

	for (const entry of sorted) {
		const name = entry.name;
		const isDir = entry.isDirectory();
		const fullPath = join(dir, name);
		const relPath = relative(baseDir, fullPath);

		if (isDir) {
			const children = await buildCommandTree(fullPath, baseDir);
			if (children.length > 0) {
				nodes.push({ name, path: relPath, children });
			}
		} else if (name.endsWith(".md")) {
			// Command file — read frontmatter
			let description: string | undefined;
			try {
				const content = await readFile(fullPath, "utf-8");
				const { frontmatter } = parseFrontmatter(content);
				description = frontmatter.description as string | undefined;
			} catch {
				// Skip unreadable files
			}
			const commandName = basename(name, ".md");
			nodes.push({ name: commandName, path: relPath, description });
		}
	}

	return nodes;
}

export function registerCommandRoutes(app: Express): void {
	// GET /api/commands — list all commands as tree
	app.get("/api/commands", async (_req: Request, res: Response) => {
		const commandsDir = join(homedir(), ".claude", "commands");

		if (!existsSync(commandsDir)) {
			res.json({ tree: [] });
			return;
		}

		try {
			const tree = await buildCommandTree(commandsDir, commandsDir);
			res.json({ tree });
		} catch {
			res.status(500).json({ error: "Failed to scan commands directory" });
		}
	});

	// GET /api/commands/detail/:slug — single command detail by slug (e.g., "ck/plan" encoded as "ck--plan")
	app.get("/api/commands/detail/:slug", async (req: Request, res: Response) => {
		// Slug uses "--" as path separator (e.g., "ck--plan" → "ck/plan.md")
		const slug = String(req.params.slug ?? "");
		const rawPath = slug.replace(/--/g, "/");

		if (!rawPath) {
			res.status(400).json({ error: "Missing command path" });
			return;
		}

		// Security: reject path traversal attempts
		if (rawPath.includes("..") || rawPath.includes("\0")) {
			res.status(400).json({ error: "Invalid path" });
			return;
		}

		const commandsDir = join(homedir(), ".claude", "commands");
		// Resolve and verify path stays within commandsDir (cross-platform)
		const safePath = resolve(commandsDir, rawPath);
		const rel = relative(commandsDir, safePath);
		if (rel.startsWith("..") || isAbsolute(rel)) {
			res.status(403).json({ error: "Access denied" });
			return;
		}

		// Must end with .md or we add it
		const filePath = safePath.endsWith(".md") ? safePath : `${safePath}.md`;
		// path.relative guard above already ensures safePath is within commandsDir
		if (!existsSync(filePath)) {
			res.status(404).json({ error: "Command not found" });
			return;
		}

		try {
			const content = await readFile(filePath, "utf-8");
			const { frontmatter } = parseFrontmatter(content);
			const commandName = basename(filePath, ".md");
			res.json({
				name: commandName,
				path: rawPath,
				content,
				description: frontmatter.description as string | undefined,
			});
		} catch {
			res.status(500).json({ error: "Failed to read command" });
		}
	});
}
