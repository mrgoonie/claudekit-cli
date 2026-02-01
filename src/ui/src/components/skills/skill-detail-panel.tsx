import type { AgentInfo, SkillInfo, SkillInstallation } from "@/types";
/**
 * Slide-in detail panel for skill installation management
 */
import type React from "react";
import { useEffect, useState } from "react";
import { useI18n } from "../../i18n";
import { CATEGORY_COLORS } from "../../types/skills-dashboard-types";
import AgentIcon from "./agent-icon";

interface DetailPanelProps {
	skill: SkillInfo;
	installations: SkillInstallation[];
	agents: AgentInfo[];
	onClose: () => void;
	onInstall: (skillName: string, agents: string[], global: boolean) => Promise<void>;
	onUninstall: (skillName: string, agent: string) => Promise<void>;
}

const DetailPanel: React.FC<DetailPanelProps> = ({
	skill,
	installations,
	agents,
	onClose,
	onInstall,
	onUninstall,
}) => {
	const { t } = useI18n();
	const [isGlobal, setIsGlobal] = useState(true);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Find installations for this skill
	const skillInstallations = installations.filter((i) => i.skillName === skill.name);
	const installMap = new Map(skillInstallations.map((i) => [i.agent, i]));

	// Detected agents only
	const detectedAgents = agents.filter((a) => a.detected);
	const notDetectedAgents = agents.filter((a) => !a.detected);

	const categoryColor = CATEGORY_COLORS[skill.category] || CATEGORY_COLORS.General;

	// Handle escape key
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};
		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [onClose]);

	const handleAgentInstall = async (agentName: string) => {
		try {
			setLoading(true);
			setError(null);
			await onInstall(skill.name, [agentName], isGlobal);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Installation failed");
		} finally {
			setLoading(false);
		}
	};

	const handleAgentUninstall = async (agentName: string) => {
		try {
			setLoading(true);
			setError(null);
			await onUninstall(skill.name, agentName);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Uninstall failed");
		} finally {
			setLoading(false);
		}
	};

	const handleInstallToAll = async () => {
		const notInstalled = detectedAgents.filter((a) => !installMap.has(a.name));
		if (notInstalled.length === 0) return;

		try {
			setLoading(true);
			setError(null);
			await onInstall(
				skill.name,
				notInstalled.map((a) => a.name),
				isGlobal,
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Installation failed");
		} finally {
			setLoading(false);
		}
	};

	return (
		<>
			{/* Backdrop */}
			<div
				className="fixed inset-0 bg-black/50 z-40"
				onClick={onClose}
				style={{ pointerEvents: "auto" }}
			/>

			{/* Panel */}
			<div className="fixed top-0 right-0 w-[480px] h-full bg-dash-surface border-l border-dash-border shadow-2xl z-50 flex flex-col animate-slide-in">
				{/* Header */}
				<div className="px-6 py-5 border-b border-dash-border">
					<div className="flex items-start justify-between">
						<div className="flex-1">
							<h2 className="text-xl font-bold text-dash-text">{skill.name}</h2>
							<div className="flex items-center gap-2 mt-1.5">
								<span
									className="text-[11px] font-semibold px-2 py-0.5 rounded-lg"
									style={{
										background: `${categoryColor}26`,
										color: categoryColor,
									}}
								>
									{skill.category}
								</span>
								{skill.version && (
									<span className="text-[11px] text-dash-text-muted">
										{t("versionLabel").replace("{version}", skill.version)}
									</span>
								)}
							</div>
						</div>
						<button
							type="button"
							onClick={onClose}
							className="w-8 h-8 flex items-center justify-center rounded-md text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors"
						>
							<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<line x1="18" y1="6" x2="6" y2="18" strokeWidth={2} />
								<line x1="6" y1="6" x2="18" y2="18" strokeWidth={2} />
							</svg>
						</button>
					</div>
				</div>

				{/* Body */}
				<div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
					{/* Description */}
					<div>
						<h3 className="text-[11px] font-bold uppercase tracking-wide text-dash-text-muted mb-2.5">
							{t("description")}
						</h3>
						<p className="text-sm text-dash-text-secondary leading-relaxed">
							{skill.description || t("noDescription")}
						</p>
					</div>

					{/* Installation Status */}
					<div>
						<div className="flex items-center justify-between mb-3">
							<h3 className="text-[11px] font-bold uppercase tracking-wide text-dash-text-muted">
								{t("scopeLabel")}
							</h3>
							<div className="flex bg-dash-bg border border-dash-border rounded-lg overflow-hidden">
								<button
									type="button"
									onClick={() => setIsGlobal(true)}
									className={`px-3.5 py-1.5 text-xs font-medium transition-colors ${
										isGlobal
											? "bg-dash-accent/10 text-dash-accent"
											: "text-dash-text-muted hover:text-dash-text"
									}`}
								>
									{t("scopeGlobal")}
								</button>
								<button
									type="button"
									onClick={() => setIsGlobal(false)}
									className={`px-3.5 py-1.5 text-xs font-medium transition-colors ${
										!isGlobal
											? "bg-dash-accent/10 text-dash-accent"
											: "text-dash-text-muted hover:text-dash-text"
									}`}
								>
									{t("scopeProject")}
								</button>
							</div>
						</div>

						{/* Error message */}
						{error && (
							<div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
								<p className="text-xs text-red-500">{error}</p>
							</div>
						)}

						{/* Detected agents */}
						<div className="space-y-1.5">
							{detectedAgents.map((agent) => {
								const installation = installMap.get(agent.name);
								const isInstalled = !!installation;

								return (
									<div
										key={agent.name}
										className="flex items-center justify-between px-3 py-2.5 bg-dash-bg rounded-lg"
									>
										<div className="flex items-center gap-2.5">
											<AgentIcon agentName={agent.name} displayName={agent.displayName} size={20} />
											<div>
												<div className="text-sm font-medium text-dash-text">
													{agent.displayName}
												</div>
												<div className="text-[11px] text-dash-text-muted">
													{t("detected")} —{" "}
													{isInstalled
														? `${t("agentInstalled")} (${installation.isGlobal ? t("scopeGlobal").toLowerCase() : t("scopeProject").toLowerCase()})`
														: t("agentNotInstalled")}
												</div>
											</div>
										</div>
										<button
											type="button"
											onClick={() =>
												isInstalled
													? handleAgentUninstall(agent.name)
													: handleAgentInstall(agent.name)
											}
											disabled={loading}
											className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors disabled:opacity-50 ${
												isInstalled
													? "bg-transparent text-dash-text-secondary border border-dash-border hover:bg-dash-surface-hover"
													: "bg-dash-accent text-white hover:bg-dash-accent/90"
											}`}
										>
											{isInstalled ? t("uninstall") : t("install")}
										</button>
									</div>
								);
							})}
						</div>

						{/* Not detected agents (disabled) */}
						{notDetectedAgents.length > 0 && (
							<div className="space-y-1.5 mt-1.5 opacity-50">
								{notDetectedAgents.map((agent) => (
									<div
										key={agent.name}
										className="flex items-center justify-between px-3 py-2.5 bg-dash-bg rounded-lg"
									>
										<div className="flex items-center gap-2.5">
											<AgentIcon agentName={agent.name} displayName={agent.displayName} size={20} />
											<div>
												<div className="text-sm font-medium text-dash-text">
													{agent.displayName}
												</div>
												<div className="text-[11px] text-dash-text-muted">{t("notDetected")}</div>
											</div>
										</div>
										<button
											type="button"
											disabled
											className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-dash-accent text-white opacity-50 cursor-not-allowed"
										>
											{t("install")}
										</button>
									</div>
								))}
							</div>
						)}
					</div>
				</div>

				{/* Footer */}
				<div className="px-6 py-4 border-t border-dash-border flex gap-3">
					<button
						type="button"
						onClick={onClose}
						className="flex-1 px-4 py-2.5 border border-dash-border rounded-lg text-sm font-semibold text-dash-text-secondary hover:bg-dash-surface-hover transition-colors"
					>
						{t("detailPanelClose")}
					</button>
					<button
						type="button"
						onClick={handleInstallToAll}
						disabled={
							loading ||
							detectedAgents.every((a) => installMap.has(a.name)) ||
							detectedAgents.length === 0
						}
						className="flex-1 px-4 py-2.5 bg-dash-accent text-white rounded-lg text-sm font-semibold hover:bg-dash-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{loading ? t("installing") : t("installToAll")}
					</button>
				</div>
			</div>
		</>
	);
};

export default DetailPanel;
