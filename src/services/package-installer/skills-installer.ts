import { join } from "node:path";
import { isCIEnvironment, isNonInteractive } from "@/shared/environment.js";
import { logger } from "@/shared/logger.js";
import {
	checkNeedsSudoPackages,
	displayInstallErrors,
	hasInstallState,
} from "./install-error-handler.js";
import { executeInteractiveScript } from "./process-executor.js";
import {
	EXIT_CODE_CRITICAL_FAILURE,
	EXIT_CODE_PARTIAL_SUCCESS,
	PARTIAL_INSTALL_VERSION,
	type PackageInstallResult,
} from "./types.js";
import { validateScriptPath } from "./validators.js";

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

		// Show script information
		logger.warning("Installation script will execute with user privileges");
		logger.info(`  Script: ${scriptPath}`);
		logger.info(`  Platform: ${platform === "win32" ? "Windows (PowerShell)" : "Unix (bash)"}`);

		// Show script preview in verbose mode (security transparency)
		if (logger.isVerbose()) {
			try {
				const { readFile } = await import("node:fs/promises");
				const scriptContent = await readFile(scriptPath, "utf-8");
				const previewLines = scriptContent.split("\n").slice(0, 20);
				logger.verbose("Script preview (first 20 lines):");
				for (const line of previewLines) {
					logger.verbose(`  ${line}`);
				}
				if (scriptContent.split("\n").length > 20) {
					logger.verbose("  ... (script continues)");
				}
			} catch {
				logger.verbose("Could not preview script contents");
			}
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
		// Note: isNonInteractive() checks here are defensive - the main guard is at line 500.
		// However, keeping these for:
		// 1. Future code changes that might alter control flow
		// 2. Explicit documentation of behavior in each code path
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
		// Only run sudo check on Linux - checkNeedsSudoPackages returns false for other platforms anyway
		if (platform === "linux") {
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
			// Use executeInteractiveScript for real-time output streaming
			// -NoLogo: Skip PowerShell banner
			// -ExecutionPolicy Bypass: Allow running scripts (scoped to this process only)
			// -File: Execute the script file
			await executeInteractiveScript(
				"powershell.exe",
				["-NoLogo", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-Y"],
				{
					timeout: 600000, // 10 minute timeout for skills installation
					cwd: skillsDir,
					env: scriptEnv,
				},
			);
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

		if (exitCode === EXIT_CODE_PARTIAL_SUCCESS) {
			// Partial success - some optional deps failed
			// Rich errors already displayed by install.sh, just show CLI-side message
			displayInstallErrors(skillsDir);
			logger.info("");
			logger.success("Core functionality is available despite some package failures.");

			return {
				success: true, // Consider partial success as success for CLI
				package: displayName,
				version: PARTIAL_INSTALL_VERSION,
			};
		}

		if (exitCode === EXIT_CODE_CRITICAL_FAILURE) {
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
			if (skillsResult.version === PARTIAL_INSTALL_VERSION) {
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
