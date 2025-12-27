/**
 * Config editor page - edit project configuration
 */
import type React from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import ConfigEditor from "../components/ConfigEditor";
import type { Project } from "../types";

interface OutletContext {
	project: Project;
}

const ConfigEditorPage: React.FC = () => {
	const { project } = useOutletContext<OutletContext>();
	const navigate = useNavigate();

	const handleBack = () => {
		navigate(`/project/${project.id}`);
	};

	return <ConfigEditor project={project} onBack={handleBack} />;
};

export default ConfigEditorPage;
