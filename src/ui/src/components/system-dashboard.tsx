/**
 * SystemDashboard - System health dashboard for Config Editor
 * Shows CLI version, kit cards with update checks, and environment info
 * Manages batch operations (Check All, Update All) with lifted state
 */
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import SystemBatchControls, { type ComponentUpdateState } from "./system-batch-controls";
import SystemChannelToggle, { type Channel } from "./system-channel-toggle";
import SystemCliCard from "./system-cli-card";
import SystemEnvironmentCard from "./system-environment-card";
import SystemKitCard, { type KitData } from "./system-kit-card";
import type { UpdateStatus } from "./system-status-dot";
import UpdateProgressModal from "./system-update-progress-modal";

interface SystemInfo {
	configPath: string;
	nodeVersion: string;
	bunVersion: string;
	os: string;
	cliVersion: string;
}

interface SystemDashboardProps {
	metadata: Record<string, unknown>;
}

interface UpdateResult {
	current: string;
	latest: string | null;
	updateAvailable: boolean;
}

type ComponentFilter = "all" | "updates" | "up-to-date" | "cli" | "kits";
type ComponentStatus = "idle" | "checking" | "up-to-date" | "update-available";

const CHANNEL_KEY = "claudekit-update-channel";
const COMPONENT_FILTER_KEY = "claudekit-system-filter";

// Detect if version is beta/prerelease
const isBetaVersion = (version: string): boolean => /-(alpha|beta|rc|dev|next)/.test(version);

const parseStoredFilter = (value: string | null): ComponentFilter => {
	if (
		value === "all" ||
		value === "updates" ||
		value === "up-to-date" ||
		value === "cli" ||
		value === "kits"
	) {
		return value;
	}
	return "all";
};

const getStatusPriority = (status: ComponentStatus): number => {
	if (status === "update-available") return 0;
	if (status === "checking") return 1;
	if (status === "idle") return 2;
	return 3;
};

const SystemDashboard: React.FC<SystemDashboardProps> = ({ metadata }) => {
	const { t } = useI18n();
	const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
	const [updateStates, setUpdateStates] = useState<ComponentUpdateState[]>([]);
	const [isCheckingAll, setIsCheckingAll] = useState(false);
	// @ts-expect-error setIsUpdatingAll will be used when batch update is implemented
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const [isUpdatingAll, setIsUpdatingAll] = useState(false);
	const [showBatchUpdateModal, setShowBatchUpdateModal] = useState(false);
	const [channel, setChannel] = useState<Channel>("stable");
	const [componentFilter, setComponentFilter] = useState<ComponentFilter>(() =>
		parseStoredFilter(localStorage.getItem(COMPONENT_FILTER_KEY)),
	);
	const hasPrimedStoredFilter = useRef(false);
	const checkRunIdRef = useRef(0);

	const hasKits = metadata.kits && typeof metadata.kits === "object";
	const kitEntries = hasKits ? Object.entries(metadata.kits as Record<string, unknown>) : [];
	const legacyName = metadata.name as string | undefined;
	const legacyVersion = metadata.version as string | undefined;
	const legacyInstalledAt = metadata.installedAt as string | undefined;
	const hasAnyKit = kitEntries.length > 0 || legacyName;

	// Initialize update states when system info loads
	useEffect(() => {
		if (!systemInfo) return;

		const states: ComponentUpdateState[] = [];

		// Add CLI
		states.push({
			id: "cli",
			type: "cli",
			status: "idle",
			currentVersion: systemInfo.cliVersion,
			latestVersion: null,
		});

		// Add kits
		if (hasKits && kitEntries.length > 0) {
			for (const [kitName, kitData] of kitEntries) {
				const kit = kitData as KitData;
				states.push({
					id: kitName,
					type: "kit",
					status: "idle",
					currentVersion: kit.version ?? "?",
					latestVersion: null,
				});
			}
		} else if (legacyName) {
			states.push({
				id: legacyName,
				type: "kit",
				status: "idle",
				currentVersion: legacyVersion ?? "?",
				latestVersion: null,
			});
		}

		setUpdateStates(states);
	}, [systemInfo, hasKits, kitEntries, legacyName, legacyVersion]);

	// Fetch system info
	useEffect(() => {
		fetch("/api/system/info")
			.then((res) => res.json())
			.then(setSystemInfo)
			.catch(() => setSystemInfo(null));
	}, []);

	// Initialize channel from localStorage or detect from installed version
	useEffect(() => {
		const savedChannel = localStorage.getItem(CHANNEL_KEY) as Channel | null;
		if (savedChannel === "stable" || savedChannel === "beta") {
			setChannel(savedChannel);
		} else if (systemInfo?.cliVersion) {
			// Auto-detect from installed version
			setChannel(isBetaVersion(systemInfo.cliVersion) ? "beta" : "stable");
		}
	}, [systemInfo?.cliVersion]);

	// Persist channel changes to localStorage
	const handleChannelChange = (newChannel: Channel) => {
		setChannel(newChannel);
		localStorage.setItem(CHANNEL_KEY, newChannel);
	};

	useEffect(() => {
		localStorage.setItem(COMPONENT_FILTER_KEY, componentFilter);
	}, [componentFilter]);

	// Handle individual component status change
	const handleStatusChange = (id: string, status: UpdateStatus, latestVersion: string | null) => {
		setUpdateStates((prev) =>
			prev.map((state) => (state.id === id ? { ...state, status, latestVersion } : state)),
		);
	};

	// Handle Check All
	const handleCheckAll = useCallback(async () => {
		if (updateStates.length === 0) return;
		const runId = checkRunIdRef.current + 1;
		checkRunIdRef.current = runId;
		setIsCheckingAll(true);
		setUpdateStates((prev) =>
			prev.map((state) =>
				state.status === "checking" && state.latestVersion === null
					? state
					: { ...state, status: "checking", latestVersion: null },
			),
		);

		try {
			// Check all components in parallel
			const checkPromises = updateStates.map(async (component) => {
				try {
					const params =
						component.type === "cli"
							? `target=cli&channel=${channel}`
							: `target=kit&kit=${component.id}&channel=${channel}`;
					const res = await fetch(`/api/system/check-updates?${params}`);
					const data: UpdateResult = await res.json();

					return {
						id: component.id,
						status: (data.updateAvailable ? "update-available" : "up-to-date") as UpdateStatus,
						latestVersion: data.latest,
					};
				} catch {
					return {
						id: component.id,
						status: "idle" as UpdateStatus,
						latestVersion: null,
					};
				}
			});

			const results = await Promise.all(checkPromises);
			if (checkRunIdRef.current !== runId) return;

			// Update all states
			setUpdateStates((prev) =>
				prev.map((state) => {
					const result = results.find((r) => r.id === state.id);
					return result
						? { ...state, status: result.status, latestVersion: result.latestVersion }
						: state;
				}),
			);
		} finally {
			if (checkRunIdRef.current === runId) {
				setIsCheckingAll(false);
			}
		}
	}, [channel, updateStates]);

	const handleFilterChange = (nextFilter: ComponentFilter) => {
		setComponentFilter(nextFilter);
		const shouldPrimeFilter =
			(nextFilter === "updates" || nextFilter === "up-to-date") &&
			!isCheckingAll &&
			!isUpdatingAll &&
			updateStates.length > 0 &&
			updateStates.every((state) => state.status === "idle");
		if (shouldPrimeFilter) {
			hasPrimedStoredFilter.current = true;
			void handleCheckAll();
		}
	};

	// Handle Update All
	const handleUpdateAll = () => {
		setShowBatchUpdateModal(true);
	};

	const handleBatchUpdateComplete = () => {
		window.location.reload();
	};

	const updatesAvailable = updateStates.filter(
		(state) => state.status === "update-available",
	).length;
	const upToDateCount = updateStates.filter((state) => state.status === "up-to-date").length;
	const checkedCount = updateStates.filter(
		(state) => state.status === "up-to-date" || state.status === "update-available",
	).length;
	const isAnyChecking = updateStates.some((state) => state.status === "checking");
	const installedKitCount =
		hasKits && kitEntries.length > 0 ? kitEntries.length : legacyName ? 1 : 0;
	const cliState = updateStates.find((state) => state.id === "cli")?.status ?? "idle";

	const kitCards = useMemo(() => {
		if (hasKits && kitEntries.length > 0) {
			return kitEntries.map(([kitName, kitData]) => ({
				id: kitName,
				kitName,
				kit: kitData as KitData,
			}));
		}
		if (legacyName) {
			return [
				{
					id: legacyName,
					kitName: legacyName,
					kit: { version: legacyVersion, installedAt: legacyInstalledAt } as KitData,
				},
			];
		}
		return [] as Array<{ id: string; kitName: string; kit: KitData }>;
	}, [hasKits, kitEntries, legacyName, legacyVersion, legacyInstalledAt]);

	const filteredKits = useMemo(() => {
		const kitsWithStatus = kitCards.map((kitCard) => ({
			...kitCard,
			status: (updateStates.find((state) => state.id === kitCard.id)?.status ??
				"idle") as ComponentStatus,
		}));
		const sorted = [...kitsWithStatus].sort((a, b) => {
			const diff = getStatusPriority(a.status) - getStatusPriority(b.status);
			if (diff !== 0) return diff;
			return a.kitName.localeCompare(b.kitName);
		});

		if (componentFilter === "updates") {
			return sorted.filter((entry) => entry.status === "update-available");
		}
		if (componentFilter === "up-to-date") {
			return sorted.filter((entry) => entry.status === "up-to-date");
		}
		if (componentFilter === "cli") {
			return [];
		}
		return sorted;
	}, [kitCards, updateStates, componentFilter]);

	const showCliCard =
		componentFilter === "all" ||
		componentFilter === "cli" ||
		(componentFilter === "updates" && cliState === "update-available") ||
		(componentFilter === "up-to-date" && cliState === "up-to-date");

	const componentCardsVisible = (showCliCard ? 1 : 0) + filteredKits.length;

	useEffect(() => {
		const isFilterView = componentFilter === "updates" || componentFilter === "up-to-date";
		if (!isFilterView || hasPrimedStoredFilter.current) return;
		if (isCheckingAll || isUpdatingAll || updateStates.length === 0) return;
		if (!updateStates.every((state) => state.status === "idle")) {
			hasPrimedStoredFilter.current = true;
			return;
		}
		hasPrimedStoredFilter.current = true;
		void handleCheckAll();
	}, [handleCheckAll, isCheckingAll, isUpdatingAll, updateStates, componentFilter]);

	const noMatchMessage = useMemo(() => {
		if (componentCardsVisible !== 0) return "";
		if ((componentFilter === "updates" || componentFilter === "up-to-date") && isAnyChecking) {
			return t("checkingAll");
		}
		if ((componentFilter === "updates" || componentFilter === "up-to-date") && checkedCount === 0) {
			return t("runCheckAllForFilter");
		}
		if (componentFilter === "updates" && checkedCount > 0 && updatesAvailable === 0) {
			return t("noUpdatesFound");
		}
		if (componentFilter === "up-to-date" && checkedCount > 0 && upToDateCount === 0) {
			return t("noUpToDateYet");
		}
		return t("noComponentsMatchFilter");
	}, [
		componentCardsVisible,
		componentFilter,
		isAnyChecking,
		checkedCount,
		updatesAvailable,
		upToDateCount,
		t,
	]);
	const showNoKitState = !hasAnyKit && componentFilter !== "cli";
	const updatesFilterLabel = t("componentFilterUpdatesCount").replace(
		"{count}",
		updatesAvailable.toString(),
	);
	const upToDateFilterLabel = t("componentFilterUpToDateCount").replace(
		"{count}",
		upToDateCount.toString(),
	);

	return (
		<div className="relative space-y-4">
			<div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
				<div className="absolute -top-20 -right-8 h-56 w-56 rounded-full bg-dash-accent/10 blur-3xl" />
				<div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-dash-accent/5 blur-3xl" />
			</div>

			<section className="dash-panel dash-sticky-glass p-4 md:p-5 sticky top-0 z-10">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div className="space-y-1">
						<p className="mono text-[10px] uppercase tracking-[0.16em] text-dash-text-muted">
							{t("systemControlTower")}
						</p>
						<h2 className="text-xl md:text-2xl font-semibold text-dash-text">
							{t("systemOverviewTitle")}
						</h2>
						<p className="text-sm text-dash-text-secondary max-w-2xl">{t("systemOverviewDesc")}</p>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<SystemChannelToggle
							value={channel}
							onChange={handleChannelChange}
							disabled={isCheckingAll || isUpdatingAll}
						/>
						{updateStates.length > 0 && (
							<SystemBatchControls
								components={updateStates}
								isChecking={isCheckingAll}
								isUpdating={isUpdatingAll}
								onCheckAll={handleCheckAll}
								onUpdateAll={handleUpdateAll}
							/>
						)}
					</div>
				</div>
			</section>

			<section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
				<KpiCard label={t("components")} value={updateStates.length.toString()} />
				<KpiCard label={t("kitsLabel")} value={installedKitCount.toString()} />
				<KpiCard label={t("updateAvailable")} value={updatesAvailable.toString()} tone="accent" />
				<KpiCard label={t("upToDate")} value={upToDateCount.toString()} tone="success" />
				<KpiCard label={t("checkedComponents")} value={checkedCount.toString()} />
			</section>

			<section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
				<div className="space-y-3 min-w-0">
					<div className="flex flex-wrap items-center justify-between gap-3 px-1">
						<h3 className="text-sm font-semibold uppercase tracking-wide text-dash-text">
							{t("installedComponentsHeading")}
						</h3>
						<fieldset className="flex items-center gap-2">
							<legend className="sr-only">{t("installedComponentsHeading")}</legend>
							<FilterChip
								label={t("componentFilterAll")}
								value={componentFilter}
								activeValue="all"
								onClick={() => handleFilterChange("all")}
							/>
							<FilterChip
								label={updatesFilterLabel}
								value={componentFilter}
								activeValue="updates"
								onClick={() => handleFilterChange("updates")}
							/>
							<FilterChip
								label={upToDateFilterLabel}
								value={componentFilter}
								activeValue="up-to-date"
								onClick={() => handleFilterChange("up-to-date")}
							/>
							<FilterChip
								label={t("componentFilterCli")}
								value={componentFilter}
								activeValue="cli"
								onClick={() => handleFilterChange("cli")}
							/>
							<FilterChip
								label={t("componentFilterKits")}
								value={componentFilter}
								activeValue="kits"
								onClick={() => handleFilterChange("kits")}
							/>
						</fieldset>
					</div>

					{showCliCard && (
						<SystemCliCard
							version={systemInfo?.cliVersion ?? "..."}
							installedAt={undefined}
							externalStatus={updateStates.find((s) => s.id === "cli")?.status}
							externalLatestVersion={
								updateStates.find((s) => s.id === "cli")?.latestVersion ?? null
							}
							onStatusChange={(status, latestVersion) =>
								handleStatusChange("cli", status, latestVersion)
							}
							disabled={isCheckingAll || isUpdatingAll}
							channel={channel}
						/>
					)}

					{filteredKits.map((entry) => {
						const state = updateStates.find((s) => s.id === entry.id);
						return (
							<SystemKitCard
								key={entry.id}
								kitName={entry.kitName}
								kit={entry.kit}
								externalStatus={state?.status}
								externalLatestVersion={state?.latestVersion ?? null}
								onStatusChange={(status, latestVersion) =>
									handleStatusChange(entry.id, status, latestVersion)
								}
								disabled={isCheckingAll || isUpdatingAll}
								channel={channel}
							/>
						);
					})}

					{showNoKitState && (
						<div className="dash-panel-muted p-6 text-center opacity-80">
							<p className="text-sm text-dash-text-secondary">{t("noKitInstalled")}</p>
						</div>
					)}

					{!showNoKitState && componentCardsVisible === 0 && (
						<div className="dash-panel-muted p-6 text-center opacity-80">
							<p className="text-sm text-dash-text-secondary">{noMatchMessage}</p>
						</div>
					)}
				</div>

				<aside className="space-y-3 xl:sticky xl:top-20 self-start">
					<div className="dash-panel p-4 space-y-3">
						<h3 className="text-sm font-semibold uppercase tracking-wide text-dash-text">
							{t("updateReadiness")}
						</h3>
						<div className="space-y-2">
							<ReadinessRow
								label={t("updateAvailable")}
								value={updatesAvailable.toString()}
								tone={updatesAvailable > 0 ? "accent" : "default"}
							/>
							<ReadinessRow label={t("upToDate")} value={upToDateCount.toString()} tone="success" />
							<ReadinessRow label={t("checkedComponents")} value={checkedCount.toString()} />
							<ReadinessRow
								label={t("activeChannel")}
								value={channel === "beta" ? t("channelBeta") : t("channelStable")}
							/>
						</div>
					</div>

					{systemInfo && (
						<SystemEnvironmentCard
							configPath={systemInfo.configPath}
							nodeVersion={systemInfo.nodeVersion}
							bunVersion={systemInfo.bunVersion}
							os={systemInfo.os}
						/>
					)}
				</aside>
			</section>

			<UpdateProgressModal
				isOpen={showBatchUpdateModal}
				onClose={() => setShowBatchUpdateModal(false)}
				target="cli"
				mode="batch"
				components={updateStates
					.filter((s) => s.status === "update-available")
					.map((s) => ({ id: s.id, name: s.id === "cli" ? "CLI" : `${s.id} Kit` }))}
				onComplete={handleBatchUpdateComplete}
			/>
		</div>
	);
};

const KpiCard: React.FC<{
	label: string;
	value: string;
	tone?: "default" | "accent" | "success";
}> = ({ label, value, tone = "default" }) => {
	const toneClass =
		tone === "accent"
			? "text-dash-accent"
			: tone === "success"
				? "text-emerald-500"
				: "text-dash-text";
	return (
		<div className="dash-panel p-3">
			<p className="text-[11px] uppercase tracking-wide text-dash-text-muted">{label}</p>
			<p className={`mt-1 mono text-xl font-semibold ${toneClass}`}>{value}</p>
		</div>
	);
};

const ReadinessRow: React.FC<{
	label: string;
	value: string;
	tone?: "default" | "accent" | "success";
}> = ({ label, value, tone = "default" }) => {
	const toneClass =
		tone === "accent"
			? "text-dash-accent"
			: tone === "success"
				? "text-emerald-500"
				: "text-dash-text-secondary";
	return (
		<div className="flex items-center justify-between rounded-lg border border-dash-border bg-dash-bg/70 px-3 py-2">
			<span className="text-xs text-dash-text-muted">{label}</span>
			<span className={`mono text-xs font-semibold ${toneClass}`}>{value}</span>
		</div>
	);
};

const FilterChip: React.FC<{
	label: string;
	value: ComponentFilter;
	activeValue: ComponentFilter;
	onClick: () => void;
}> = ({ label, value, activeValue, onClick }) => {
	const active = value === activeValue;
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			className={`dash-focus-ring px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
				active
					? "border-dash-accent/30 bg-dash-accent-subtle text-dash-accent"
					: "border-dash-border bg-dash-surface text-dash-text-muted hover:text-dash-text hover:bg-dash-surface-hover"
			}`}
		>
			{label}
		</button>
	);
};

export default SystemDashboard;
