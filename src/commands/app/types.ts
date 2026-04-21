import type { ConfigUIOptions } from "@/commands/config/types.js";
import type {
	DesktopInstallHealth,
	DesktopUpdateStatus,
} from "@/domains/desktop/desktop-binary-manager.js";
import type { DesktopChannel } from "@/domains/desktop/desktop-release-service.js";
import type { DesktopUninstallResult } from "@/domains/desktop/desktop-uninstaller.js";

export interface AppCommandOptions {
	web?: boolean;
	update?: boolean;
	path?: boolean;
	uninstall?: boolean;
	dev?: boolean;
	stable?: boolean;
}

export interface AppCommandDependencies {
	launchWeb?: (options?: ConfigUIOptions) => Promise<void>;
	getBinaryPath?: () => string | null;
	getInstallPath?: () => string;
	getUpdateStatus?: (opts?: {
		channel?: DesktopChannel;
		binaryPath?: string | null;
	}) => Promise<DesktopUpdateStatus>;
	getInstallHealth?: (opts?: { binaryPath?: string | null }) => Promise<DesktopInstallHealth>;
	downloadBinary?: (opts?: { channel?: DesktopChannel }) => Promise<string>;
	installBinary?: (downloadPath: string) => Promise<string>;
	launchBinary?: (binaryPath: string) => void;
	uninstallBinary?: () => Promise<DesktopUninstallResult>;
	info?: (message: string) => void;
	success?: (message: string) => void;
	printLine?: (message: string) => void;
}
