import { exec, execFile, spawn } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { isCIEnvironment, isNonInteractive } from "./environment.js";
import {
	checkNeedsSudoPackages,
	displayInstallErrors,
	hasInstallState,
} from "./install-error-handler.js";
import { logger } from "./logger.js";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

/**
 * Execute a command with real-time output streaming
 *
 * Unlike execFile which buffers output, this uses spawn to stream stdout/stderr
 * directly to the user's terminal in real-time. Stdin is closed to prevent the
 * script from blocking on input (we pass --yes flags instead).
 *
 * @param command - The command to execute
 * @param args - Command arguments
 * @param options - Spawn options (timeout, cwd, env, etc.)
 * @returns Promise that resolves when command completes successfully
 */
function executeInteractiveScript(
	command: string,
	args: string[],
	options?: { timeout?: number; cwd?: string; env?: NodeJS.ProcessEnv },
): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			// Close stdin to prevent script from reading input (we pass --yes flag instead)
			// Stream stdout/stderr to user terminal for real-time progress
			stdio: ["ignore", "inherit", "inherit"],
			cwd: options?.cwd,
			env: options?.env || process.env,
		});

		// Handle timeout
		let timeoutId: NodeJS.Timeout | undefined;
		if (options?.timeout) {
			timeoutId = setTimeout(() => {
				child.kill("SIGTERM");
				reject(new Error(`Command timed out after ${options.timeout}ms`));
			}, options.timeout);
		}

		// Handle process completion
		child.on("exit", (code, signal) => {
			if (timeoutId) clearTimeout(timeoutId);

			if (signal) {
				reject(new Error(`Command terminated by signal ${signal}`));
			} else if (code !== 0) {
				reject(new Error(`Command exited with code ${code}`));
			} else {
				resolve();
			}
		});

		// Handle process errors
		child.on("error", (error) => {
			if (timeoutId) clearTimeout(timeoutId);
			reject(error);
		});
	});
}

/**
 * Get platform-specific npm command
 */
function getNpmCommand(): string {
	const platform = process.platform;
	return platform === "win32" ? "npm.cmd" : "npm";
}

// NPM package name validation regex (from npm spec)
const NPM_PACKAGE_REGEX = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

/**
 * Validate npm package name to prevent command injection
 */
export function validatePackageName(packageName: string): void {
	if (!packageName || typeof packageName !== "string") {
		throw new Error("Package name must be a non-empty string");
	}

	if (packageName.length > 214) {
		throw new Error("Package name too long");
	}

	if (!NPM_PACKAGE_REGEX.test(packageName)) {
		throw new Error("Invalid package name");
	}
}

export interface PackageInstallResult {
	success: boolean;
	package: string;
	version?: string;
	error?: string;
}

/**
 * Check if OpenCode CLI is installed and accessible in PATH
 */
export async function isOpenCodeInstalled(): Promise<boolean> {
	try {
		await execAsync("opencode --version", { timeout: 5000 });
		return true;
	} catch {
		return false;
	}
}

/**
 * Check if Google Gemini CLI is installed and accessible in PATH
 * Note: gemini --version can be slow (2-3s), so we use a longer timeout
 */
export async function isGeminiInstalled(): Promise<boolean> {
	try {
		await execAsync("gemini --version", { timeout: 10000 });
		return true;
	} catch {
		return false;
	}
}

/**
 * Check if a package is globally installed
 */
export async function isPackageInstalled(packageName: string): Promise<boolean> {
	validatePackageName(packageName);

	// Skip network calls in CI environment - assume packages are not installed
	if (isCIEnvironment()) {
		logger.info(`CI environment detected: skipping network check for ${packageName}`);
		return false;
	}

	// Special handling for npm itself - use npm --version as basic check
	if (packageName === "npm") {
		try {
			await execAsync(`${getNpmCommand()} --version`, { timeout: 3000 });
			return true;
		} catch {
			return false;
		}
	}

	// For other packages, use faster and more reliable detection methods
	try {
		// Method 1: Quick check with npm view (fast for non-existent packages)
		// This command is much faster for packages that don't exist
		await execAsync(`${getNpmCommand()} view ${packageName} version`, { timeout: 3000 });

		// Package exists in npm registry, now check if it's installed globally
		try {
			// Method 2: Check if globally installed with shorter timeout
			const { stdout } = await execAsync(`${getNpmCommand()} list -g ${packageName} --depth=0`, {
				timeout: 3000,
			});

			// Check if package name appears in output (case-insensitive)
			const caseInsensitiveMatch = stdout.toLowerCase().includes(packageName.toLowerCase());
			if (caseInsensitiveMatch) {
				return true;
			}

			// Method 3: Try JSON format for more reliable parsing
			const { stdout: jsonOutput } = await execAsync(
				`${getNpmCommand()} list -g ${packageName} --depth=0 --json`,
				{
					timeout: 3000,
				},
			);

			// Parse JSON to check if package exists
			const packageList = JSON.parse(jsonOutput);
			return packageList.dependencies?.[packageName] || false;
		} catch {
			// Package exists in registry but not installed globally
			return false;
		}
	} catch {
		// npm view failed, package doesn't exist in registry
		return false;
	}
}

/**
 * Get package version if installed
 */
export async function getPackageVersion(packageName: string): Promise<string | null> {
	validatePackageName(packageName);

	// Skip network calls in CI environment
	if (isCIEnvironment()) {
		logger.info(`CI environment detected: skipping version check for ${packageName}`);
		return null;
	}

	// Special handling for npm itself - use npm --version directly
	if (packageName === "npm") {
		try {
			const { stdout } = await execAsync(`${getNpmCommand()} --version`, { timeout: 3000 });
			return stdout.trim();
		} catch {
			return null;
		}
	}

	// First quickly check if package exists in npm registry
	try {
		await execAsync(`${getNpmCommand()} view ${packageName} version`, { timeout: 3000 });
	} catch {
		// Package doesn't exist exist in npm registry
		return null;
	}

	try {
		// Method 1: Try JSON format for reliable parsing with shorter timeout
		const { stdout: jsonOutput } = await execAsync(
			`${getNpmCommand()} list -g ${packageName} --depth=0 --json`,
			{
				timeout: 3000,
			},
		);

		const packageList = JSON.parse(jsonOutput);
		if (packageList.dependencies?.[packageName]) {
			return packageList.dependencies[packageName].version || null;
		}
	} catch {
		// JSON parsing failed, try text method as fallback
	}

	try {
		// Method 2: Fallback to text parsing with improved regex and shorter timeout
		const { stdout } = await execAsync(`${getNpmCommand()} list -g ${packageName} --depth=0`, {
			timeout: 3000,
		});

		// Multiple regex patterns to handle different output formats
		const patterns = [
			// Standard format: packageName@version
			new RegExp(`${packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}@([^\\s\\n]+)`),
			// Format with empty: └── packageName@1.0.0
			new RegExp(
				`${packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}@([0-9]+\\.[0-9]+\\.[0-9]+(?:-[\\w.-]+)?)`,
			),
		];

		for (const pattern of patterns) {
			const match = stdout.match(pattern);
			if (match?.[1]) {
				return match[1].trim();
			}
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Install a package globally using npm
 */
export async function installPackageGlobally(
	packageName: string,
	packageDisplayName?: string,
): Promise<PackageInstallResult> {
	const displayName = packageDisplayName || packageName;

	// Validate package name to prevent command injection
	validatePackageName(packageName);

	try {
		logger.info(`Installing ${displayName} globally...`);

		await execAsync(`${getNpmCommand()} install -g ${packageName}`, {
			timeout: 120000, // 2 minute timeout for npm install
		});

		// Check if installation was successful
		const isInstalled = await isPackageInstalled(packageName);
		if (!isInstalled) {
			return {
				success: false,
				package: displayName,
				error: "Installation completed but package not found",
			};
		}

		const version = await getPackageVersion(packageName);

		logger.success(`${displayName} ${version ? `v${version} ` : ""}installed successfully`);

		return {
			success: true,
			package: displayName,
			version: version || undefined,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		logger.error(`Failed to install ${displayName}: ${errorMessage}`);

		return {
			success: false,
			package: displayName,
			error: errorMessage,
		};
	}
}

/**
 * Install OpenCode CLI package using install script
 */
export async function installOpenCode(): Promise<PackageInstallResult> {
	const displayName = "OpenCode CLI";

	// Skip network calls in CI environment
	if (isCIEnvironment()) {
		logger.info("CI environment detected: skipping OpenCode installation");
		return {
			success: false,
			package: displayName,
			error: "Installation skipped in CI environment",
		};
	}

	try {
		logger.info(`Installing ${displayName}...`);

		// Download and execute the official install script safely
		const { unlink } = await import("node:fs/promises");
		const { join } = await import("node:path");
		const { tmpdir } = await import("node:os");

		const tempScriptPath = join(tmpdir(), "opencode-install.sh");

		try {
			// Download the script first using execFile (no shell interpretation)
			logger.info("Downloading OpenCode installation script...");
			await execFileAsync("curl", ["-fsSL", "https://opencode.ai/install", "-o", tempScriptPath], {
				timeout: 30000, // 30 second timeout for download
			});

			// Make the script executable using execFile
			await execFileAsync("chmod", ["+x", tempScriptPath], {
				timeout: 5000, // 5 second timeout for chmod
			});

			// Execute the downloaded script using execFile
			logger.info("Executing OpenCode installation script...");
			await execFileAsync("bash", [tempScriptPath], {
				timeout: 120000, // 2 minute timeout for installation
			});
		} finally {
			// Clean up the temporary script
			try {
				await unlink(tempScriptPath);
			} catch {
				// Ignore cleanup errors
			}
		}

		// Check if installation was successful by trying to run opencode
		const installed = await isOpenCodeInstalled();
		if (installed) {
			logger.success(`${displayName} installed successfully`);
			return {
				success: true,
				package: displayName,
			};
		}
		return {
			success: false,
			package: displayName,
			error: "Installation completed but opencode command not found in PATH",
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		logger.error(`Failed to install ${displayName}: ${errorMessage}`);

		return {
			success: false,
			package: displayName,
			error: errorMessage,
		};
	}
}

/**
 * Install Google Gemini CLI package
 */
export async function installGemini(): Promise<PackageInstallResult> {
	return installPackageGlobally("@google/gemini-cli", "Google Gemini CLI");
}

/**
 * Check and install packages based on user preferences
 */
export async function processPackageInstallations(
	shouldInstallOpenCode: boolean,
	shouldInstallGemini: boolean,
): Promise<{
	opencode?: PackageInstallResult;
	gemini?: PackageInstallResult;
}> {
	const results: {
		opencode?: PackageInstallResult;
		gemini?: PackageInstallResult;
	} = {};

	if (shouldInstallOpenCode) {
		// Check if opencode is available in PATH
		const alreadyInstalled = await isOpenCodeInstalled();
		if (alreadyInstalled) {
			logger.info("OpenCode CLI already installed");
			results.opencode = {
				success: true,
				package: "OpenCode CLI",
			};
		} else {
			results.opencode = await installOpenCode();
		}
	}

	if (shouldInstallGemini) {
		const alreadyInstalled = await isGeminiInstalled();
		if (alreadyInstalled) {
			logger.info("Google Gemini CLI already installed");
			results.gemini = {
				success: true,
				package: "Google Gemini CLI",
			};
		} else {
			results.gemini = await installGemini();
		}
	}

	return results;
}

/**
 * Validate script path is safe before execution
 * Prevents path traversal and shell injection attacks
 */
function validateScriptPath(skillsDir: string, scriptPath: string): void {
	const skillsDirResolved = resolve(skillsDir);
	const scriptPathResolved = resolve(scriptPath);

	// Must be within skills directory (case-insensitive on Windows)
	const isWindows = process.platform === "win32";
	const skillsDirNormalized = isWindows ? skillsDirResolved.toLowerCase() : skillsDirResolved;
	const scriptPathNormalized = isWindows ? scriptPathResolved.toLowerCase() : scriptPathResolved;

	if (!scriptPathNormalized.startsWith(skillsDirNormalized)) {
		throw new Error(`Script path outside skills directory: ${scriptPath}`);
	}

	// No shell-breaking characters that could enable injection
	const dangerousChars = ['"', "'", "`", "$", ";", "&", "|", "\n", "\r", "\0"];
	for (const char of dangerousChars) {
		if (scriptPath.includes(char)) {
			throw new Error(`Script path contains unsafe character: ${char}`);
		}
	}

	logger.debug(`Script path validated: ${scriptPath}`);
}

/**
 * Install skills dependencies using the installation script
 *
 * SECURITY: This function executes installation scripts with proper safeguards:
 * - Path validation to prevent traversal attacks
 * - Script preview before execution
 * - Explicit user consent required
 * - Respects PowerShell execution policies (no bypass without warning)
 */
export async function installSkillsDependencies(skillsDir: string): Promise<PackageInstallResult> {
	const displayName = "Skills Dependencies";

	// Skip in CI environment
	if (isCIEnvironment()) {
		logger.info("CI environment detected: skipping skills installation");
		return {
			success: false,
			package: displayName,
			error: "Installation skipped in CI environment",
		};
	}

	// Check if running in non-interactive mode
	if (isNonInteractive()) {
		logger.info("Running in non-interactive mode. Skipping skills installation.");
		logger.info("See INSTALLATION.md for manual installation instructions.");
		return {
			success: false,
			package: displayName,
			error: "Skipped in non-interactive mode",
		};
	}

	try {
		const { existsSync } = await import("node:fs");
		const { readFile } = await import("node:fs/promises");
		const { join } = await import("node:path");
		const clack = await import("@clack/prompts");

		// Determine the correct installation script based on platform
		const platform = process.platform;
		const scriptName = platform === "win32" ? "install.ps1" : "install.sh";
		const scriptPath = join(skillsDir, scriptName);

		// Validate path safety
		try {
			validateScriptPath(skillsDir, scriptPath);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			logger.error(`Invalid script path: ${errorMessage}`);
			return {
				success: false,
				package: displayName,
				error: `Path validation failed: ${errorMessage}`,
			};
		}

		// Check if the installation script exists
		if (!existsSync(scriptPath)) {
			logger.warning(`Skills installation script not found: ${scriptPath}`);
			logger.info("");
			logger.info("📖 Manual Installation Instructions:");
			logger.info(`  See: ${join(skillsDir, "INSTALLATION.md")}`);
			logger.info("");
			logger.info("Quick start:");
			logger.info("  cd .claude/skills/ai-multimodal/scripts");
			logger.info("  pip install -r requirements.txt");
			return {
				success: false,
				package: displayName,
				error: "Installation script not found",
			};
		}

		// Show script information and preview
		logger.warning("⚠️  Installation script will execute with user privileges:");
		logger.info(`  Script: ${scriptPath}`);
		logger.info(`  Platform: ${platform === "win32" ? "Windows (PowerShell)" : "Unix (bash)"}`);
		logger.info("");

		// Preview script contents (first 20 lines or comments)
		try {
			const scriptContent = await readFile(scriptPath, "utf-8");
			const previewLines = scriptContent.split("\n").slice(0, 20);

			logger.info("Script preview (first 20 lines):");
			for (const line of previewLines) {
				logger.info(`  ${line}`);
			}
			logger.info("");

			if (scriptContent.split("\n").length > 20) {
				logger.info("  ... (script continues, see full file for details)");
				logger.info("");
			}
		} catch (error) {
			logger.warning("Could not preview script contents");
			logger.info("");
		}

		// Explicit user confirmation
		const shouldProceed = await clack.confirm({
			message: "Execute this installation script?",
			initialValue: false, // Default to NO for safety
		});

		if (clack.isCancel(shouldProceed) || !shouldProceed) {
			logger.info("Installation cancelled by user");
			logger.info("");
			logger.info("📖 Manual Installation Instructions:");
			logger.info(
				`  ${platform === "win32" ? `powershell -File "${scriptPath}"` : `bash ${scriptPath}`}`,
			);
			logger.info("");
			logger.info("Or see complete guide:");
			logger.info(`  ${join(skillsDir, "INSTALLATION.md")}`);
			return {
				success: false,
				package: displayName,
				error: "Cancelled by user",
			};
		}

		logger.info(`Installing ${displayName}...`);
		logger.info(`Running: ${scriptPath}`);

		// Build script arguments
		const scriptArgs = ["--yes"];

		// Check for existing state file (for resume)
		if (hasInstallState(skillsDir)) {
			if (isNonInteractive()) {
				// Auto-resume in non-interactive mode (CI, scripts, piped input)
				logger.info("Resuming previous installation (non-interactive mode)...");
				scriptArgs.push("--resume");
			} else {
				const shouldResume = await clack.confirm({
					message: "Previous installation was interrupted. Resume?",
					initialValue: true,
				});
				if (!clack.isCancel(shouldResume) && shouldResume) {
					scriptArgs.push("--resume");
					logger.info("Resuming previous installation...");
				}
			}
		}

		// Check if on Linux and system packages are missing
		if (platform !== "win32") {
			const needsSudo = await checkNeedsSudoPackages();

			if (needsSudo) {
				if (isNonInteractive()) {
					// Skip sudo packages in non-interactive mode (no password prompt)
					logger.info("Skipping system packages in non-interactive mode.");
					logger.info("Install manually: sudo apt-get install -y ffmpeg imagemagick");
				} else {
					// Show what needs sudo
					logger.info("");
					logger.info("System packages (requires sudo):");
					logger.info("  • ffmpeg - Video/audio processing");
					logger.info("  • imagemagick - Image editing & conversion");
					logger.info("");

					const shouldInstallSudo = await clack.confirm({
						message: "Install these packages? (requires sudo password)",
						initialValue: true,
					});

					if (!clack.isCancel(shouldInstallSudo) && shouldInstallSudo) {
						scriptArgs.push("--with-sudo");
					} else {
						logger.info("Skipping system packages. Install manually later:");
						logger.info("  sudo apt-get install -y ffmpeg imagemagick");
					}
				}
			}
		}

		// Run the installation script with real-time output streaming
		// Using spawn with stdio: 'inherit' instead of execFile to show progress
		// Set NON_INTERACTIVE=1 as secondary safety to skip all prompts
		const scriptEnv = {
			...process.env,
			NON_INTERACTIVE: "1",
		};

		if (platform === "win32") {
			// Windows: Check if ExecutionPolicy bypass is needed
			logger.warning("⚠️  Windows: Respecting system PowerShell execution policy");
			logger.info("   If the script fails, you may need to set execution policy:");
			logger.info("   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser");
			logger.info("");

			// Use executeInteractiveScript for real-time output streaming
			await executeInteractiveScript("powershell", ["-File", scriptPath, "-Y"], {
				timeout: 600000, // 10 minute timeout for skills installation
				cwd: skillsDir,
				env: scriptEnv,
			});
		} else {
			// Linux/macOS: Run bash script with real-time output
			await executeInteractiveScript("bash", [scriptPath, ...scriptArgs], {
				timeout: 600000, // 10 minute timeout for skills installation
				cwd: skillsDir,
				env: scriptEnv,
			});
		}

		logger.success(`${displayName} installed successfully`);

		return {
			success: true,
			package: displayName,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";

		// Parse exit code from error message
		const exitCodeMatch = errorMessage.match(/exited with code (\d+)/);
		const exitCode = exitCodeMatch ? Number.parseInt(exitCodeMatch[1], 10) : 1;

		if (exitCode === 2) {
			// Partial success - some optional deps failed
			// Rich errors already displayed by install.sh, just show CLI-side message
			displayInstallErrors(skillsDir);
			logger.info("");
			logger.success("Core functionality is available despite some package failures.");

			return {
				success: true, // Consider partial success as success for CLI
				package: displayName,
				version: "partial",
			};
		}

		if (exitCode === 1) {
			// Critical failure - display rich error info
			displayInstallErrors(skillsDir);
			logger.error("");
			logger.error("Skills installation failed. See above for details.");
			return {
				success: false,
				package: displayName,
				error: "Critical dependencies missing",
			};
		}

		// Unexpected error
		logger.error(`Unexpected error: ${errorMessage}`);

		// Provide manual installation fallback
		logger.info("");
		logger.info("📖 Manual Installation Instructions:");
		logger.info("");
		logger.info("See complete guide:");
		const { join } = await import("node:path");
		logger.info(`  cat ${join(skillsDir, "INSTALLATION.md")}`);
		logger.info("");
		logger.info("Quick start:");
		logger.info("  cd .claude/skills/ai-multimodal/scripts");
		logger.info("  pip install -r requirements.txt");
		logger.info("");
		logger.info("System tools (optional):");
		logger.info("  macOS: brew install ffmpeg imagemagick");
		logger.info("  Linux: sudo apt-get install ffmpeg imagemagick");
		logger.info("  Node.js: npm install -g pnpm wrangler repomix");

		return {
			success: false,
			package: displayName,
			error: errorMessage,
		};
	}
}

/**
 * Handle skills installation with proper error handling and user feedback
 *
 * This is a wrapper around installSkillsDependencies that handles:
 * - Logging success/failure messages
 * - Providing manual installation instructions on failure
 * - Handling partial success (exit code 2)
 * - Consistent error handling across commands
 *
 * @param skillsDir - Absolute path to the skills directory
 */
export async function handleSkillsInstallation(skillsDir: string): Promise<void> {
	try {
		const skillsResult = await installSkillsDependencies(skillsDir);

		if (skillsResult.success) {
			if (skillsResult.version === "partial") {
				logger.success("Skills core dependencies installed (some optional packages skipped)");
			} else {
				logger.success("Skills dependencies installed successfully");
			}
		} else {
			// Rich errors already displayed in installSkillsDependencies
			logger.warning(`Skills installation incomplete: ${skillsResult.error || "Unknown error"}`);
			logger.info("You can install skills dependencies manually. See INSTALLATION.md");
		}
	} catch {
		// Rich errors already displayed
		logger.warning("Skills installation failed");
		logger.info("You can install skills dependencies manually later");
	}
}
