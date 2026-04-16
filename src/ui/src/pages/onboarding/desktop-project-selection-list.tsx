import type React from "react";
import { useI18n } from "../../i18n";
import type { ProjectInfo } from "../../lib/tauri-commands";

interface DesktopProjectSelectionListProps {
	projects: ProjectInfo[];
	selectedPaths: Set<string>;
	onToggle: (path: string) => void;
}

const DesktopProjectSelectionList: React.FC<DesktopProjectSelectionListProps> = ({
	projects,
	selectedPaths,
	onToggle,
}) => {
	const { t } = useI18n();

	return (
		<div className="space-y-3">
			{projects.map((project) => {
				const selected = selectedPaths.has(project.path);

				return (
					<label
						key={project.path}
						className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
							selected
								? "border-dash-accent bg-dash-accent-subtle/60"
								: "border-dash-border bg-dash-surface hover:border-dash-accent/40"
						}`}
					>
						<input
							type="checkbox"
							checked={selected}
							onChange={() => onToggle(project.path)}
							className="mt-1 h-4 w-4 accent-[var(--dash-accent)]"
						/>
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<p className="text-sm font-semibold text-dash-text">{project.name}</p>
								{project.hasCkConfig ? (
									<span className="rounded-full border border-dash-accent/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dash-accent">
										{t("desktopOnboardingKitDetected")}
									</span>
								) : null}
							</div>
							<p className="mt-1 break-all text-xs text-dash-text-muted">{project.path}</p>
						</div>
					</label>
				);
			})}
		</div>
	);
};

export default DesktopProjectSelectionList;
