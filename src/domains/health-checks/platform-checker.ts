import { constants, access, mkdir, readFile, symlink, unlink, writeFile } from "node:fs/promises";
import { arch, homedir, platform } from "node:os";
import { join, normalize } from "node:path";
import { PathResolver } from "../../shared/path-resolver.js";
import type { CheckResult, Checker } from "./types.js";

const IS_WINDOWS = platform() === "win32";

export class PlatformChecker implements Checker {
	readonly group = "platform" as const;

	async run(): Promise<CheckResult[]> {
		const results: CheckResult[] = [];

		results.push(await this.checkPlatformDetect());
		results.push(await this.checkHomeDirResolution());

		if (IS_WINDOWS) {
			results.push(await this.checkEnvVarExpansion());
		}

		results.push(await this.checkGlobalDirAccess());
		results.push(await this.checkShellDetection());

		if (this.isWSL()) {
			results.push(await this.checkWSLBoundary());
		}

		if (IS_WINDOWS) {
			results.push(await this.checkLongPathSupport());
			results.push(await this.checkSymlinkSupport());
		}

		return results;
	}

	private isWSL(): boolean {
		return !!process.env.WSL_DISTRO_NAME || process.env.WSLENV !== undefined;
	}

	private async checkPlatformDetect(): Promise<CheckResult> {
		const os = platform();
		const architecture = arch();
		const wslDistro = process.env.WSL_DISTRO_NAME;

		let message = `${os} (${architecture})`;
		if (wslDistro) message += ` - WSL: ${wslDistro}`;

		return {
			id: "platform-detect",
			name: "Platform",
			group: "platform",
			priority: "standard",
			status: "info",
			message,
			autoFixable: false,
		};
	}

	private async checkHomeDirResolution(): Promise<CheckResult> {
		const nodeHome = normalize(homedir());
		const envHome = normalize(IS_WINDOWS ? process.env.USERPROFILE || "" : process.env.HOME || "");

		const match = nodeHome === envHome && envHome !== "";

		return {
			id: "home-dir-resolution",
			name: "Home Directory",
			group: "platform",
			priority: "standard",
			status: match ? "pass" : "warn",
			message: match ? nodeHome : `Mismatch: Node=${nodeHome}, Env=${envHome || "not set"}`,
			suggestion: !match ? "homedir() differs from environment. May cause path issues." : undefined,
			autoFixable: false,
		};
	}

	private async checkEnvVarExpansion(): Promise<CheckResult> {
		const userProfile = process.env.USERPROFILE;

		if (!userProfile) {
			return {
				id: "env-var-expansion",
				name: "Env Var Expansion",
				group: "platform",
				priority: "standard",
				status: "fail",
				message: "USERPROFILE not set",
				suggestion: "Environment variable USERPROFILE is not set",
				autoFixable: false,
			};
		}

		// Verify the path actually exists
		try {
			await access(userProfile, constants.F_OK);
			return {
				id: "env-var-expansion",
				name: "Env Var Expansion",
				group: "platform",
				priority: "standard",
				status: "pass",
				message: "USERPROFILE expands correctly",
				details: userProfile,
				autoFixable: false,
			};
		} catch {
			return {
				id: "env-var-expansion",
				name: "Env Var Expansion",
				group: "platform",
				priority: "standard",
				status: "fail",
				message: "USERPROFILE path not accessible",
				details: userProfile,
				suggestion: "Check if USERPROFILE directory exists and is accessible",
				autoFixable: false,
			};
		}
	}

	private async checkGlobalDirAccess(): Promise<CheckResult> {
		const globalDir = PathResolver.getGlobalKitDir();
		const testFile = join(globalDir, ".ck-doctor-access-test");

		try {
			// Ensure directory exists
			await mkdir(globalDir, { recursive: true });

			// Test write
			await writeFile(testFile, "test", "utf-8");

			// Test read
			const content = await readFile(testFile, "utf-8");

			// Cleanup
			await unlink(testFile);

			if (content !== "test") throw new Error("Read mismatch");

			return {
				id: "global-dir-access",
				name: "Global Dir Access",
				group: "platform",
				priority: "critical",
				status: "pass",
				message: "Read/write OK",
				details: globalDir,
				autoFixable: false,
			};
		} catch (error) {
			return {
				id: "global-dir-access",
				name: "Global Dir Access",
				group: "platform",
				priority: "critical",
				status: "fail",
				message: `Access denied: ${error instanceof Error ? error.message : "unknown"}`,
				details: globalDir,
				suggestion: "Check file permissions on ~/.claude/ directory",
				autoFixable: false,
			};
		}
	}

	private async checkShellDetection(): Promise<CheckResult> {
		const shell = process.env.SHELL || process.env.ComSpec || "unknown";

		let shellName = "Unknown";
		if (shell.includes("pwsh") || shell.includes("powershell")) {
			shellName = shell.includes("pwsh") ? "PowerShell Core" : "Windows PowerShell";
		} else if (shell.includes("cmd")) {
			shellName = "Command Prompt";
		} else if (shell.includes("bash")) {
			shellName = "Bash";
		} else if (shell.includes("zsh")) {
			shellName = "Zsh";
		} else if (shell.includes("fish")) {
			shellName = "Fish";
		}

		return {
			id: "shell-detection",
			name: "Shell",
			group: "platform",
			priority: "standard",
			status: "info",
			message: shellName,
			details: shell,
			autoFixable: false,
		};
	}

	private async checkWSLBoundary(): Promise<CheckResult> {
		const cwd = process.cwd();
		const accessingWindows = cwd.startsWith("/mnt/");

		return {
			id: "wsl-boundary",
			name: "WSL Boundary",
			group: "platform",
			priority: "standard",
			status: accessingWindows ? "warn" : "pass",
			message: accessingWindows
				? "Working in Windows filesystem from WSL"
				: "Working in native Linux filesystem",
			details: cwd,
			suggestion: accessingWindows
				? "Performance may be slower. Consider using native Linux paths."
				: undefined,
			autoFixable: false,
		};
	}

	private async checkLongPathSupport(): Promise<CheckResult> {
		try {
			const { execSync } = await import("node:child_process");
			const result = execSync(
				'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem" /v LongPathsEnabled',
				{ encoding: "utf-8", timeout: 2000 },
			);

			const enabled = result.includes("0x1");

			return {
				id: "long-path-support",
				name: "Long Path Support",
				group: "platform",
				priority: "extended",
				status: enabled ? "pass" : "warn",
				message: enabled ? "Enabled" : "Disabled (260 char limit)",
				suggestion: !enabled
					? 'Enable long paths: run as admin: reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem" /v LongPathsEnabled /t REG_DWORD /d 1 /f'
					: undefined,
				autoFixable: false,
			};
		} catch {
			return {
				id: "long-path-support",
				name: "Long Path Support",
				group: "platform",
				priority: "extended",
				status: "info",
				message: "Could not determine (requires admin)",
				autoFixable: false,
			};
		}
	}

	private async checkSymlinkSupport(): Promise<CheckResult> {
		const testDir = PathResolver.getGlobalKitDir();
		const target = join(testDir, ".ck-symlink-test-target");
		const link = join(testDir, ".ck-symlink-test-link");

		try {
			// Ensure directory exists
			await mkdir(testDir, { recursive: true });

			await writeFile(target, "test", "utf-8");
			await symlink(target, link);
			await unlink(link);
			await unlink(target);

			return {
				id: "symlink-support",
				name: "Symlink Support",
				group: "platform",
				priority: "extended",
				status: "pass",
				message: "Symlinks work",
				autoFixable: false,
			};
		} catch (error) {
			// Cleanup on error
			try {
				await unlink(link).catch(() => {});
				await unlink(target).catch(() => {});
			} catch {}

			return {
				id: "symlink-support",
				name: "Symlink Support",
				group: "platform",
				priority: "extended",
				status: "warn",
				message: "Symlinks not available",
				suggestion: "Enable Developer Mode or run as admin for symlink support",
				details: error instanceof Error ? error.message : "unknown error",
				autoFixable: false,
			};
		}
	}
}
