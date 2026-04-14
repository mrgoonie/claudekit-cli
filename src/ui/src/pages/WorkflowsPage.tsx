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
		loading,
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

					{/* Header Controls */}
					<div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
						{/* VividKit Credit Chip */}
						<a
							href="https://vividkit.dev/guides/workflows"
							target="_blank"
							rel="noreferrer"
							className="group hidden md:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-lg hover:shadow-sm transition-all text-indigo-700 dark:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500/40"
						>
							<svg
								className="w-3.5 h-3.5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
							</svg>
							<span className="text-xs font-semibold whitespace-nowrap">Inspired by VividKit</span>
						</a>

						{/* Search bar */}
						<div className="relative w-full sm:w-64">
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
			</div>

			<div className="flex-1 overflow-y-auto p-6">
				<WorkflowCategoryFilter
					activeCategory={activeCategory}
					onSelectCategory={handleCategoryChange}
				/>

				{loading ? (
					<div className="flex items-center justify-center p-12 text-gray-500 dark:text-dash-text-muted">
						{t("loadingWorkflows")}
					</div>
				) : filteredWorkflows.length > 0 ? (
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
	);
}
