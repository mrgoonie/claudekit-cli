import { useState, useMemo } from 'react';
import { ENGINEER_KIT_WORKFLOWS } from '../data/engineer-kit-workflows';
import type { WorkflowCategory, WorkflowComplexity } from '../types/workflow-types';

export function useWorkflows() {
  const [activeCategory, setActiveCategory] = useState<WorkflowCategory | 'all'>('all');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  const filteredWorkflows = useMemo(() => {
    let result = ENGINEER_KIT_WORKFLOWS;
    if (activeCategory !== 'all') {
      result = ENGINEER_KIT_WORKFLOWS.filter(w => w.category === activeCategory);
    }
    
    const complexityWeight: Record<WorkflowComplexity, number> = {
      beginner: 0,
      intermediate: 1,
      advanced: 2,
    };
    
    return [...result].sort((a, b) => complexityWeight[a.complexity] - complexityWeight[b.complexity]);
  }, [activeCategory]);

  return {
    workflows: filteredWorkflows,
    allWorkflows: ENGINEER_KIT_WORKFLOWS,
    activeCategory,
    setActiveCategory,
    selectedWorkflowId,
    setSelectedWorkflowId
  };
}
