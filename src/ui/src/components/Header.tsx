/**
 * App header with project info, sync status, and controls
 */
import type React from "react";
import { useI18n } from "../i18n";
import type { Project } from "../types";
import LanguageSwitcher from "./LanguageSwitcher";

interface HeaderProps {
	project: Project | null;
	isConnected: boolean;
	theme: "light" | "dark";
	onToggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ project, isConnected, theme, onToggleTheme }) => {
	const { t } = useI18n();

	return (
		<header className="sticky top-0 z-10 bg-dash-surface/80 backdrop-blur-md border-b border-dash-border h-16 flex items-center justify-between px-6 shrink-0 transition-colors duration-300">
			<div className="flex items-center gap-4 min-w-0">
				{project ? (
					<div className="flex flex-col min-w-0">
						<div className="flex items-center gap-2">
							<h2 className="text-sm font-bold text-dash-text truncate">{project.name}</h2>
							<span className="px-1.5 py-0.5 text-[10px] font-bold bg-dash-bg text-dash-text-muted rounded-md border border-dash-border uppercase tracking-widest">
								{project.kitType}
							</span>
						</div>
						<p className="text-[11px] text-dash-text-muted truncate mono opacity-80 italic">
							{project.path}
						</p>
					</div>
				) : (
					<h2 className="text-sm font-bold text-dash-text">{t("controlCenter")}</h2>
				)}
			</div>

			<div className="flex items-center gap-4">
				<div className="flex items-center gap-2 px-3 py-1 bg-dash-bg rounded-full border border-dash-border">
					<div
						className={`w-2 h-2 rounded-full ${isConnected ? "bg-dash-accent shadow-[0_0_8px_var(--dash-accent-glow)]" : "bg-red-500"}`}
					/>
					<span className="text-[10px] font-bold text-dash-text-muted uppercase tracking-widest">
						{isConnected ? t("sync") : t("offline")}
					</span>
				</div>

				<LanguageSwitcher />

				<button
					onClick={onToggleTheme}
					className="w-8 h-8 rounded-lg flex items-center justify-center text-dash-text-muted hover:bg-dash-surface-hover transition-colors border border-transparent hover:border-dash-border"
					title={theme === "dark" ? t("switchToLight") : t("switchToDark")}
				>
					{theme === "dark" ? (
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="w-4 h-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z"
							/>
						</svg>
					) : (
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="w-4 h-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
							/>
						</svg>
					)}
				</button>
			</div>
		</header>
	);
};

export default Header;
