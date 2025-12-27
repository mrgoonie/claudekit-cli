/**
 * Project dashboard page - displays project overview and actions
 */
import type React from "react";
import { useOutletContext } from "react-router-dom";
import ProjectDashboard from "../components/ProjectDashboard";
import type { Project } from "../types";

interface OutletContext {
	project: Project;
}

const ProjectDashboardPage: React.FC = () => {
	const { project } = useOutletContext<OutletContext>();
	return <ProjectDashboard project={project} />;
};

export default ProjectDashboardPage;
