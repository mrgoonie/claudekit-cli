// Re-export all package manager modules
export type { PackageManager, InstallInfo, PmQuery } from "./detector-base.js";
export { isValidPackageName, isValidVersion, execAsync } from "./detector-base.js";

export {
	getNpmQuery,
	getNpmVersionCommand,
	getNpmVersion,
	isNpmAvailable,
	getNpmUpdateCommand,
	getNpmRegistryUrl,
} from "./npm-detector.js";

export {
	getBunQuery,
	getBunVersionCommand,
	getBunVersion,
	isBunAvailable,
	getBunUpdateCommand,
} from "./bun-detector.js";

export {
	getYarnQuery,
	getYarnVersionCommand,
	getYarnVersion,
	isYarnAvailable,
	getYarnUpdateCommand,
} from "./yarn-detector.js";

export {
	getPnpmQuery,
	getPnpmVersionCommand,
	getPnpmVersion,
	isPnpmAvailable,
	getPnpmUpdateCommand,
} from "./pnpm-detector.js";

export {
	detectFromEnv,
	readCachedPm,
	saveCachedPm,
	findOwningPm,
	clearCache,
} from "./detection-core.js";
