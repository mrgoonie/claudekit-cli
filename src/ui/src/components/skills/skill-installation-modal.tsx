import type { AgentInfo, SkillInfo } from "@/types";
/**
 * Modal for installing skills with agent selection and scope toggle
 */
import type React from "react";
import { useEffect, useState } from "react";
import { useI18n } from "../../i18n";
import AgentCheckbox from "./agent-selection-checkbox";

interface InstallModalProps {
	isOpen: boolean;
	skill: SkillInfo | null;
	agents: AgentInfo[];
	onClose: () => void;
	onConfirm: (agents: string[], global: boolean) => Promise<void>;
}

const InstallModal: React.FC<InstallModalProps> = ({
	isOpen,
	skill,
	agents,
	onClose,
	onConfirm,
}) => {
	const { t } = useI18n();
	const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
	const [isGlobal, setIsGlobal] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Reset state when modal opens/closes
	useEffect(() => {
		if (!isOpen) {
			setSelectedAgents(new Set());
			setIsGlobal(false);
			setError(null);
			setLoading(false);
		}
	}, [isOpen]);

	// Handle escape key
	useEffect(() => {
		if (!isOpen) return;

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};

		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [isOpen, onClose]);

	const toggleAgent = (agentName: string) => {
		const newSet = new Set(selectedAgents);
		if (newSet.has(agentName)) {
			newSet.delete(agentName);
		} else {
			newSet.add(agentName);
		}
		setSelectedAgents(newSet);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (selectedAgents.size === 0) {
			setError("Please select at least one agent");
			return;
		}

		try {
			setLoading(true);
			setError(null);
			await onConfirm(Array.from(selectedAgents), isGlobal);
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Installation failed");
		} finally {
			setLoading(false);
		}
	};

	if (!isOpen || !skill) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
			onClick={onClose}
		>
			<div
				className="bg-dash-surface border border-dash-border rounded-lg shadow-xl max-w-lg w-full mx-4"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="px-6 py-4 border-b border-dash-border">
					<h2 className="text-lg font-bold text-dash-text">Install {skill.name}</h2>
					<p className="text-sm text-dash-text-muted mt-1">
						Select agents to install this skill for
					</p>
				</div>

				{/* Form */}
				<form onSubmit={handleSubmit} className="p-6 space-y-4">
					{/* Agent selection */}
					<div>
						<p className="block text-sm font-medium text-dash-text mb-3">
							Select Agents <span className="text-red-500">*</span>
						</p>
						<div className="space-y-2">
							{agents.map((agent) => (
								<AgentCheckbox
									key={agent.name}
									agent={agent}
									checked={selectedAgents.has(agent.name)}
									onChange={() => toggleAgent(agent.name)}
									disabled={loading}
								/>
							))}
						</div>
					</div>

					{/* Global/Project toggle */}
					<div className="flex items-center gap-3 p-3 bg-dash-bg border border-dash-border rounded-md">
						<input
							type="checkbox"
							id="global-install"
							checked={isGlobal}
							onChange={(e) => setIsGlobal(e.target.checked)}
							disabled={loading}
							className="w-4 h-4 text-dash-accent bg-dash-bg border-dash-border rounded focus:ring-2 focus:ring-dash-accent focus:ring-offset-0"
						/>
						<label htmlFor="global-install" className="flex-1">
							<span className="text-sm font-medium text-dash-text block">Install Globally</span>
							<span className="text-xs text-dash-text-muted">
								Available to all projects instead of current project only
							</span>
						</label>
					</div>

					{/* Error message */}
					{error && (
						<div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-md">
							<p className="text-sm text-red-500">{error}</p>
						</div>
					)}

					{/* Buttons */}
					<div className="flex gap-3 pt-2">
						<button
							type="button"
							onClick={onClose}
							disabled={loading}
							className="flex-1 px-4 py-2 border border-dash-border rounded-md text-dash-text-secondary hover:bg-dash-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{t("cancel")}
						</button>
						<button
							type="submit"
							disabled={loading || selectedAgents.size === 0}
							className="flex-1 px-4 py-2 bg-dash-accent text-white rounded-md hover:bg-dash-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{loading ? "Installing..." : t("install")}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default InstallModal;
