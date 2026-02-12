import type {
	MigrationDiscovery,
	MigrationExecutionResponse,
	MigrationIncludeOptions,
	MigrationProviderInfo,
} from "@/types";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AgentIcon from "../components/skills/agent-icon";
import { type TranslationKey, useI18n } from "../i18n";
import {
	executeMigration,
	fetchMigrationDiscovery,
	fetchMigrationProviders,
} from "../services/api";

const DEFAULT_INCLUDE: MigrationIncludeOptions = {
	agents: true,
	commands: true,
	skills: true,
	config: true,
	rules: true,
};

const TYPE_ORDER: Array<keyof MigrationIncludeOptions> = [
	"agents",
	"commands",
	"skills",
	"config",
	"rules",
];

const TYPE_LABEL_KEYS: Record<keyof MigrationIncludeOptions, TranslationKey> = {
	agents: "migrateTypeAgents",
	commands: "migrateTypeCommands",
	skills: "migrateTypeSkills",
	config: "migrateTypeConfig",
	rules: "migrateTypeRules",
};

const MigratePage: React.FC = () => {
	const { t } = useI18n();

	const [providers, setProviders] = useState<MigrationProviderInfo[]>([]);
	const [discovery, setDiscovery] = useState<MigrationDiscovery | null>(null);
	const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
	const [include, setInclude] = useState<MigrationIncludeOptions>(DEFAULT_INCLUDE);
	const [installGlobally, setInstallGlobally] = useState(false);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [executing, setExecuting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [lastResult, setLastResult] = useState<MigrationExecutionResponse | null>(null);

	const loadData = useCallback(
		async (isRefresh = false) => {
			try {
				if (isRefresh) {
					setRefreshing(true);
				} else {
					setLoading(true);
				}
				setError(null);

				const [providerResponse, discoveryResponse] = await Promise.all([
					fetchMigrationProviders(),
					fetchMigrationDiscovery(),
				]);

				setProviders(providerResponse.providers);
				setDiscovery(discoveryResponse);

				setSelectedProviders((current) => {
					const available = providerResponse.providers.map((provider) => provider.name);
					const preserved = current.filter((provider) => available.includes(provider));
					if (preserved.length > 0) {
						return preserved;
					}

					const recommendedDetected = providerResponse.providers
						.filter((provider) => provider.recommended && provider.detected)
						.map((provider) => provider.name);
					if (recommendedDetected.length > 0) {
						return recommendedDetected;
					}

					const detected = providerResponse.providers
						.filter((provider) => provider.detected)
						.map((provider) => provider.name);
					if (detected.length > 0) {
						return detected;
					}

					return providerResponse.providers
						.filter((provider) => provider.recommended)
						.map((provider) => provider.name);
				});
			} catch (err) {
				setError(err instanceof Error ? err.message : t("migrateDetectFailed"));
			} finally {
				setLoading(false);
				setRefreshing(false);
			}
		},
		[t],
	);

	useEffect(() => {
		loadData();
	}, [loadData]);

	const providerByName = useMemo(() => {
		const map = new Map<string, MigrationProviderInfo>();
		for (const provider of providers) {
			map.set(provider.name, provider);
		}
		return map;
	}, [providers]);

	const detectedProviderCount = useMemo(
		() => providers.filter((provider) => provider.detected).length,
		[providers],
	);

	const selectedProviderCount = selectedProviders.length;

	const enabledTypeCount = useMemo(
		() => TYPE_ORDER.filter((type) => include[type]).length,
		[include],
	);

	const preflightWarnings = useMemo(() => {
		const warnings: string[] = [];

		if (
			include.commands &&
			selectedProviders.includes("codex") &&
			!installGlobally &&
			providerByName.get("codex")?.commandsGlobalOnly
		) {
			warnings.push(t("migrateGlobalForced"));
		}

		for (const type of TYPE_ORDER) {
			if (!include[type]) continue;
			const unsupportedProviders = selectedProviders
				.filter((provider) => !providerByName.get(provider)?.capabilities[type])
				.map((provider) => providerByName.get(provider)?.displayName || provider);
			if (unsupportedProviders.length > 0) {
				warnings.push(`${t("migrateUnsupported")}: ${type} -> ${unsupportedProviders.join(", ")}`);
			}
		}

		return warnings;
	}, [include, installGlobally, providerByName, selectedProviders, t]);

	const applyPreset = useCallback(
		(preset: "codex" | "antigravity" | "core" | "detected") => {
			if (preset === "codex") {
				setSelectedProviders(["codex"]);
				return;
			}
			if (preset === "antigravity") {
				setSelectedProviders(["antigravity"]);
				return;
			}
			if (preset === "core") {
				const coreProviders = ["codex", "antigravity"].filter((provider) =>
					providers.some((entry) => entry.name === provider),
				);
				setSelectedProviders(coreProviders);
				return;
			}

			const detected = providers
				.filter((provider) => provider.detected)
				.map((provider) => provider.name);
			setSelectedProviders(detected);
		},
		[providers],
	);

	const toggleProvider = useCallback((provider: string) => {
		setSelectedProviders((current) => {
			if (current.includes(provider)) {
				return current.filter((entry) => entry !== provider);
			}
			return [...current, provider];
		});
	}, []);

	const toggleType = useCallback((type: keyof MigrationIncludeOptions) => {
		setInclude((current) => ({
			...current,
			[type]: !current[type],
		}));
	}, []);

	const runMigration = useCallback(async () => {
		if (selectedProviders.length === 0) {
			setError(t("migrateSelectProvider"));
			return;
		}
		if (enabledTypeCount === 0) {
			setError(t("migrateNoTypesEnabled"));
			return;
		}

		try {
			setExecuting(true);
			setError(null);

			const response = await executeMigration({
				providers: selectedProviders,
				global: installGlobally,
				include,
			});

			setLastResult(response);
			if (response.effectiveGlobal !== installGlobally) {
				setInstallGlobally(response.effectiveGlobal);
			}

			const refreshedDiscovery = await fetchMigrationDiscovery();
			setDiscovery(refreshedDiscovery);
		} catch (err) {
			setError(err instanceof Error ? err.message : t("migrateExecuteFailed"));
		} finally {
			setExecuting(false);
		}
	}, [enabledTypeCount, include, installGlobally, selectedProviders, t]);

	const canRun = !executing && selectedProviders.length > 0 && enabledTypeCount > 0;

	if (loading) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-center">
					<div className="w-8 h-8 border-4 border-dash-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
					<p className="text-dash-text-muted">{t("migrateDiscovering")}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full flex flex-col overflow-hidden">
			<div className="border-b border-dash-border bg-dash-surface px-8 py-5">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div>
						<h1 className="text-xl font-bold text-dash-text">{t("migrateTitle")}</h1>
						<p className="text-sm text-dash-text-muted mt-0.5">{t("migrateSubtitle")}</p>
					</div>
					<div className="flex items-center gap-6">
						<div className="text-center">
							<div className="text-xl font-bold text-dash-accent">
								{discovery?.counts.agents ?? 0}
							</div>
							<div className="text-[11px] text-dash-text-muted uppercase tracking-wide">
								{t("agents")}
							</div>
						</div>
						<div className="text-center">
							<div className="text-xl font-bold text-dash-accent">{detectedProviderCount}</div>
							<div className="text-[11px] text-dash-text-muted uppercase tracking-wide">
								{t("migrateDetectedProviders")}
							</div>
						</div>
						<div className="text-center">
							<div className="text-xl font-bold text-dash-accent">{selectedProviderCount}</div>
							<div className="text-[11px] text-dash-text-muted uppercase tracking-wide">
								{t("migrateSelectedProviders")}
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto p-8 space-y-6">
				{error && (
					<div className="px-4 py-3 border border-red-500/30 bg-red-500/10 rounded-lg text-sm text-red-400">
						{error}
					</div>
				)}

				<div className="bg-dash-surface border border-dash-border rounded-lg p-5">
					<div className="flex flex-wrap items-center justify-between gap-3 mb-4">
						<h2 className="text-sm font-semibold text-dash-text">{t("migrateSourceSummary")}</h2>
						<button
							type="button"
							onClick={() => loadData(true)}
							disabled={refreshing}
							className="px-3 py-1.5 bg-dash-bg border border-dash-border rounded-md text-xs text-dash-text-secondary hover:bg-dash-surface-hover disabled:opacity-50"
						>
							{refreshing ? t("checking") : t("migrateRefresh")}
						</button>
					</div>
					<div className="grid grid-cols-2 md:grid-cols-5 gap-3">
						{TYPE_ORDER.map((type) => (
							<div
								key={type}
								className="px-3 py-2 bg-dash-bg border border-dash-border rounded-md text-center"
							>
								<p className="text-[11px] uppercase tracking-wide text-dash-text-muted">
									{t(TYPE_LABEL_KEYS[type])}
								</p>
								<p className="text-lg font-semibold text-dash-text">
									{discovery?.counts[type] ?? 0}
								</p>
							</div>
						))}
					</div>
				</div>

				<div className="bg-dash-surface border border-dash-border rounded-lg p-5">
					<div className="flex flex-wrap gap-2 mb-4">
						<button
							type="button"
							onClick={() => applyPreset("codex")}
							className="px-3 py-1.5 bg-dash-bg border border-dash-border rounded-md text-xs text-dash-text-secondary hover:bg-dash-surface-hover"
						>
							{t("migratePresetCodex")}
						</button>
						<button
							type="button"
							onClick={() => applyPreset("antigravity")}
							className="px-3 py-1.5 bg-dash-bg border border-dash-border rounded-md text-xs text-dash-text-secondary hover:bg-dash-surface-hover"
						>
							{t("migratePresetAntigravity")}
						</button>
						<button
							type="button"
							onClick={() => applyPreset("core")}
							className="px-3 py-1.5 bg-dash-bg border border-dash-border rounded-md text-xs text-dash-text-secondary hover:bg-dash-surface-hover"
						>
							{t("migratePresetBoth")}
						</button>
						<button
							type="button"
							onClick={() => applyPreset("detected")}
							className="px-3 py-1.5 bg-dash-bg border border-dash-border rounded-md text-xs text-dash-text-secondary hover:bg-dash-surface-hover"
						>
							{t("migratePresetDetected")}
						</button>
					</div>

					{providers.length === 0 ? (
						<div className="text-sm text-dash-text-muted">{t("migrateNoProviders")}</div>
					) : (
						<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
							{providers.map((provider) => {
								const isSelected = selectedProviders.includes(provider.name);
								return (
									<button
										type="button"
										key={provider.name}
										onClick={() => toggleProvider(provider.name)}
										className={`text-left p-3 rounded-lg border transition-colors ${
											isSelected
												? "bg-dash-accent-subtle border-dash-accent/40"
												: "bg-dash-bg border-dash-border hover:bg-dash-surface-hover"
										}`}
									>
										<div className="flex items-start justify-between gap-3">
											<div className="flex items-center gap-2 min-w-0">
												<AgentIcon
													agentName={provider.name}
													displayName={provider.displayName}
													size={20}
												/>
												<div className="min-w-0">
													<p className="text-sm font-medium text-dash-text truncate">
														{provider.displayName}
													</p>
													<p className="text-[11px] text-dash-text-muted">
														{provider.detected
															? t("migrateDetectedTag")
															: t("migrateNotDetectedTag")}
													</p>
												</div>
											</div>
											<input type="checkbox" checked={isSelected} readOnly className="mt-1" />
										</div>
										<div className="mt-3 flex flex-wrap gap-1.5">
											{TYPE_ORDER.map((type) => (
												<span
													key={type}
													className={`text-[10px] uppercase px-1.5 py-0.5 rounded border ${
														provider.capabilities[type]
															? "border-dash-accent/40 text-dash-accent"
															: "border-dash-border text-dash-text-muted"
													}`}
												>
													{type}
												</span>
											))}
										</div>
									</button>
								);
							})}
						</div>
					)}
				</div>

				<div className="bg-dash-surface border border-dash-border rounded-lg p-5">
					<div className="grid gap-6 lg:grid-cols-2">
						<div>
							<h3 className="text-sm font-semibold text-dash-text mb-3">{t("migrateScope")}</h3>
							<div className="inline-flex rounded-md border border-dash-border overflow-hidden">
								<button
									type="button"
									onClick={() => setInstallGlobally(false)}
									className={`px-3 py-2 text-sm ${
										!installGlobally
											? "bg-dash-accent-subtle text-dash-accent"
											: "bg-dash-bg text-dash-text-secondary"
									}`}
								>
									{t("migrateScopeProject")}
								</button>
								<button
									type="button"
									onClick={() => setInstallGlobally(true)}
									className={`px-3 py-2 text-sm border-l border-dash-border ${
										installGlobally
											? "bg-dash-accent-subtle text-dash-accent"
											: "bg-dash-bg text-dash-text-secondary"
									}`}
								>
									{t("migrateScopeGlobal")}
								</button>
							</div>
						</div>

						<div>
							<h3 className="text-sm font-semibold text-dash-text mb-3">{t("migrateTypes")}</h3>
							<div className="grid grid-cols-2 gap-2">
								{TYPE_ORDER.map((type) => (
									<label
										key={type}
										className="flex items-center gap-2 text-sm text-dash-text-secondary"
									>
										<input
											type="checkbox"
											checked={include[type]}
											onChange={() => toggleType(type)}
										/>
										{t(TYPE_LABEL_KEYS[type])}
									</label>
								))}
							</div>
						</div>
					</div>

					{preflightWarnings.length > 0 && (
						<div className="mt-4 space-y-2">
							{preflightWarnings.map((warning) => (
								<p
									key={warning}
									className="text-xs px-3 py-2 border border-yellow-500/30 bg-yellow-500/10 rounded text-yellow-400"
								>
									{warning}
								</p>
							))}
						</div>
					)}

					<div className="mt-5">
						<button
							type="button"
							onClick={runMigration}
							disabled={!canRun}
							className="px-4 py-2 bg-dash-accent text-white rounded-md text-sm font-semibold hover:bg-dash-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{executing ? t("migrateRunning") : t("migrateRun")}
						</button>
					</div>
				</div>

				{lastResult && (
					<div className="bg-dash-surface border border-dash-border rounded-lg p-5">
						<h2 className="text-sm font-semibold text-dash-text mb-4">{t("migrateResults")}</h2>

						<div className="grid grid-cols-3 gap-3 mb-4">
							<div className="px-3 py-2 bg-dash-bg border border-dash-border rounded-md">
								<p className="text-[11px] text-dash-text-muted uppercase tracking-wide">
									{t("migrateInstalled")}
								</p>
								<p className="text-lg font-semibold text-green-400">
									{lastResult.counts.installed}
								</p>
							</div>
							<div className="px-3 py-2 bg-dash-bg border border-dash-border rounded-md">
								<p className="text-[11px] text-dash-text-muted uppercase tracking-wide">
									{t("migrateSkipped")}
								</p>
								<p className="text-lg font-semibold text-yellow-400">{lastResult.counts.skipped}</p>
							</div>
							<div className="px-3 py-2 bg-dash-bg border border-dash-border rounded-md">
								<p className="text-[11px] text-dash-text-muted uppercase tracking-wide">
									{t("migrateFailed")}
								</p>
								<p className="text-lg font-semibold text-red-400">{lastResult.counts.failed}</p>
							</div>
						</div>

						{lastResult.warnings.length > 0 && (
							<div className="mb-4 space-y-2">
								{lastResult.warnings.map((warning) => (
									<p
										key={warning}
										className="text-xs px-3 py-2 border border-yellow-500/30 bg-yellow-500/10 rounded text-yellow-400"
									>
										{warning}
									</p>
								))}
							</div>
						)}

						{lastResult.results.length === 0 ? (
							<p className="text-sm text-dash-text-muted">{t("migrateNoResults")}</p>
						) : (
							<div className="overflow-auto border border-dash-border rounded-md">
								<table className="min-w-full text-xs">
									<thead className="bg-dash-bg text-dash-text-muted uppercase tracking-wide">
										<tr>
											<th className="text-left px-3 py-2">{t("migrateProvider")}</th>
											<th className="text-left px-3 py-2">{t("migrateStatus")}</th>
											<th className="text-left px-3 py-2">{t("migratePath")}</th>
											<th className="text-left px-3 py-2">{t("migrateError")}</th>
										</tr>
									</thead>
									<tbody>
										{lastResult.results.map((result, index) => {
											const status = result.success
												? result.skipped
													? t("migrateStatusSkipped")
													: t("migrateStatusInstalled")
												: t("migrateStatusFailed");
											const statusClass = result.success
												? result.skipped
													? "text-yellow-400"
													: "text-green-400"
												: "text-red-400";
											return (
												<tr key={`${result.provider}-${result.path}-${index}`}>
													<td className="px-3 py-2 border-t border-dash-border">
														{result.providerDisplayName}
													</td>
													<td className={`px-3 py-2 border-t border-dash-border ${statusClass}`}>
														{status}
													</td>
													<td className="px-3 py-2 border-t border-dash-border text-dash-text-muted">
														{result.path || "-"}
													</td>
													<td className="px-3 py-2 border-t border-dash-border text-red-400">
														{result.error || result.skipReason || "-"}
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

export default MigratePage;
