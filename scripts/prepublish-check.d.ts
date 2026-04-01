export function assertNodeCompatibleBundle(bundlePath: string, label?: string): void;

export function verifyPackageReadyForPublish(options?: {
	logger?: { log: (message: string) => void };
	expectedVersion?: string;
	smokeInstall?: boolean;
}): Promise<void>;
