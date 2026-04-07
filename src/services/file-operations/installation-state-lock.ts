import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import { ensureFile, pathExists, realpath } from "fs-extra";
import lockfile from "proper-lockfile";

const LOCK_OPTIONS = {
	realpath: false,
	retries: { retries: 5, minTimeout: 100, maxTimeout: 1000 },
	stale: 60000,
};

async function getCanonicalInstallationRoot(installationRoot: string): Promise<string> {
	if (await pathExists(installationRoot)) {
		return resolve(await realpath(installationRoot));
	}

	return resolve(installationRoot);
}

async function getInstallationStateLockPath(installationRoot: string): Promise<string> {
	const normalizedRoot = await getCanonicalInstallationRoot(installationRoot);
	const hash = createHash("sha256").update(normalizedRoot).digest("hex").slice(0, 16);
	return join(PathResolver.getConfigDir(false), "locks", `installation-${hash}.lock`);
}

export async function acquireInstallationStateLock(
	installationRoot: string,
): Promise<() => Promise<void>> {
	const lockPath = await getInstallationStateLockPath(installationRoot);
	await ensureFile(lockPath);

	const release = await lockfile.lock(lockPath, LOCK_OPTIONS);
	logger.debug(`Acquired installation state lock: ${lockPath}`);

	return async () => {
		await release();
		logger.debug(`Released installation state lock: ${lockPath}`);
	};
}
