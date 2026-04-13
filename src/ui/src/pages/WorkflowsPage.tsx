import { WorkflowCardGrid } from "../components/workflows/workflow-card-grid";
import { WorkflowCategoryFilter } from "../components/workflows/workflow-category-filter";
import { useWorkflows } from "../hooks/use-workflows";
import { useI18n } from "../i18n";

export default function WorkflowsPage() {
	const { t } = useI18n();
	const {
		workflows,
		activeCategory,
		setActiveCategory,
		selectedWorkflowId,
		setSelectedWorkflowId,
	} = useWorkflows();

	return (
		<div className="flex flex-col h-full overflow-hidden bg-white dark:bg-dash-bg text-gray-900 dark:text-dash-text">
			<div className="p-6 border-b border-gray-200 dark:border-dash-border shrink-0">
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
					<div>
						<h1 className="text-2xl font-bold">{t("workflowsTitle" as any)}</h1>
						<p className="text-sm text-gray-500 dark:text-dash-text-secondary mt-1">
							{t("workflowsSubtitle" as any)}
						</p>
					</div>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto p-6">
				<WorkflowCategoryFilter
					activeCategory={activeCategory}
					onSelectCategory={setActiveCategory}
				/>

				<div className="flex-grow overflow-auto p-6 transition-all duration-300">
					<WorkflowCardGrid
						workflows={workflows}
						activeCategory={activeCategory}
						selectedWorkflowId={selectedWorkflowId}
						onSelectWorkflow={setSelectedWorkflowId}
					/>
				</div>
			</div>

			<div className="shrink-0 p-4 border-t border-gray-200 dark:border-dash-border text-center">
				<p className="text-xs text-gray-500 dark:text-dash-text-muted">
					{t("workflowsCredit" as any)}{" "}
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
