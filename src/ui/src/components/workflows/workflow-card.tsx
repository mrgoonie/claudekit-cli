import React from "react";
import { useI18n } from "../../i18n";
import type { ResolvedWorkflow } from "../../types/workflow-types";
import { WorkflowComplexityBadge } from "./workflow-complexity-badge";
import { WorkflowMiniGraph } from "./workflow-mini-graph";
import { WorkflowSkillChip } from "./workflow-skill-chip";

interface CardProps {
	workflow: ResolvedWorkflow;
	isSelected: boolean;
	onClick: () => void;
}

export const WorkflowCard: React.FC<CardProps> = ({ workflow, isSelected, onClick }) => {
	const { t } = useI18n();

	if (isSelected) {
		return (
			<div className="flex flex-col xl:flex-row bg-white dark:bg-[#14151a] rounded-xl border-2 border-blue-400 dark:border-blue-500 shadow-lg overflow-hidden min-h-[500px]">
				{/* Left Column: Details */}
				<div className="flex flex-col p-6 w-full xl:w-2/5 shrink-0 bg-white dark:bg-[#14151a]">
					<div className="flex justify-between items-start mb-4">
						<div className="flex gap-2 items-center">
							<WorkflowComplexityBadge complexity={workflow.complexity} />
							<span className="text-xs font-mono text-gray-500 dark:text-dash-text-muted">
								{workflow.timeEstimate}
							</span>
						</div>
						<button
							onClick={(e) => {
								e.stopPropagation();
								onClick();
							}}
							className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
							aria-label="Close"
						>
							<svg
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								aria-hidden="true"
							>
								<path d="M18 6L6 18M6 6l12 12" />
							</svg>
						</button>
					</div>

					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onClick();
						}}
						className="text-left w-full cursor-pointer hover:opacity-80 transition-opacity"
					>
						<h2 className="text-2xl font-bold text-gray-900 dark:text-dash-text mb-2">
							{t(workflow.nameKey)}
						</h2>
					</button>

					<p className="text-base text-gray-600 dark:text-dash-text-secondary mb-8">
						{t(workflow.descriptionKey)}
					</p>

					<div className="flex-grow">
						<h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
							{t("workflowImplementationRecipe")}
						</h4>
						<div className="relative pl-4 space-y-6">
							<div className="absolute top-2 bottom-2 left-[5px] border-l-2 border-dashed border-gray-200 dark:border-gray-800" />
							{workflow.steps.map((step) => (
								<div key={step.id} className="relative">
									<div className="absolute -left-[14px] top-1.5 w-[11px] h-[11px] rounded-full bg-blue-500 border-[3px] border-white dark:border-[#14151a]" />
									<div className="ml-4">
										<WorkflowSkillChip command={step.command || ""} />
										{step.transitionLabel && (
											<p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
												{step.transitionLabel}
											</p>
										)}
									</div>
								</div>
							))}
						</div>
					</div>
				</div>

				{/* Right Column: Mini Graph */}
				<div className="flex-grow p-4 bg-gray-50 dark:bg-[#0c0d12] border-t xl:border-t-0 xl:border-l border-gray-200 dark:border-gray-800 overflow-hidden relative">
					<WorkflowMiniGraph workflow={workflow} />
				</div>
			</div>
		);
	}

	return (
		<div
			className="flex flex-col bg-white dark:bg-[#14151a] rounded-xl border border-gray-200 dark:border-dash-border hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer p-5 h-full group relative"
			onClick={onClick}
		>
			<div className="flex justify-between items-start mb-3">
				<WorkflowComplexityBadge complexity={workflow.complexity} />
				<span className="text-xs font-mono text-gray-500 dark:text-dash-text-muted">
					{workflow.timeEstimate}
				</span>
			</div>

			<h3 className="text-lg font-bold text-gray-900 dark:text-dash-text mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
				{t(workflow.nameKey)}
			</h3>

			<p className="text-sm text-gray-600 dark:text-dash-text-secondary mb-6 flex-grow">
				{t(workflow.descriptionKey)}
			</p>

			<div className="mt-auto pt-4 border-t border-gray-100 dark:border-dash-border">
				<div className="flex flex-wrap items-center gap-2">
					{workflow.steps.map((step, index) => (
						<React.Fragment key={step.id}>
							<WorkflowSkillChip command={step.command || ""} />
							{index < workflow.steps.length - 1 && (
								<span className="text-gray-400 dark:text-dash-text-muted text-xs">→</span>
							)}
						</React.Fragment>
					))}
				</div>
			</div>
		</div>
	);
};
