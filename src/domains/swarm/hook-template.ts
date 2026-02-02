/**
 * Hook Template — Self-contained CommonJS hook for auto-reapplying swarm patch
 *
 * This content is written to ~/.claude/hooks/ck-swarm-auto-reapply.cjs
 * Zero dependencies — pure Node.js stdlib (fs, path, crypto)
 */

export const SWARM_HOOK_FILENAME = "ck-swarm-auto-reapply.cjs";

/* eslint-disable no-useless-escape */
export function getSwarmHookContent(): string {
	const lines = [
		"#!/usr/bin/env node",
		"// ck-swarm-auto-reapply.cjs — Auto-reapply swarm patch when CC updates",
		"const fs = require('fs');",
		"const path = require('path');",
		"const crypto = require('crypto');",
		"",
		"const HOME = process.env.HOME || process.env.USERPROFILE;",
		"if (!HOME) {",
		"  process.stderr.write('[ck-swarm] HOME/USERPROFILE not set\\n');",
		"  process.exit(0);",
		"}",
		"",
		"const STATE_PATH = path.join(HOME, '.claude', '.ck-swarm-state.json');",
		"",
		"function main() {",
		"  if (!fs.existsSync(STATE_PATH)) return;",
		"  const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));",
		"  if (!state.enabled) return;",
		"",
		"  // Check if cli.js still exists at stored path",
		"  if (!fs.existsSync(state.cliJsPath)) {",
		"    process.stderr.write('[ck-swarm] cli.js not found at stored path - run ck swarm enable\\n');",
		"    return;",
		"  }",
		"",
		"  const content = fs.readFileSync(state.cliJsPath, 'utf8');",
		"  const hash = crypto.createHash('sha256').update(content).digest('hex');",
		"  if (hash === state.cliJsHash) return;",
		"",
		'  const GATE_RE = /function\\s+([a-zA-Z_$][\\w$]*)\\(\\)\\{if\\([\\w$]+\\(process\\.env\\.CLAUDE_CODE_AGENT_SWARMS\\)\\)return!1;return\\s*[\\w$]+\\("tengu_brass_pebble",!1\\)\\}/;',
		"  const match = content.match(GATE_RE);",
		"  if (!match) {",
		"    if (/TeammateTool/.test(content) && !/tengu_brass_pebble/.test(content)) return;",
		"    process.stderr.write('[ck-swarm] Gate pattern not found after update\\n');",
		"    return;",
		"  }",
		"",
		"  const patched = content.replace(match[0], `function ${match[1]}(){return!0}`);",
		"  fs.writeFileSync(state.cliJsPath, patched);",
		"",
		"  state.cliJsHash = crypto.createHash('sha256').update(patched).digest('hex');",
		"  state.patchedAt = new Date().toISOString();",
		"  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));",
		"}",
		"",
		"try { main(); } catch (e) {",
		"  process.stderr.write(`[ck-swarm] Auto-reapply failed: ${e.message}\\n`);",
		"}",
	];
	return `${lines.join("\n")}\n`;
}
