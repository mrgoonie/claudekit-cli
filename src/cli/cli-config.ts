/**
 * CLI Configuration
 *
 * Global CLI options and configuration setup.
 */

import { cac } from "cac";

/**
 * Create and configure the CLI instance
 */
export function createCliInstance() {
	const cli = cac("ck");

	// Global options
	cli.option("--verbose", "Enable verbose logging for debugging");
	cli.option("--json", "Output machine-readable JSON format");
	cli.option("--log-file <path>", "Write logs to file");

	return cli;
}

/**
 * Register version and help flags
 */
export function registerGlobalFlags(cli: ReturnType<typeof cac>) {
	cli.option("-V, --version", "Display version number");
	cli.option("-h, --help", "Display help information");
}
