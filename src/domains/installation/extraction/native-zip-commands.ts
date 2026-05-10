export interface NativeZipCommand {
	label: string;
	command: string;
	args: string[];
}

export const NATIVE_EXTRACT_TIMEOUT_MS = 120_000;

export function getNativeZipCommands(
	archivePath: string,
	destDir: string,
	platformName: NodeJS.Platform = process.platform,
): NativeZipCommand[] {
	if (platformName === "darwin") {
		return [
			{
				label: "native unzip",
				command: "unzip",
				args: ["-o", "-q", archivePath, "-d", destDir],
			},
		];
	}

	if (platformName === "win32") {
		return [
			{
				label: "Windows tar.exe",
				command: "tar.exe",
				args: ["-xf", archivePath, "-C", destDir],
			},
			{
				label: "PowerShell Expand-Archive",
				command: "powershell.exe",
				args: [
					"-NoProfile",
					"-NonInteractive",
					"-Command",
					// Extra args after -Command are available as $args inside PowerShell,
					// avoiding unsafe path interpolation and shell quoting problems.
					"Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force",
					archivePath,
					destDir,
				],
			},
		];
	}

	return [];
}
