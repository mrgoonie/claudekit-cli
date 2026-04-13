import { useCallback, useMemo, useState } from "react";
import { WorkflowCardGrid } from "../components/workflows/workflow-card-grid";
import { WorkflowCategoryFilter } from "../components/workflows/workflow-category-filter";
import { useWorkflows } from "../hooks/use-workflows";
import { useI18n } from "../i18n";
import type { WorkflowCategory } from "../types/workflow-types";

export default function WorkflowsPage() {
	const { t } = useI18n();
	const [search, setSearch] = useState("");
	const {
		workflows,
		activeCategory,
		setActiveCategory,
		selectedWorkflowId,
		setSelectedWorkflowId,
	} = useWorkflows();

	// When category changes, also close any expanded workflow
	const handleCategoryChange = useCallback(
		(category: WorkflowCategory | "all") => {
			setActiveCategory(category);
			setSelectedWorkflowId(null);
		},
		[setActiveCategory, setSelectedWorkflowId],
	);

	// Filter workflows by search query
	const filteredWorkflows = useMemo(() => {
		if (!search.trim()) return workflows;
		const q = search.toLowerCase();
		return workflows.filter(
			(w) =>
				w.name.toLowerCase().includes(q) ||
				w.description.toLowerCase().includes(q) ||
				w.steps.some((s) => s.command.toLowerCase().includes(q)),
		);
	}, [workflows, search]);

	return (
		<div className="flex flex-col h-full overflow-hidden bg-white dark:bg-dash-bg text-gray-900 dark:text-dash-text">
			<div className="p-6 border-b border-gray-200 dark:border-dash-border shrink-0">
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
					<div>
						<h1 className="text-2xl font-bold">{t("workflowsTitle")}</h1>
						<p className="text-sm text-gray-500 dark:text-dash-text-secondary mt-1">
							{t("workflowsSubtitle")}
						</p>
					</div>
					{/* Search bar */}
					<div className="relative w-full md:w-64">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder={t("workflowSearchPlaceholder")}
							className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-dash-surface border border-gray-200 dark:border-dash-border rounded-lg text-gray-900 dark:text-dash-text placeholder:text-gray-400 dark:placeholder:text-dash-text-muted focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
						/>
						{search && (
							<button
								type="button"
								onClick={() => setSearch("")}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="w-4 h-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</button>
						)}
					</div>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto p-6">
				<WorkflowCategoryFilter
					activeCategory={activeCategory}
					onSelectCategory={handleCategoryChange}
				/>

				<div className="flex-grow overflow-auto p-6 transition-all duration-300">
					{filteredWorkflows.length > 0 ? (
						<WorkflowCardGrid
							workflows={filteredWorkflows}
							selectedWorkflowId={selectedWorkflowId}
							onSelectWorkflow={setSelectedWorkflowId}
						/>
					) : (
						<div className="flex items-center justify-center p-12 text-gray-500 dark:text-dash-text-muted">
							{t("workflowNoResults")}
						</div>
					)}
				</div>
			</div>

			<div className="shrink-0 p-4 border-t border-gray-200 dark:border-dash-border text-center">
				<p className="text-xs text-gray-500 dark:text-dash-text-muted">
					{t("workflowsCredit")}{" "}
					<a
						href="https://vividkit.dev/guides/workflows"
						target="_blank"
						rel="noreferrer"
						className="text-blue-600 dark:text-blue-400 hover:underline"
					>
						VividKit
					</a>
				</p>
			</div>
		</div>
	);
}
