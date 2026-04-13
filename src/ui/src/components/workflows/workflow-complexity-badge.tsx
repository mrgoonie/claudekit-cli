import React from 'react';
import { useI18n } from '../../i18n';
import type { WorkflowComplexity } from '../../types/workflow-types';

interface BadgeProps {
  complexity: WorkflowComplexity;
}

export const WorkflowComplexityBadge: React.FC<BadgeProps> = ({ complexity }) => {
  const { t } = useI18n();

  const getStyle = () => {
    switch (complexity) {
      case 'beginner': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'advanced': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    }
  };

  const getLabelKey = () => {
    switch (complexity) {
      case 'beginner': return 'workflowComplexityBeginner';
      case 'intermediate': return 'workflowComplexityIntermediate';
      case 'advanced': return 'workflowComplexityAdvanced';
    }
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStyle()}`}>
      {t(getLabelKey() as any)}
    </span>
  );
};
