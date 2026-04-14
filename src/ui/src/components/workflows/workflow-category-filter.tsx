import type React from "react";
import { WORKFLOW_CATEGORIES } from "../../data/engineer-kit-workflows";
import { useI18n } from "../../i18n";
import type { WorkflowCategory } from "../../types/workflow-types";

interface FilterProps {
	activeCategory: WorkflowCategory | "all";
	onSelectCategory: (category: WorkflowCategory | "all") => void;
}

export const WorkflowCategoryFilter: React.FC<FilterProps> = ({
	activeCategory,
	onSelectCategory,
}) => {
	const { t } = useI18n();

	return (
		<div className="flex overflow-x-auto space-x-2 pb-2 mb-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
			<button
				onClick={() => onSelectCategory("all")}
				className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${
					activeCategory === "all"
						? "bg-blue-600 text-white dark:bg-blue-500"
						: "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-[#1C1F26] dark:text-gray-300 dark:hover:bg-[#2A2E38]"
				}`}
			>
				{t("workflowCategoryAll")}
			</button>
			{WORKFLOW_CATEGORIES.map((category) => (
				<button
					key={category.id}
					onClick={() => onSelectCategory(category.id)}
					className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${
						activeCategory === category.id
							? "bg-blue-600 text-white dark:bg-blue-500"
							: "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-[#1C1F26] dark:text-gray-300 dark:hover:bg-[#2A2E38]"
					}`}
				>
					{t(category.labelKey)}
				</button>
			))}
		</div>
	);
};
