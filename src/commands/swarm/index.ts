/**
 * Swarm Command Router
 *
 * Routes swarm subcommands to their respective handlers.
 */

import { swarmDisable } from "./swarm-disable.js";
import { swarmDoctor } from "./swarm-doctor.js";
import { swarmEnable } from "./swarm-enable.js";
import { swarmStatus } from "./swarm-status.js";

interface SwarmOptions {
	force?: boolean;
	yes?: boolean;
}

export async function swarmCommand(
	action: string | undefined,
	options: SwarmOptions,
): Promise<void> {
	switch (action) {
		case "enable":
			return swarmEnable(options);
		case "disable":
			return swarmDisable(options);
		case "status":
			return swarmStatus();
		case "doctor":
			return swarmDoctor();
		default:
			return swarmStatus();
	}
}
