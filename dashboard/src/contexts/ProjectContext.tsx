import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";

export interface Project {
	id: string;
	path: string;
	name: string;
}

export interface ProjectContextValue {
	currentProject: Project | null;
	projects: Project[];
	setCurrentProject: (project: Project | null) => void;
	refreshProjects: () => Promise<void>;
	isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

const STORAGE_KEY = "claudekit-current-project-id";

export function ProjectProvider({ children }: { children: ReactNode }) {
	const [projects, setProjects] = useState<Project[]>([]);
	const [currentProject, setCurrentProjectState] = useState<Project | null>(
		null,
	);
	const [isLoading, setIsLoading] = useState(true);

	const refreshProjects = useCallback(async () => {
		setIsLoading(true);
		try {
			// TODO: Phase 3 will implement API call to fetch projects
			// For now, use placeholder data
			const mockProjects: Project[] = [
				{ id: "1", path: "/home/user/project-a", name: "Project A" },
				{ id: "2", path: "/home/user/project-b", name: "Project B" },
			];
			setProjects(mockProjects);

			// Restore saved project from localStorage
			const savedId = localStorage.getItem(STORAGE_KEY);
			if (savedId) {
				const saved = mockProjects.find((p) => p.id === savedId);
				if (saved) {
					setCurrentProjectState(saved);
				} else if (mockProjects.length > 0) {
					setCurrentProjectState(mockProjects[0]);
				}
			} else if (mockProjects.length > 0) {
				setCurrentProjectState(mockProjects[0]);
			}
		} catch (error) {
			console.error("Failed to load projects:", error);
		} finally {
			setIsLoading(false);
		}
	}, []);

	const setCurrentProject = useCallback((project: Project | null) => {
		setCurrentProjectState(project);
		if (project) {
			localStorage.setItem(STORAGE_KEY, project.id);
		} else {
			localStorage.removeItem(STORAGE_KEY);
		}
	}, []);

	useEffect(() => {
		refreshProjects();
	}, [refreshProjects]);

	return (
		<ProjectContext.Provider
			value={{
				currentProject,
				projects,
				setCurrentProject,
				refreshProjects,
				isLoading,
			}}
		>
			{children}
		</ProjectContext.Provider>
	);
}

export function useProject() {
	const context = useContext(ProjectContext);
	if (!context) {
		throw new Error("useProject must be used within a ProjectProvider");
	}
	return context;
}
