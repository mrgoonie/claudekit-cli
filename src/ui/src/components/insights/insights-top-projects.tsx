/**
 * Ranked list of most active projects with folder icon and progress bars
 */
import { useI18n } from "../../i18n";

interface TopProject {
	name: string;
	path: string;
	interactionCount: number;
}

interface InsightsTopProjectsProps {
	projects: TopProject[];
}

function FolderIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			className="shrink-0 text-dash-accent"
		>
			<path
				d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

export function InsightsTopProjects({ projects }: InsightsTopProjectsProps) {
	const { t } = useI18n();

	const maxCount = Math.max(1, ...projects.map((p) => p.interactionCount));

	return (
		<div className="bg-dash-surface border border-dash-border rounded-lg p-4 h-full flex flex-col">
			<h3 className="text-sm font-medium text-dash-text-secondary mb-3 shrink-0">
				{t("insightsTopProjects")}
			</h3>
			{projects.length === 0 ? (
				<p className="text-sm text-dash-text-muted">{t("insightsNoData")}</p>
			) : (
				<div className="space-y-2.5">
					{projects.map((project, i) => {
						const barWidth = (project.interactionCount / maxCount) * 100;
						return (
							<div key={project.path} className="flex items-center gap-2.5">
								<span className="text-xs text-dash-text-muted w-4 text-right shrink-0 tabular-nums">
									{i + 1}
								</span>
								<FolderIcon />
								<div className="flex-1 min-w-0">
									<div className="flex items-center justify-between mb-1">
										<span className="text-sm text-dash-text truncate" title={project.path}>
											{project.name}
										</span>
										<span className="text-xs text-dash-text-muted ml-2 shrink-0 tabular-nums font-medium">
											{project.interactionCount}
										</span>
									</div>
									<div className="h-1.5 bg-dash-surface-hover rounded-full overflow-hidden">
										<div
											className="h-full rounded-full transition-all duration-300"
											style={{
												width: `${barWidth}%`,
												backgroundColor: "var(--dash-accent)",
												opacity: 0.75,
											}}
										/>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
