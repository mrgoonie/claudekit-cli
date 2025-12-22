import { useState, type ReactNode } from "react";
import { Sidebar } from "../components/Sidebar";
import { Header } from "../components/Header";
import { useProject } from "../contexts/ProjectContext";

interface AppLayoutProps {
	children: ReactNode;
	connected?: boolean;
}

export function AppLayout({ children, connected = true }: AppLayoutProps) {
	const [collapsed, setCollapsed] = useState(false);
	const { currentProject } = useProject();

	const toggleSidebar = () => setCollapsed((prev) => !prev);

	return (
		<div className="flex h-screen overflow-hidden">
			<Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
			<div className="flex flex-col flex-1 overflow-hidden">
				<Header
					project={currentProject}
					healthStatus="healthy"
					connected={connected}
				/>
				<main className="flex-1 overflow-y-auto p-6 bg-gray-50">
					{children}
				</main>
			</div>
		</div>
	);
}
