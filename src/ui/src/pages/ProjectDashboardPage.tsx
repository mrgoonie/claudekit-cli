/**
 * Project dashboard page - displays project overview and actions
 */
import type React from "react";
import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import ProjectDashboard from "../components/ProjectDashboard";
import { useI18n } from "../i18n";
import type { AppLayoutContext } from "../layouts/app-layout-context";
import { fetchProject } from "../services/api";
import type { Project } from "../types";

const ProjectDashboardPage: React.FC = () => {
	const { t } = useI18n();
	const { project } = useOutletContext<AppLayoutContext>();
	const [detailedProject, setDetailedProject] = useState<Project | null>(null);

	useEffect(() => {
		if (!project?.id) {
			setDetailedProject(null);
			return;
		}

		setDetailedProject(null);
		let cancelled = false;
		void fetchProject(project.id)
			.then((nextProject) => {
				if (!cancelled) {
					setDetailedProject(nextProject);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setDetailedProject(null);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [project?.id]);

	if (!project) {
		return (
			<div className="flex flex-col items-center justify-center h-full space-y-4 opacity-50">
				<div className="w-16 h-16 rounded-full bg-dash-surface border border-dash-border flex items-center justify-center">
					<span className="text-2xl text-dash-text-muted">📂</span>
				</div>
				<p className="text-lg text-dash-text-secondary font-bold">{t("selectProject")}</p>
			</div>
		);
	}

	const projectForView = detailedProject?.id === project.id ? detailedProject : project;

	return <ProjectDashboard project={projectForView} />;
};

export default ProjectDashboardPage;
