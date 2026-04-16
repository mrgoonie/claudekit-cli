import type { Project } from "../types";

export interface AppLayoutContext {
	project: Project | null;
	isConnected: boolean;
	theme: "light" | "dark";
	onToggleTheme: () => void;
	reloadProjects?: () => Promise<void>;
	dismissDesktopOnboarding?: () => void;
}
