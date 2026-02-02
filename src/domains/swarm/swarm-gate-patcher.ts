/**
 * Swarm gate detection and patching logic
 * Handles the actual code transformation for enabling/disabling swarm mode
 */

import type { SwarmModeState } from "./swarm-mode-types.js";

/**
 * Marker string used to identify the swarm gate function
 */
const SWARM_GATE_MARKER = /tengu_brass_pebble/;

/**
 * Find the gate function containing the marker by scanning backwards from the marker
 * position to find `function NAME(){` then forward-matching braces to extract the full body.
 * This handles any gate shape (simple or multi-condition) across CLI versions.
 */
function extractGateFunction(content: string): SwarmGateMatch | null {
	const markerIdx = content.indexOf("tengu_brass_pebble");
	if (markerIdx === -1) return null;

	// Scan backwards to find `function NAME(){`
	const before = content.slice(0, markerIdx);
	const fnHeaderMatch = before.match(/.*function\s+([a-zA-Z_$][\w$]*)\(\)\{/s);
	if (!fnHeaderMatch) return null;

	// Position where `function` keyword starts
	const fnStart = before.lastIndexOf(`function ${fnHeaderMatch[1]}`);
	if (fnStart === -1) return null;

	// Find opening brace position
	const braceStart = content.indexOf("{", fnStart);
	if (braceStart === -1) return null;

	// Brace-match to find the closing brace of the function body
	let depth = 0;
	let fnEnd = -1;
	for (let i = braceStart; i < content.length; i++) {
		if (content[i] === "{") depth++;
		else if (content[i] === "}") {
			depth--;
			if (depth === 0) {
				fnEnd = i + 1;
				break;
			}
		}
	}
	if (fnEnd === -1) return null;

	return {
		fnName: fnHeaderMatch[1],
		fullMatch: content.slice(fnStart, fnEnd),
	};
}

/**
 * Result of finding the swarm gate function
 */
interface SwarmGateMatch {
	/** Function name of the gate */
	fnName: string;
	/** Full matched text of the gate function */
	fullMatch: string;
}

/**
 * Find the swarm gate function in the CLI source code
 *
 * @param content - cli.js file content
 * @returns Match info if found, null otherwise
 */
export function findSwarmGateFunction(content: string): SwarmGateMatch | null {
	// Quick check for marker before doing expensive extraction
	if (!SWARM_GATE_MARKER.test(content)) {
		return null;
	}

	return extractGateFunction(content);
}

/**
 * Detect the current state of swarm mode in the CLI source
 *
 * @param content - cli.js file content
 * @returns Current swarm mode state
 */
export function detectSwarmModeState(content: string): SwarmModeState {
	// No marker = older version without swarm support
	if (!SWARM_GATE_MARKER.test(content)) {
		return "unknown";
	}

	const gate = extractGateFunction(content);
	if (gate) {
		// If the gate body is just `{return!0}`, it's already patched
		const body = gate.fullMatch.slice(gate.fullMatch.indexOf("{"));
		if (body === "{return!0}") {
			return "enabled";
		}
		// Gate found with actual logic = disabled (patchable)
		return "disabled";
	}

	// Marker exists but not inside a function with env var — the gate was
	// already patched (replaced with `return!0`, removing the marker from
	// the function body). If the env var reference is also gone, it's enabled.
	if (!content.includes("CLAUDE_CODE_AGENT_SWARMS")) {
		return "enabled";
	}

	// Both marker and env var exist but not in a recognized gate = unknown version
	return "unknown";
}

/**
 * Result of patching operation
 */
export interface PatchResult {
	/** Modified content (same as input if no change needed) */
	content: string;
	/** Whether content was actually modified */
	changed: boolean;
	/** Resulting swarm mode state */
	state: SwarmModeState;
}

/**
 * Patch the swarm gate function to enable swarm mode
 *
 * @param content - cli.js file content
 * @returns Patch result with modified content
 */
export function patchSwarmGate(content: string): PatchResult {
	const currentState = detectSwarmModeState(content);

	// Already enabled - no change needed
	if (currentState === "enabled") {
		return {
			content,
			changed: false,
			state: "enabled",
		};
	}

	// Unknown version - cannot patch
	if (currentState === "unknown") {
		return {
			content,
			changed: false,
			state: "unknown",
		};
	}

	// Find the gate function to patch
	const gateInfo = findSwarmGateFunction(content);
	if (!gateInfo) {
		// Should not happen if currentState is "disabled", but be defensive
		return {
			content,
			changed: false,
			state: "unknown",
		};
	}

	// Replace the gate function with always-return-true version
	const patchedFunction = `function ${gateInfo.fnName}(){return!0}`;
	const patchedContent = content.replace(gateInfo.fullMatch, patchedFunction);

	return {
		content: patchedContent,
		changed: true,
		state: "enabled",
	};
}

/**
 * Diagnostic information about the swarm gate
 */
export interface SwarmGateInfo {
	/** Current state */
	state: SwarmModeState;
	/** Function name if found */
	functionName?: string;
	/** Whether the marker string is present */
	hasMarker: boolean;
	/** Whether the gate function was found */
	hasGateFunction: boolean;
}

/**
 * Get diagnostic information about the swarm gate in the CLI source
 *
 * @param content - cli.js file content
 * @returns Diagnostic info
 */
export function getSwarmGateInfo(content: string): SwarmGateInfo {
	const hasMarker = SWARM_GATE_MARKER.test(content);
	const gateMatch = findSwarmGateFunction(content);
	const state = detectSwarmModeState(content);

	return {
		state,
		functionName: gateMatch?.fnName,
		hasMarker,
		hasGateFunction: gateMatch !== null,
	};
}
