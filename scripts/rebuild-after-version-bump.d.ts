export function synchronizePackageJsonVersion(version: string, packageJsonPath?: string): boolean;

export function prepare(
	_pluginConfig: unknown,
	context: {
		logger: { log: (message: string) => void };
		nextRelease?: { version?: string };
	},
): Promise<void>;
