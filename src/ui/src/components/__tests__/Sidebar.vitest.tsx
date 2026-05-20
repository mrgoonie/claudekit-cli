import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { HealthStatus, KitType, type Project } from "../../types";
import Sidebar from "../Sidebar";

vi.mock("../AddProjectModal", () => ({
	default: () => null,
}));

vi.mock("../LanguageSwitcher", () => ({
	default: () => null,
}));

vi.mock("../../hooks/use-entity-counts", () => ({
	useEntityCounts: () => ({
		counts: { agents: 3, commands: 4, skills: 5, workflows: 6 },
	}),
}));

vi.mock("../../i18n", () => ({
	useI18n: () => ({
		t: (key: string) =>
			(
				({
					controlCenter: "Control Center",
					overviewSection: "Overview",
					plansNav: "Plans",
					kanbanTitle: "Plan Kanban",
					systemNavLabel: "System",
					entitiesSection: "Entities",
					workflowsTitle: "Workflows",
					agentsBrowser: "Agents",
					commandsBrowser: "Commands",
					skillsMarketplace: "Skills",
					toolsSection: "Tools",
					globalConfig: "Global Config",
					migrateTitle: "Migrate",
					statuslineBuilderTitle: "Statusline",
					mcpBrowser: "MCP",
					projectsSection: "Projects",
					addProject: "Add Project",
				}) as Record<string, string>
			)[key] ?? key,
	}),
}));

function createProject(): Project {
	return {
		id: "project-alpha",
		name: "Alpha",
		path: "/tmp/alpha",
		health: HealthStatus.HEALTHY,
		kitType: KitType.ENGINEER,
		model: "gpt-5",
		activeHooks: 0,
		mcpServers: 0,
		skills: [],
	};
}

describe("Sidebar", () => {
	it("keeps Plans as the only plan dashboard entry in overview navigation", () => {
		render(
			<MemoryRouter initialEntries={["/plans"]}>
				<Sidebar
					projects={[createProject()]}
					currentProjectId={null}
					isCollapsed={false}
					isConnected={true}
					theme="dark"
					onSwitchProject={vi.fn()}
					onToggle={vi.fn()}
					onAddProject={vi.fn().mockResolvedValue(undefined)}
					onToggleTheme={vi.fn()}
				/>
			</MemoryRouter>,
		);

		expect(screen.getByText("Plans")).toBeInTheDocument();
		expect(screen.queryByText("Plan Kanban")).not.toBeInTheDocument();
	});
});
