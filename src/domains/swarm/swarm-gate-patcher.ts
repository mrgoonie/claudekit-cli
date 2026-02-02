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
 * Regex pattern to match the complete swarm gate function
 * Matches: function NAME(){if(FUNC(process.env.CLAUDE_CODE_AGENT_SWARMS))return!1;return FUNC("tengu_brass_pebble",!1)}
 */
const SWARM_GATE_FN_RE =
	/function\s+([a-zA-Z_$][\w$]*)\(\)\{if\([\w$]+\(process\.env\.CLAUDE_CODE_AGENT_SWARMS\)\)return!1;return\s*[\w$]+\("tengu_brass_pebble",!1\)\}/;

/**
 * Regex pattern to match the patched (enabled) gate function
 * Matches: function NAME(){return!0}
 */
const ENABLED_GATE_FN_RE = /function\s+([a-zA-Z_$][\w$]*)\(\)\{return!0\}/;

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
	// First check for the marker to quickly rule out non-swarm-enabled versions
	if (!SWARM_GATE_MARKER.test(content)) {
		return null;
	}

	const match = content.match(SWARM_GATE_FN_RE);
	if (!match) {
		return null;
	}

	return {
		fnName: match[1],
		fullMatch: match[0],
	};
}

/**
 * Detect the current state of swarm mode in the CLI source
 *
 * @param content - cli.js file content
 * @returns Current swarm mode state
 */
export function detectSwarmModeState(content: string): SwarmModeState {
	// Check if marker exists at all
	if (!SWARM_GATE_MARKER.test(content)) {
		// No marker = older version without swarm support
		return "unknown";
	}

	// Check for original (disabled) gate pattern
	const disabledMatch = content.match(SWARM_GATE_FN_RE);
	if (disabledMatch) {
		return "disabled";
	}

	// Check for patched (enabled) gate pattern
	// We need to search for the function name first from the original pattern
	const gateInfo = findSwarmGateFunction(content);
	if (!gateInfo) {
		// Marker exists but no recognizable gate function
		// Could be already patched - check for enabled pattern
		const enabledMatch = content.match(ENABLED_GATE_FN_RE);
		if (enabledMatch) {
			return "enabled";
		}
		return "unknown";
	}

	return "disabled";
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
