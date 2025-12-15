/**
 * Package installer service - npm/bun package installation
 */

export {
	getPackageVersion,
	installSkillsDependencies,
	isPackageInstalled,
	processPackageInstallations,
	validatePackageName,
	type PackageInstallResult,
} from "./package-installer.js";
export {
	displayInstallErrors,
	checkNeedsSudoPackages,
	hasInstallState,
	type InstallErrorSummary,
} from "./install-error-handler.js";
export {
	getOSInfo,
	DEPENDENCIES,
	commandExists,
	getCommandPath,
} from "./dependency-checker.js";
export {
	detectOS,
	CLAUDE_INSTALLERS,
	PYTHON_INSTALLERS,
	NODEJS_INSTALLERS,
	getInstallerMethods,
	installDependency,
	getManualInstructions,
	type OSInfo,
} from "./dependency-installer.js";
export {
	linkGeminiMcpConfig,
	processGeminiMcpLinking,
	findMcpConfigPath,
	checkExistingGeminiConfig,
	addGeminiToGitignore,
	type GeminiLinkResult,
} from "./gemini-mcp-linker.js";
