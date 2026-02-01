/**
 * Project dashboard page - displays project overview and actions
 */
import type React from "react";
import { useOutletContext } from "react-router-dom";
import ProjectDashboard from "../components/ProjectDashboard";
import { useI18n } from "../i18n";
import type { Project } from "../types";

interface OutletContext {
	project: Project | null;
}

const ProjectDashboardPage: React.FC = () => {
	const { t } = useI18n();
	const { project } = useOutletContext<OutletContext>();

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

	return <ProjectDashboard project={project} />;
};

export default ProjectDashboardPage;
