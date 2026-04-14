import type React from "react";
import type { TranslationKey } from "../../i18n";
import { useI18n } from "../../i18n";
import type { WorkflowComplexity } from "../../types/workflow-types";

interface BadgeProps {
	complexity: WorkflowComplexity;
}

const COMPLEXITY_KEYS: Record<WorkflowComplexity, TranslationKey> = {
	beginner: "workflowComplexityBeginner",
	intermediate: "workflowComplexityIntermediate",
	advanced: "workflowComplexityAdvanced",
};

const COMPLEXITY_STYLES: Record<WorkflowComplexity, string> = {
	beginner: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
	intermediate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
	advanced: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export const WorkflowComplexityBadge: React.FC<BadgeProps> = ({ complexity }) => {
	const { t } = useI18n();

	return (
		<span className={`px-2 py-1 text-xs font-medium rounded-full ${COMPLEXITY_STYLES[complexity]}`}>
			{t(COMPLEXITY_KEYS[complexity])}
		</span>
	);
};
