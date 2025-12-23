import type { Project } from "@/types";

interface HeaderProps {
	project: Project | null;
	isConnected: boolean;
	onOpenConfig: () => void;
	theme: "light" | "dark";
	onToggleTheme: () => void;
}

export default function Header({
	project,
	isConnected,
	onOpenConfig,
	theme,
	onToggleTheme,
}: HeaderProps) {
	return (
		<header className="h-14 border-b border-dash-border bg-dash-surface flex items-center justify-between px-6">
			<div className="flex items-center gap-4">
				<h1 className="text-lg font-semibold">ClaudeKit Dashboard</h1>
				{project && <span className="text-sm text-dash-text-secondary">{project.name}</span>}
			</div>

			<div className="flex items-center gap-4">
				<div className="flex items-center gap-2">
					<span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
					<span className="text-sm text-dash-text-muted">
						{isConnected ? "Connected" : "Disconnected"}
					</span>
				</div>

				<button
					type="button"
					onClick={onOpenConfig}
					className="px-3 py-1.5 text-sm bg-dash-accent text-white rounded hover:bg-dash-accent-hover transition-colors"
				>
					Edit Config
				</button>

				<button
					type="button"
					onClick={onToggleTheme}
					className="p-2 rounded hover:bg-dash-surface-hover transition-colors"
					aria-label="Toggle theme"
				>
					{theme === "dark" ? "🌙" : "☀️"}
				</button>
			</div>
		</header>
	);
}
