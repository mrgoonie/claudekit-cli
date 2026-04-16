import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSessions } from "../hooks";
import { isTauri } from "../hooks/use-tauri";
import { type TranslationKey, useI18n } from "../i18n";
import {
	type ActionAppOption,
	type ActionOptionsResponse,
	fetchActionOptions,
	openAction,
	updateProject,
} from "../services/api";
import { HealthStatus, type Project } from "../types";
import { DevelopmentBadge } from "./config-editor";

interface ProjectDashboardProps {
	project: Project;
}

const GLOBAL_OPTION_VALUE = "__global__";
const DESKTOP_ACTIONS_MESSAGE_KEY: TranslationKey = "desktopModeActionsMessage";
const DESKTOP_PLANS_MESSAGE_KEY: TranslationKey = "desktopModePlansMessage";

const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ project }) => {
	const { t } = useI18n();
	const navigate = useNavigate();
	const desktopMode = isTauri();
	const { sessions, loading: sessionsLoading } = useSessions(project.id);
	const [actionOptions, setActionOptions] = useState<ActionOptionsResponse | null>(null);
	const [actionsLoading, setActionsLoading] = useState(true);
	const [actionsError, setActionsError] = useState<string | null>(null);
	const [terminalSelection, setTerminalSelection] = useState<string>(GLOBAL_OPTION_VALUE);
	const [editorSelection, setEditorSelection] = useState<string>(GLOBAL_OPTION_VALUE);

	/** Fire-and-forget action handler with error alert */
	const handleAction = async (action: string, appId?: string) => {
		try {
			await openAction(action, project.path, appId, project.id);
		} catch (err) {
			alert(`${t("actionFailed")}: ${err instanceof Error ? err.message : action}`);
		}
	};

	const loadActionOptions = useCallback(() => {
		const controller = new AbortController();
		if (desktopMode) {
			setActionOptions(null);
			setTerminalSelection(GLOBAL_OPTION_VALUE);
			setEditorSelection(GLOBAL_OPTION_VALUE);
			setActionsError(t(DESKTOP_ACTIONS_MESSAGE_KEY));
			setActionsLoading(false);
			return controller;
		}
		setActionsLoading(true);
		setActionsError(null);
		void fetchActionOptions(project.id, controller.signal)
			.then((options) => {
				setActionOptions(options);
				setTerminalSelection(options.preferences.project.terminalApp || GLOBAL_OPTION_VALUE);
				setEditorSelection(options.preferences.project.editorApp || GLOBAL_OPTION_VALUE);
			})
			.catch((err) => {
				if (err instanceof DOMException && err.name === "AbortError") return;
				setActionOptions(null);
				setTerminalSelection(GLOBAL_OPTION_VALUE);
				setEditorSelection(GLOBAL_OPTION_VALUE);
				setActionsError(
					err instanceof Error && err.message ? err.message : t("actionOptionsLoadFailed"),
				);
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setActionsLoading(false);
				}
			});
		return controller;
	}, [desktopMode, project.id, t]);

	useEffect(() => {
		const controller = loadActionOptions();
		return () => {
			controller.abort();
		};
	}, [loadActionOptions]);

	const terminalOptions = actionOptions?.terminals || [];
	const editorOptions = actionOptions?.editors || [];
	const terminalDefaultLabel =
		terminalOptions.find((opt) => opt.id === actionOptions?.defaults.terminalApp)?.label ||
		actionOptions?.defaults.terminalApp;
	const editorDefaultLabel =
		editorOptions.find((opt) => opt.id === actionOptions?.defaults.editorApp)?.label ||
		actionOptions?.defaults.editorApp;

	const terminalEffective = useMemo(
		() =>
			terminalOptions.find((opt) =>
				terminalSelection === GLOBAL_OPTION_VALUE
					? opt.id === actionOptions?.defaults.terminalApp
					: opt.id === terminalSelection,
			),
		[terminalOptions, terminalSelection, actionOptions?.defaults.terminalApp],
	);

	const editorEffective = useMemo(
		() =>
			editorOptions.find((opt) =>
				editorSelection === GLOBAL_OPTION_VALUE
					? opt.id === actionOptions?.defaults.editorApp
					: opt.id === editorSelection,
			),
		[editorOptions, editorSelection, actionOptions?.defaults.editorApp],
	);

	const saveProjectPreference = async (
		key: "terminalApp" | "editorApp",
		value: string | typeof GLOBAL_OPTION_VALUE,
	): Promise<void> => {
		// Discovered projects are read-only in registry
		if (project.id.startsWith("discovered-")) return;
		try {
			await updateProject(project.id, {
				preferences: {
					[key]: value === GLOBAL_OPTION_VALUE ? null : value,
				},
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : t("projectPreferenceSaveFailed");
			alert(`${t("actionFailed")}: ${message}`);
		}
	};

	const activePlans = project.activePlans ?? [];
	const plansDir = project.planSettings?.plansDir || "plans";
	const planQuery = new URLSearchParams({
		dir: plansDir,
		projectId: project.id,
	}).toString();

	const openPlan = (planDir: string) => {
		if (desktopMode) return;
		const planSlug = planDir.split(/[\\/]/).filter(Boolean).pop() ?? "plan";
		navigate(`/plans/${encodeURIComponent(planSlug)}?${planQuery}`);
	};

	const openKanban = () => {
		if (desktopMode) return;
		navigate(`/plans?${planQuery}&view=kanban`);
	};

	const openPlansDashboard = () => {
		if (desktopMode) return;
		navigate(`/plans?${planQuery}`);
	};

	return (
		<div className="animate-in fade-in slide-in-from-bottom-2 duration-500 transition-colors flex flex-col h-full">
			{/* Project Header Section */}
			<section className="mb-6 shrink-0">
				<div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
					<div>
						<div className="flex items-center gap-3 mb-1">
							<h1 className="text-3xl font-bold tracking-tight text-dash-text">{project.name}</h1>
							<HealthBadge status={project.health} />
							<DevelopmentBadge variant="beta" />
						</div>
						<p className="text-dash-text-secondary mono text-sm flex items-center gap-2 italic">
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
									d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
								/>
							</svg>
							{project.path}
						</p>
					</div>
					<div className="flex items-center gap-3">
						<span className="text-[10px] text-dash-text-muted font-bold uppercase tracking-widest bg-dash-surface border border-dash-border px-2 py-1 rounded">
							{sessions.length > 0 ? `${sessions.length} ${t("sessions")}` : t("noSessions")}
						</span>
					</div>
				</div>
			</section>

			{/* Quick Actions Bar */}
			<section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 shrink-0">
				{desktopMode && (
					<div className="col-span-2 md:col-span-4 rounded-lg border border-dash-border bg-dash-surface px-3 py-2 text-xs text-dash-text-secondary">
						{t("desktopModeQuickActionsHint")}
					</div>
				)}
				{actionsError ? (
					<div className="col-span-2 md:col-span-4 rounded-lg border border-orange-500/30 bg-orange-500/5 px-3 py-2 text-xs text-orange-700 dark:text-orange-300 flex items-center justify-between gap-3">
						<span>{actionsError}</span>
						{!desktopMode ? (
							<button
								onClick={() => void loadActionOptions()}
								className="rounded border border-orange-500/40 px-2 py-1 font-semibold hover:bg-orange-500/10 transition-colors"
							>
								{t("tryAgain")}
							</button>
						) : null}
					</div>
				) : null}
				<ActionButtonWithPicker
					icon="📟"
					label={t("terminal")}
					sub={
						terminalEffective
							? `${terminalEffective.openMode === "open-app" ? t("openAppOnly") : t("openAtPath")} • ${terminalEffective.label}`
							: t("terminalSub")
					}
					onClick={() =>
						handleAction(
							"terminal",
							terminalSelection === GLOBAL_OPTION_VALUE ? undefined : terminalSelection,
						)
					}
					disabled={
						desktopMode || actionsLoading || (!terminalEffective && terminalOptions.length > 0)
					}
					options={terminalOptions}
					value={terminalSelection}
					fallbackLabel={
						actionOptions
							? `${t("useGlobalFallback")} (${terminalDefaultLabel})`
							: t("useGlobalFallback")
					}
					onChange={async (value) => {
						setTerminalSelection(value);
						await saveProjectPreference("terminalApp", value);
					}}
				/>
				<ActionButtonWithPicker
					icon="💻"
					label={t("editor")}
					sub={
						editorEffective
							? `${editorEffective.openMode === "open-app" ? t("openAppOnly") : t("openAtPath")} • ${editorEffective.label}`
							: t("editorSub")
					}
					onClick={() =>
						handleAction(
							"editor",
							editorSelection === GLOBAL_OPTION_VALUE ? undefined : editorSelection,
						)
					}
					disabled={desktopMode || actionsLoading || (!editorEffective && editorOptions.length > 0)}
					options={editorOptions}
					value={editorSelection}
					fallbackLabel={
						actionOptions
							? `${t("useGlobalFallback")} (${editorDefaultLabel})`
							: t("useGlobalFallback")
					}
					onChange={async (value) => {
						setEditorSelection(value);
						await saveProjectPreference("editorApp", value);
					}}
				/>
				<ActionButton
					icon="🤖"
					label={t("launch")}
					sub={t("launchSub")}
					highlight
					onClick={() => handleAction("launch")}
					disabled={desktopMode}
				/>
				<ActionButton
					icon="⚙️"
					label={t("config")}
					sub={t("configSub")}
					onClick={() => navigate(`/config/project/${project.id}`)}
				/>
			</section>

			{/* Main Grid Content */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
				{/* Left/Main Column */}
				<div className="lg:col-span-2 flex flex-col gap-6 min-h-0">
					{/* Recent Sessions */}
					<div className="bg-dash-surface border border-dash-border rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
						<div className="px-4 py-3 border-b border-dash-border flex items-center justify-between bg-dash-surface-hover/50 shrink-0">
							<h3 className="text-sm font-bold text-dash-text-secondary uppercase tracking-widest">
								{t("recentSessions")}
							</h3>
						</div>
						<div className="divide-y divide-dash-border overflow-y-auto flex-1">
							{sessionsLoading ? (
								<div className="p-4 text-center text-dash-text-muted animate-pulse">
									{t("loadingSessions")}
								</div>
							) : sessions.length === 0 ? (
								<div className="p-4 text-center text-dash-text-muted">{t("noSessionsFound")}</div>
							) : (
								sessions.map((session) => (
									<button
										type="button"
										key={session.id}
										className="w-full text-left p-4 hover:bg-dash-surface-hover transition-colors group cursor-pointer"
										onClick={() => navigate(`/sessions/${project.id}/${session.id}`)}
									>
										<div className="flex items-center justify-between mb-1">
											<span className="text-xs font-bold text-dash-accent">
												{session.timestamp}
											</span>
											<span className="text-[10px] text-dash-text-muted font-medium group-hover:text-dash-text-secondary transition-colors">
												{session.duration}
											</span>
										</div>
										<p className="text-sm text-dash-text-secondary leading-relaxed truncate">
											{session.summary}
										</p>
									</button>
								))
							)}
						</div>
					</div>
				</div>

				{/* Right Sidebar Column */}
				<div className="flex flex-col gap-6 min-h-0">
					{/* Plan Settings Summary */}
					<div className="bg-dash-surface border border-dash-border rounded-xl p-6 shadow-sm shrink-0">
						<h3 className="text-sm font-bold text-dash-text-secondary uppercase tracking-widest mb-4 flex items-center gap-2">
							{t("planSettingsTitle")}
							<span className="text-[10px] font-normal text-dash-text-muted normal-case">
								{project.planSettings?.scope === "global"
									? t("planScopeGlobal")
									: t("planScopeProject")}
							</span>
						</h3>
						<div className="space-y-4">
							<ConfigRow
								label={t("plansDirectory")}
								value={project.planSettings?.plansDir ?? plansDir}
							/>
							<ConfigRow
								label={t("validationMode")}
								value={project.planSettings?.validationMode ?? "prompt"}
							/>
							<ConfigRow
								label={t("planScopeLabel")}
								value={
									project.planSettings?.scope === "global"
										? t("planScopeGlobal")
										: t("planScopeProject")
								}
							/>
							<ConfigRow
								label={t("activePlansLabel")}
								value={String(project.planSettings?.activePlanCount ?? activePlans.length)}
							/>
						</div>
						<button
							onClick={() => navigate(`/config/project/${project.id}`)}
							className="w-full mt-6 py-2 rounded-lg bg-dash-bg text-xs font-bold text-dash-text-secondary hover:bg-dash-surface-hover transition-colors border border-dash-border"
						>
							{t("editProjectConfig")}
						</button>
					</div>

					{/* Active Plans - Scrollable */}
					<div className="bg-dash-surface border border-dash-border rounded-xl shadow-sm flex flex-col flex-1 min-h-0">
						<div className="p-4 pb-2 border-b border-dash-border shrink-0">
							<h3 className="text-sm font-bold text-dash-text-secondary uppercase tracking-widest flex items-center justify-between">
								{t("activePlansTitle")}
								<span className="text-[10px] bg-dash-accent-subtle text-dash-accent px-1.5 py-0.5 rounded-full">
									{activePlans.length}
								</span>
							</h3>
						</div>
						{desktopMode ? (
							<p className="px-4 text-[11px] text-dash-text-muted">
								{t(DESKTOP_PLANS_MESSAGE_KEY)}
							</p>
						) : null}
						<div className="overflow-y-auto flex-1 px-4 py-2 space-y-2">
							{activePlans.length === 0 ? (
								<div className="text-center text-dash-text-muted py-4">
									{t("noActivePlansFound")}
								</div>
							) : (
								activePlans.map((plan) => (
									<div
										key={plan.planFile}
										className="flex flex-col gap-2 border-l-2 border-dash-accent/20 pl-3 py-2"
									>
										<div className="flex items-start justify-between gap-2">
											<span className="text-sm font-semibold text-dash-text">
												{plan.title ?? plan.planDir.split(/[\\/]/).filter(Boolean).pop()}
											</span>
											<PlanStatusBadge status={plan.status ?? "pending"} />
										</div>
										<div className="h-1.5 rounded-full bg-dash-border overflow-hidden">
											<div
												className="h-full bg-dash-accent transition-all"
												style={{ width: `${plan.progressPct}%` }}
											/>
										</div>
										<p className="text-[10px] text-dash-text-muted leading-tight">
											{t("progressLabel")}: {plan.progressPct}% • {plan.completed}/
											{plan.totalPhases}
										</p>
										{plan.blockedBy.length > 0 ? (
											<p className="text-[10px] text-dash-text-muted leading-tight">
												{t("blockedByLabel")}: {plan.blockedBy[0]}
											</p>
										) : null}
										<div className="flex items-center gap-2">
											<button
												type="button"
												onClick={() => openPlan(plan.planDir)}
												disabled={desktopMode}
												className="text-xs font-bold text-dash-text-muted hover:text-dash-accent transition-colors disabled:cursor-not-allowed disabled:opacity-50"
											>
												{t("openPlan")}
											</button>
											<button
												type="button"
												onClick={openKanban}
												disabled={desktopMode}
												className="text-xs font-bold text-dash-text-muted hover:text-dash-accent transition-colors disabled:cursor-not-allowed disabled:opacity-50"
											>
												{t("openKanban")}
											</button>
										</div>
									</div>
								))
							)}
						</div>
						<div className="p-4 pt-2 border-t border-dash-border shrink-0 flex gap-2">
							<button
								type="button"
								onClick={openPlansDashboard}
								disabled={desktopMode}
								className="flex-1 text-xs font-bold text-dash-text-muted hover:text-dash-accent transition-colors text-center block disabled:cursor-not-allowed disabled:opacity-50"
							>
								{t("plansNav")} →
							</button>
							<button
								type="button"
								onClick={openKanban}
								disabled={desktopMode}
								className="flex-1 text-xs font-bold text-dash-text-muted hover:text-dash-accent transition-colors text-center block disabled:cursor-not-allowed disabled:opacity-50"
							>
								{t("openKanban")} →
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

const HealthBadge: React.FC<{ status: HealthStatus }> = ({ status }) => {
	const styles = {
		[HealthStatus.HEALTHY]: "bg-dash-accent-subtle text-dash-accent border-dash-accent/20",
		[HealthStatus.WARNING]: "bg-orange-500/10 text-orange-600 border-orange-500/20",
		[HealthStatus.ERROR]: "bg-red-500/10 text-red-600 border-red-500/20",
		[HealthStatus.LOADING]: "bg-dash-border/20 text-dash-text-muted border-dash-border",
		[HealthStatus.UNKNOWN]: "bg-dash-border/20 text-dash-text-muted border-dash-border",
	};

	return (
		<span
			className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-widest ${styles[status]}`}
		>
			{status}
		</span>
	);
};

const ActionButtonWithPicker: React.FC<{
	icon: string;
	label: string;
	sub: string;
	disabled?: boolean;
	options: ActionAppOption[];
	value: string;
	fallbackLabel: string;
	onClick?: () => void;
	onChange: (value: string) => void | Promise<void>;
}> = ({ icon, label, sub, disabled, options, value, fallbackLabel, onClick, onChange }) => {
	const { t } = useI18n();

	return (
		<div className="flex flex-col gap-2">
			<ActionButton icon={icon} label={label} sub={sub} onClick={onClick} disabled={disabled} />
			<select
				value={value}
				onChange={(event) => void onChange(event.target.value)}
				className="w-full rounded-md border border-dash-border bg-dash-surface px-2 py-1 text-xs text-dash-text-secondary"
			>
				<option value={GLOBAL_OPTION_VALUE}>{fallbackLabel}</option>
				{options.map((option) => (
					<option key={option.id} value={option.id} disabled={!option.available}>
						{`${option.label} • ${t(option.detected ? "detected" : "notDetected")}`}
					</option>
				))}
			</select>
		</div>
	);
};

const ActionButton: React.FC<{
	icon: string;
	label: string;
	sub: string;
	highlight?: boolean;
	onClick?: () => void;
	disabled?: boolean;
}> = ({ icon, label, sub, highlight, onClick, disabled }) => (
	<button
		onClick={onClick}
		disabled={disabled}
		className={`p-4 rounded-xl border flex flex-col gap-1 transition-all group ${
			highlight
				? "bg-dash-accent-subtle border-dash-accent/30 hover:bg-dash-accent-glow hover:border-dash-accent/50 shadow-sm shadow-dash-accent/5"
				: "bg-dash-surface border-dash-border hover:bg-dash-surface-hover hover:border-dash-text-muted shadow-sm"
		} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
	>
		<span className="text-2xl mb-1 group-hover:scale-110 transition-transform">{icon}</span>
		<span className="text-sm font-bold text-dash-text">{label}</span>
		<span className="text-[10px] text-dash-text-muted font-medium truncate italic">{sub}</span>
	</button>
);

const ConfigRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
	<div className="flex items-center justify-between text-xs py-1.5 border-b border-dash-border/50 last:border-0">
		<span className="text-dash-text-muted font-medium">{label}</span>
		<span className="text-dash-text font-bold mono uppercase text-[10px] tracking-tight">
			{value}
		</span>
	</div>
);

const PlanStatusBadge: React.FC<{ status: string }> = ({ status }) => {
	const styles: Record<string, string> = {
		pending: "bg-amber-400/10 text-amber-700 border-amber-400/20",
		"in-progress": "bg-sky-400/10 text-sky-700 border-sky-400/20",
		"in-review": "bg-violet-400/10 text-violet-700 border-violet-400/20",
		done: "bg-emerald-400/10 text-emerald-700 border-emerald-400/20",
		cancelled: "bg-rose-400/10 text-rose-700 border-rose-400/20",
	};

	return (
		<span
			className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
				styles[status] ?? styles.pending
			}`}
		>
			{status}
		</span>
	);
};

export default ProjectDashboard;
