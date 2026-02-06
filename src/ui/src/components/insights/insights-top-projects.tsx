/**
 * Ranked list of most active projects
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

export function InsightsTopProjects({ projects }: InsightsTopProjectsProps) {
	const { t } = useI18n();

	const maxCount = Math.max(1, ...projects.map((p) => p.interactionCount));

	return (
		<div className="bg-dash-surface border border-dash-border rounded-lg p-4">
			<h3 className="text-sm font-medium text-dash-text-secondary mb-3">
				{t("insightsTopProjects")}
			</h3>
			{projects.length === 0 ? (
				<p className="text-sm text-dash-text-muted">{t("insightsNoData")}</p>
			) : (
				<div className="space-y-2">
					{projects.map((project, i) => {
						const barWidth = (project.interactionCount / maxCount) * 100;
						return (
							<div key={project.path} className="flex items-center gap-3">
								<span className="text-xs text-dash-text-muted w-4 text-right shrink-0">
									{i + 1}
								</span>
								<div className="flex-1 min-w-0">
									<div className="flex items-center justify-between mb-1">
										<span className="text-sm text-dash-text truncate" title={project.path}>
											{project.name}
										</span>
										<span className="text-xs text-dash-text-muted ml-2 shrink-0">
											{project.interactionCount}
										</span>
									</div>
									<div className="h-1.5 bg-dash-surface-hover rounded-full overflow-hidden">
										<div
											className="h-full rounded-full"
											style={{
												width: `${barWidth}%`,
												backgroundColor: "var(--dash-accent)",
												opacity: 0.8,
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
