import type {
	MigrationDiscovery,
	MigrationIncludeOptions,
	MigrationProviderInfo,
	MigrationResultEntry,
} from "@/types";
import type React from "react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { MigrationSummary } from "../components/migrate/migration-summary";
import { ReconcilePlanView } from "../components/migrate/reconcile-plan-view";
import AgentIcon from "../components/skills/agent-icon";
import { useMigrationPlan } from "../hooks/useMigrationPlan";
import { type TranslationKey, useI18n } from "../i18n";
import { fetchMigrationDiscovery, fetchMigrationProviders } from "../services/api";

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

type ProviderFilterMode = "all" | "selected" | "detected" | "recommended" | "not-detected";

const SECTION_COLORS: Record<"detected" | "not-detected", string> = {
	detected: "#D4A574",
	"not-detected": "#8B9DC3",
};

interface SummaryStatProps {
	label: string;
	value: number;
	tone?: "default" | "accent" | "success";
}

const SummaryStat: React.FC<SummaryStatProps> = ({ label, value, tone = "default" }) => {
	const valueClass =
		tone === "accent"
			? "text-dash-accent"
			: tone === "success"
				? "text-green-400"
				: "text-dash-text";

	return (
		<div className="rounded-lg border border-dash-border bg-dash-bg/70 px-3 py-2.5">
			<p className="text-[10px] font-semibold uppercase tracking-wide text-dash-text-muted">
				{label}
			</p>
			<p className={`mt-1 text-lg font-semibold ${valueClass}`}>{value}</p>
		</div>
	);
};

function getResultStatusLabel(
	result: MigrationResultEntry,
	t: (key: TranslationKey) => string,
): { label: string; className: string } {
	if (!result.success) {
		return { label: t("migrateStatusFailed"), className: "text-red-400" };
	}
	if (result.skipped) {
		return { label: t("migrateStatusSkipped"), className: "text-yellow-400" };
	}
	return { label: t("migrateStatusInstalled"), className: "text-green-400" };
}

const DISALLOWED_FORMAT_CODE_POINTS = new Set([
	0x200b, // ZERO WIDTH SPACE
	0x200c, // ZERO WIDTH NON-JOINER
	0x200d, // ZERO WIDTH JOINER
	0x2060, // WORD JOINER
	0xfeff, // ZERO WIDTH NO-BREAK SPACE (BOM)
	0x2028, // LINE SEPARATOR
	0x2029, // PARAGRAPH SEPARATOR
	0x202a, // LRE
	0x202b, // RLE
	0x202c, // PDF
	0x202d, // LRO
	0x202e, // RLO
	0x2066, // LRI
	0x2067, // RLI
	0x2068, // FSI
	0x2069, // PDI
]);

function isDisallowedControlCode(codePoint: number): boolean {
	if (codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d) {
		return true;
	}

	return (
		(codePoint >= 0x00 && codePoint <= 0x08) ||
		(codePoint >= 0x0b && codePoint <= 0x1f) ||
		(codePoint >= 0x7f && codePoint <= 0x9f) ||
		DISALLOWED_FORMAT_CODE_POINTS.has(codePoint)
	);
}

function sanitizeDisplayString(value: string): string {
	let output = "";
	for (const char of value) {
		const codePoint = char.codePointAt(0);
		if (codePoint === undefined) continue;
		if (!isDisallowedControlCode(codePoint)) {
			output += char;
		}
	}
	return output;
}

interface ProviderRowProps {
	provider: MigrationProviderInfo;
	include: MigrationIncludeOptions;
	isSelected: boolean;
	onToggleSelect: (provider: string) => void;
	onOpenDetails: (providerName: string) => void;
	t: (key: TranslationKey) => string;
}

const ProviderRow: React.FC<ProviderRowProps> = ({
	provider,
	include,
	isSelected,
	onToggleSelect,
	onOpenDetails,
	t,
}) => {
	const supportedCount = TYPE_ORDER.filter((type) => provider.capabilities[type]).length;
	const incompatibleWithEnabledTypes = TYPE_ORDER.some(
		(type) => include[type] && !provider.capabilities[type],
	);

	return (
		<div
			className={`relative rounded-xl border px-4 py-3 cursor-pointer transition-all ${
				isSelected
					? "bg-dash-accent-subtle border-dash-accent/30 shadow-sm shadow-dash-accent/10"
					: incompatibleWithEnabledTypes
						? "bg-dash-surface border-yellow-500/25 hover:bg-dash-surface-hover hover:border-yellow-500/40"
						: "bg-dash-surface border-dash-border hover:bg-dash-surface-hover hover:border-dash-accent/25"
			}`}
		>
			<button
				type="button"
				onClick={() => onOpenDetails(provider.name)}
				aria-label={`${provider.displayName} details`}
				className="absolute inset-0 z-10 rounded-xl dash-focus-ring"
			/>

			<div className="relative z-0 flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1.25fr)_140px_minmax(0,220px)_auto] lg:items-center lg:gap-4">
				<div className="min-w-0 space-y-1.5">
					<div className="flex flex-wrap items-center gap-2">
						<AgentIcon agentName={provider.name} displayName={provider.displayName} size={18} />
						<span className="text-sm font-semibold text-dash-text truncate">
							{provider.displayName}
						</span>
						{provider.recommended && (
							<span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-dash-accent/30 text-dash-accent">
								{t("migrateFilterRecommended")}
							</span>
						)}
						{provider.commandsGlobalOnly && (
							<span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-yellow-500/30 text-yellow-400">
								{t("migrateGlobalOnlyCommandsShort")}
							</span>
						)}
					</div>
					<div className="text-xs text-dash-text-muted truncate">
						{provider.name} · {supportedCount}/5 {t("migrateCapabilitiesLabel")}
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-1.5 text-[11px] lg:flex-col lg:items-start lg:gap-1">
					<span className={provider.detected ? "text-dash-accent" : "text-dash-text-muted"}>
						{provider.detected ? t("migrateDetectedTag") : t("migrateNotDetectedTag")}
					</span>
					<span className="text-dash-text-muted">
						{provider.recommended ? t("migrateFilterRecommended") : "-"}
					</span>
				</div>

				<div className="flex flex-wrap gap-1">
					{TYPE_ORDER.map((type) => {
						const supported = provider.capabilities[type];
						const enabled = include[type];
						return (
							<span
								key={type}
								className={`text-[10px] uppercase px-1.5 py-0.5 rounded border ${
									supported && enabled
										? "border-dash-accent/45 text-dash-accent"
										: supported
											? "border-dash-border text-dash-text-secondary"
											: "border-dash-border text-dash-text-muted opacity-60"
								}`}
							>
								{t(TYPE_LABEL_KEYS[type])}
							</span>
						);
					})}
				</div>

				<div className="relative z-20 flex justify-start lg:justify-end">
					<button
						type="button"
						onClick={() => onToggleSelect(provider.name)}
						className={`dash-focus-ring px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
							isSelected
								? "bg-transparent text-dash-text-secondary border border-dash-border hover:bg-dash-surface-hover"
								: "bg-dash-accent text-white hover:bg-dash-accent/90"
						}`}
					>
						{isSelected ? t("migrateSelectedButton") : t("migrateSelectButton")}
					</button>
				</div>
			</div>
		</div>
	);
};

interface ProviderDetailPanelProps {
	provider: MigrationProviderInfo;
	include: MigrationIncludeOptions;
	isSelected: boolean;
	latestResult: MigrationResultEntry | null;
	onToggleSelect: (provider: string) => void;
	onClose: () => void;
	t: (key: TranslationKey) => string;
}

const ProviderDetailPanel: React.FC<ProviderDetailPanelProps> = ({
	provider,
	include,
	isSelected,
	latestResult,
	onToggleSelect,
	onClose,
	t,
}) => {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const previouslyFocusedRef = useRef<HTMLElement | null>(null);

	const restoreFocus = useCallback(() => {
		const previous = previouslyFocusedRef.current;
		previouslyFocusedRef.current = null;
		if (previous && document.contains(previous)) {
			previous.focus();
		}
	}, []);

	const handleDialogClose = useCallback(() => {
		onClose();
		restoreFocus();
	}, [onClose, restoreFocus]);

	const requestClose = useCallback(() => {
		const dialog = dialogRef.current;
		if (dialog?.open) {
			dialog.close();
			return;
		}
		onClose();
		restoreFocus();
	}, [onClose, restoreFocus]);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;

		if (!dialog.open) {
			previouslyFocusedRef.current =
				document.activeElement instanceof HTMLElement ? document.activeElement : null;

			try {
				dialog.showModal();
			} catch {
				restoreFocus();
				onClose();
			}
		}

		return () => {
			if (dialog.open) {
				dialog.close();
				return;
			}
			restoreFocus();
		};
	}, [onClose, restoreFocus]);

	return (
		<dialog
			ref={dialogRef}
			aria-label={provider.displayName}
			onClose={handleDialogClose}
			onCancel={(event) => {
				event.preventDefault();
				requestClose();
			}}
			onClick={(event) => {
				if (event.target === event.currentTarget) {
					requestClose();
				}
			}}
			className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none overflow-hidden border-0 bg-transparent p-0 backdrop:bg-black/50"
		>
			<div className="ml-auto h-full w-full sm:w-[460px] bg-dash-surface border-l border-dash-border shadow-2xl flex flex-col animate-slide-in">
				<div className="px-6 py-5 border-b border-dash-border">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<div className="flex items-center gap-2.5">
								<AgentIcon agentName={provider.name} displayName={provider.displayName} size={22} />
								<h2 className="text-xl font-bold text-dash-text truncate">
									{provider.displayName}
								</h2>
							</div>
							<div className="flex flex-wrap items-center gap-1.5 mt-2">
								<span className="text-[11px] text-dash-text-muted font-mono">{provider.name}</span>
								<span
									className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border ${
										provider.detected
											? "border-dash-accent/30 text-dash-accent"
											: "border-dash-border text-dash-text-muted"
									}`}
								>
									{provider.detected ? t("migrateDetectedTag") : t("migrateNotDetectedTag")}
								</span>
								{provider.recommended && (
									<span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border border-dash-accent/30 text-dash-accent">
										{t("migrateFilterRecommended")}
									</span>
								)}
							</div>
						</div>
						<button
							type="button"
							onClick={requestClose}
							aria-label={t("detailPanelClose")}
							className="w-8 h-8 flex items-center justify-center rounded-md text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors"
						>
							<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<line x1="18" y1="6" x2="6" y2="18" strokeWidth={2} />
								<line x1="6" y1="6" x2="18" y2="18" strokeWidth={2} />
							</svg>
						</button>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
					<div>
						<h3 className="text-[11px] font-bold uppercase tracking-wide text-dash-text-muted mb-2.5">
							{t("migrateCapabilitiesSection")}
						</h3>
						<div className="space-y-1.5">
							{TYPE_ORDER.map((type) => {
								const supported = provider.capabilities[type];
								const enabled = include[type];
								return (
									<div
										key={type}
										className="flex items-center justify-between px-3 py-2 bg-dash-bg rounded-md"
									>
										<span className="text-sm text-dash-text">{t(TYPE_LABEL_KEYS[type])}</span>
										<div className="flex items-center gap-2">
											<span
												className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${
													enabled
														? "border-dash-accent/35 text-dash-accent"
														: "border-dash-border text-dash-text-muted"
												}`}
											>
												{enabled ? t("migrateIncludedEnabled") : t("migrateIncludedDisabled")}
											</span>
											<span
												className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${
													supported
														? "border-green-500/35 text-green-400"
														: "border-red-500/30 text-red-400"
												}`}
											>
												{supported ? t("migrateSupported") : t("migrateUnsupportedShort")}
											</span>
										</div>
									</div>
								);
							})}
						</div>
					</div>

					{provider.commandsGlobalOnly && include.commands && (
						<div className="px-3 py-2 border border-yellow-500/30 bg-yellow-500/10 rounded text-xs text-yellow-400">
							{t("migrateGlobalForced")}
						</div>
					)}

					<div>
						<h3 className="text-[11px] font-bold uppercase tracking-wide text-dash-text-muted mb-2.5">
							{t("migrateLatestTarget")}
						</h3>
						{latestResult ? (
							<div className="px-3 py-2 bg-dash-bg rounded-md border border-dash-border space-y-2">
								<div className="flex items-center justify-between">
									<span className="text-xs text-dash-text-muted">{t("migrateStatus")}</span>
									<span
										className={`text-xs font-semibold ${getResultStatusLabel(latestResult, t).className}`}
									>
										{getResultStatusLabel(latestResult, t).label}
									</span>
								</div>
								<p className="text-xs font-mono text-dash-text break-all">
									{sanitizeDisplayString(latestResult.path || "-")}
								</p>
								{(latestResult.error || latestResult.skipReason) && (
									<p className="text-xs text-red-400 break-words">
										{sanitizeDisplayString(latestResult.error || latestResult.skipReason || "-")}
									</p>
								)}
							</div>
						) : (
							<p className="text-sm text-dash-text-muted">{t("migrateNoResultForProvider")}</p>
						)}
					</div>
				</div>

				<div className="px-6 py-4 border-t border-dash-border flex items-center justify-between gap-2">
					<button
						type="button"
						onClick={() => onToggleSelect(provider.name)}
						className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
							isSelected
								? "bg-transparent text-dash-text-secondary border border-dash-border hover:bg-dash-surface-hover"
								: "bg-dash-accent text-white hover:bg-dash-accent/90"
						}`}
					>
						{isSelected ? t("migrateUnselectProvider") : t("migrateSelectProviderAction")}
					</button>
					<button
						type="button"
						onClick={requestClose}
						aria-label={t("detailPanelClose")}
						className="px-4 py-2 text-sm font-medium rounded-md border border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover"
					>
						{t("detailPanelClose")}
					</button>
				</div>
			</div>
		</dialog>
	);
};

const MigratePage: React.FC = () => {
	const { t } = useI18n();
	const migration = useMigrationPlan();

	const [providers, setProviders] = useState<MigrationProviderInfo[]>([]);
	const [discovery, setDiscovery] = useState<MigrationDiscovery | null>(null);
	const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
	const [include, setInclude] = useState<MigrationIncludeOptions>(DEFAULT_INCLUDE);
	const [installGlobally, setInstallGlobally] = useState(false);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const deferredSearchQuery = useDeferredValue(searchQuery);
	const [providerFilter, setProviderFilter] = useState<ProviderFilterMode>("all");
	const [activeProviderName, setActiveProviderName] = useState<string | null>(null);
	const loadRequestIdRef = useRef(0);

	const loadData = useCallback(
		async (isRefresh = false) => {
			loadRequestIdRef.current += 1;
			const requestId = loadRequestIdRef.current;

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
				if (requestId !== loadRequestIdRef.current) {
					return;
				}

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
				if (requestId !== loadRequestIdRef.current) {
					return;
				}
				setError(err instanceof Error ? err.message : t("migrateDetectFailed"));
			} finally {
				if (requestId === loadRequestIdRef.current) {
					setLoading(false);
					setRefreshing(false);
				}
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

	const activeProvider = useMemo(() => {
		if (!activeProviderName) return null;
		return providerByName.get(activeProviderName) || null;
	}, [activeProviderName, providerByName]);

	useEffect(() => {
		if (activeProviderName && !providerByName.has(activeProviderName)) {
			setActiveProviderName(null);
		}
	}, [activeProviderName, providerByName]);

	const closeProviderDetails = useCallback(() => {
		setActiveProviderName(null);
	}, []);

	const selectedProviderSet = useMemo(() => new Set(selectedProviders), [selectedProviders]);

	const detectedProviderCount = useMemo(
		() => providers.filter((provider) => provider.detected).length,
		[providers],
	);

	const selectedProviderCount = selectedProviders.length;
	const recommendedProviderCount = useMemo(
		() => providers.filter((provider) => provider.recommended).length,
		[providers],
	);

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
				warnings.push(
					`${t("migrateUnsupported")}: ${t(TYPE_LABEL_KEYS[type])} -> ${unsupportedProviders.join(", ")}`,
				);
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

	const sortedProviders = useMemo(() => {
		const list = [...providers];
		list.sort((left, right) => {
			const leftSelected = selectedProviderSet.has(left.name);
			const rightSelected = selectedProviderSet.has(right.name);
			if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
			if (left.detected !== right.detected) return left.detected ? -1 : 1;
			if (left.recommended !== right.recommended) return left.recommended ? -1 : 1;
			return left.displayName.localeCompare(right.displayName);
		});
		return list;
	}, [providers, selectedProviderSet]);

	const filteredProviders = useMemo(() => {
		const query = deferredSearchQuery.trim().toLowerCase();

		return sortedProviders.filter((provider) => {
			if (providerFilter === "selected" && !selectedProviderSet.has(provider.name)) return false;
			if (providerFilter === "detected" && !provider.detected) return false;
			if (providerFilter === "recommended" && !provider.recommended) return false;
			if (providerFilter === "not-detected" && provider.detected) return false;

			if (!query) return true;

			const supportedLabels = TYPE_ORDER.filter((type) => provider.capabilities[type]).map((type) =>
				t(TYPE_LABEL_KEYS[type]).toLowerCase(),
			);

			return (
				provider.displayName.toLowerCase().includes(query) ||
				provider.name.toLowerCase().includes(query) ||
				supportedLabels.some((label) => label.includes(query))
			);
		});
	}, [deferredSearchQuery, providerFilter, selectedProviderSet, sortedProviders, t]);

	const groupedProviders = useMemo(() => {
		const detected = filteredProviders.filter((provider) => provider.detected);
		const notDetected = filteredProviders.filter((provider) => !provider.detected);
		const groups: Array<{
			key: "detected" | "not-detected";
			label: string;
			providers: MigrationProviderInfo[];
		}> = [];

		if (detected.length > 0) {
			groups.push({ key: "detected", label: t("migrateDetectedTag"), providers: detected });
		}
		if (notDetected.length > 0) {
			groups.push({
				key: "not-detected",
				label: t("migrateNotDetectedTag"),
				providers: notDetected,
			});
		}

		return groups;
	}, [filteredProviders, t]);

	const filterCounts = useMemo(
		() => ({
			all: providers.length,
			selected: selectedProviderCount,
			detected: providers.filter((provider) => provider.detected).length,
			recommended: providers.filter((provider) => provider.recommended).length,
			"not-detected": providers.filter((provider) => !provider.detected).length,
		}),
		[providers, selectedProviderCount],
	);

	const visibleProviderNames = useMemo(
		() => filteredProviders.map((provider) => provider.name),
		[filteredProviders],
	);

	const selectVisibleProviders = useCallback(() => {
		setSelectedProviders((current) => {
			const merged = new Set(current);
			for (const provider of visibleProviderNames) {
				merged.add(provider);
			}
			return Array.from(merged);
		});
	}, [visibleProviderNames]);

	const clearSelection = useCallback(() => {
		setSelectedProviders([]);
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

		// Trigger reconciliation instead of direct execution
		await migration.reconcile({
			providers: selectedProviders,
			global: installGlobally,
			include,
		});
	}, [enabledTypeCount, include, installGlobally, selectedProviders, t, migration]);

	const executePlan = useCallback(async () => {
		setError(null);

		const executed = await migration.execute();
		if (!executed) {
			return;
		}

		// Refresh discovery after execution
		try {
			const refreshedDiscovery = await fetchMigrationDiscovery();
			setDiscovery(refreshedDiscovery);
		} catch (err) {
			console.error("Failed to refresh discovery:", err);
		}
	}, [migration]);

	const latestResultByProvider = useMemo(() => {
		const map = new Map<string, MigrationResultEntry>();
		if (!migration.results) return map;
		for (const result of migration.results.results) {
			map.set(result.provider, result);
		}
		return map;
	}, [migration.results]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			const isTypingContext = Boolean(
				target &&
					(target instanceof HTMLInputElement ||
						target instanceof HTMLTextAreaElement ||
						target.isContentEditable ||
						target.closest('[contenteditable="true"], [role="textbox"]')),
			);
			const hasModifier = event.metaKey || event.ctrlKey || event.altKey;
			if (event.key === "/" && !isTypingContext && !hasModifier) {
				event.preventDefault();
				document.getElementById("migrate-search")?.focus();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, []);

	const canRun = migration.phase === "idle" && selectedProviders.length > 0 && enabledTypeCount > 0;

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
		<div className="relative h-full overflow-hidden">
			<div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
				<div className="absolute -top-24 -right-8 h-64 w-64 rounded-full bg-dash-accent/10 blur-3xl" />
				<div className="absolute -bottom-28 -left-10 h-72 w-72 rounded-full bg-dash-accent/5 blur-3xl" />
			</div>

			<div className="h-full overflow-y-auto space-y-4 pb-8">
				<section className="dash-panel dash-sticky-glass sticky top-0 z-20 px-4 py-4 md:px-6 md:py-5">
					<div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
						<div className="space-y-1">
							<p className="mono text-[10px] uppercase tracking-[0.16em] text-dash-text-muted">
								{t("migrate")}
							</p>
							<h1 className="text-xl md:text-2xl font-semibold text-dash-text">
								{t("migrateTitle")}
							</h1>
							<p className="text-sm text-dash-text-secondary max-w-3xl">{t("migrateSubtitle")}</p>
						</div>

						{migration.phase === "complete" && migration.results ? (
							<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
								<SummaryStat
									label={t("migrateInstalled")}
									value={migration.results.counts.installed}
									tone="success"
								/>
								<SummaryStat label={t("migrateSkipped")} value={migration.results.counts.skipped} />
								<SummaryStat label={t("migrateFailed")} value={migration.results.counts.failed} />
							</div>
						) : (
							<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
								<SummaryStat label={t("migrateTypeAgents")} value={discovery?.counts.agents ?? 0} />
								<SummaryStat
									label={t("migrateDetectedProviders")}
									value={detectedProviderCount}
									tone="success"
								/>
								<SummaryStat
									label={t("migrateSelectedProviders")}
									value={selectedProviderCount}
									tone="accent"
								/>
								<SummaryStat label={t("migrateTypes")} value={enabledTypeCount} />
							</div>
						)}
					</div>
				</section>

				{error && (
					<div className="px-4 py-3 border border-red-500/30 bg-red-500/10 rounded-lg text-sm text-red-400">
						{error}
					</div>
				)}

				<div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,340px)]">
					<section className="order-2 xl:order-1 space-y-4">
						{/* Show plan review when in reviewing phase */}
						{migration.phase === "reviewing" && migration.plan && (
							<div className="dash-panel p-5">
								<div className="flex items-center justify-between mb-4">
									<h2 className="text-lg font-semibold text-dash-text">{t("migrateReviewPlan")}</h2>
									<button
										type="button"
										onClick={() => migration.reset()}
										className="dash-focus-ring px-3 py-1.5 text-xs font-medium rounded-md border border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover"
									>
										{t("cancel")}
									</button>
								</div>

								<ReconcilePlanView
									plan={migration.plan}
									resolutions={migration.resolutions}
									onResolve={migration.resolve}
									actionKey={migration.actionKey}
								/>

								{migration.error && (
									<div className="mt-4 px-3 py-2 border border-red-500/30 bg-red-500/10 rounded text-xs text-red-400">
										{migration.error}
									</div>
								)}

								<div className="mt-4 flex items-center justify-end gap-3">
									{migration.plan.hasConflicts && !migration.allConflictsResolved && (
										<p className="text-xs text-yellow-400">{t("migrateResolveConflicts")}</p>
									)}
									<button
										type="button"
										onClick={executePlan}
										disabled={migration.plan.hasConflicts && !migration.allConflictsResolved}
										className="dash-focus-ring px-4 py-2 bg-dash-accent text-white rounded-md text-sm font-semibold hover:bg-dash-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{t("migrateExecutePlan")}
									</button>
								</div>
							</div>
						)}

						{/* Show summary when complete */}
						{migration.phase === "complete" && migration.results && (
							<MigrationSummary results={migration.results} onReset={migration.reset} />
						)}

						{/* Show error state */}
						{migration.phase === "error" && migration.error && (
							<div className="dash-panel p-5">
								<div className="px-4 py-3 border border-red-500/30 bg-red-500/10 rounded-lg text-sm text-red-400">
									{migration.error}
								</div>
								<button
									type="button"
									onClick={migration.reset}
									className="mt-4 dash-focus-ring px-4 py-2 bg-dash-bg border border-dash-border rounded-md text-sm text-dash-text-secondary hover:bg-dash-surface-hover"
								>
									{t("tryAgain")}
								</button>
							</div>
						)}

						{/* Show loading state */}
						{(migration.phase === "reconciling" || migration.phase === "executing") && (
							<div className="dash-panel p-5">
								<div className="flex items-center justify-center py-8">
									<div className="text-center">
										<div className="w-8 h-8 border-4 border-dash-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
										<p className="text-dash-text-muted">
											{migration.phase === "reconciling"
												? t("migrateReconciling")
												: t("migrateExecuting")}
										</p>
									</div>
								</div>
							</div>
						)}

						{/* Show provider selection only in idle phase */}
						{migration.phase === "idle" && (
							<>
								<div className="dash-panel p-4 md:p-5 space-y-4">
									<div className="flex flex-col gap-3 lg:flex-row lg:items-center">
										<div className="relative flex-1">
											<svg
												className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 stroke-dash-text-muted"
												fill="none"
												viewBox="0 0 24 24"
												strokeWidth={2}
												strokeLinecap="round"
												strokeLinejoin="round"
											>
												<circle cx="11" cy="11" r="8" />
												<line x1="21" y1="21" x2="16.65" y2="16.65" />
											</svg>
											<input
												id="migrate-search"
												type="text"
												value={searchQuery}
												onChange={(event) => setSearchQuery(event.target.value)}
												placeholder={t("migrateSearchProviders")}
												className="dash-focus-ring w-full pl-9 pr-12 py-2 bg-dash-bg border border-dash-border rounded-lg text-dash-text text-sm focus:border-dash-accent transition-colors"
											/>
											<span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-dash-text-muted bg-dash-surface-hover border border-dash-border px-1.5 py-0.5 rounded">
												{t("searchShortcut")}
											</span>
										</div>

										<div className="flex flex-wrap items-center gap-2">
											<button
												type="button"
												onClick={() => loadData(true)}
												disabled={refreshing}
												className="dash-focus-ring px-3 py-1.5 bg-dash-bg border border-dash-border rounded-md text-xs text-dash-text-secondary hover:bg-dash-surface-hover disabled:opacity-50 whitespace-nowrap"
											>
												{refreshing ? t("checking") : t("migrateRefresh")}
											</button>
											<button
												type="button"
												onClick={selectVisibleProviders}
												disabled={visibleProviderNames.length === 0}
												className="dash-focus-ring px-3 py-1.5 bg-dash-bg border border-dash-border rounded-md text-xs text-dash-text-secondary hover:bg-dash-surface-hover disabled:opacity-50 whitespace-nowrap"
											>
												{t("migrateSelectVisible")}
											</button>
											<button
												type="button"
												onClick={clearSelection}
												disabled={selectedProviderCount === 0}
												className="dash-focus-ring px-3 py-1.5 bg-dash-bg border border-dash-border rounded-md text-xs text-dash-text-secondary hover:bg-dash-surface-hover disabled:opacity-50 whitespace-nowrap"
											>
												{t("migrateClearSelection")}
											</button>
										</div>
									</div>

									<div className="flex flex-wrap gap-1.5">
										{(
											[
												{ key: "all", label: t("categoryAll") },
												{ key: "selected", label: t("migrateSelectedProviders") },
												{ key: "detected", label: t("migrateDetectedProviders") },
												{ key: "recommended", label: t("migrateFilterRecommended") },
												{ key: "not-detected", label: t("migrateNotDetectedTag") },
											] as Array<{ key: ProviderFilterMode; label: string }>
										).map((filter) => (
											<button
												key={filter.key}
												type="button"
												onClick={() => setProviderFilter(filter.key)}
												className={`dash-focus-ring px-3 py-1 text-xs font-medium rounded-full border transition-all whitespace-nowrap ${
													providerFilter === filter.key
														? "bg-dash-accent/10 border-dash-accent text-dash-accent"
														: "border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover hover:text-dash-text"
												}`}
											>
												{filter.label}
												<span className="opacity-60 ml-1 text-[10px]">
													{filterCounts[filter.key]}
												</span>
											</button>
										))}
									</div>

									<div>
										<p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-dash-text-muted">
											{t("migrateTypes")}
										</p>
										<div className="flex flex-wrap items-center gap-2">
											{TYPE_ORDER.map((type) => (
												<button
													key={type}
													type="button"
													onClick={() => toggleType(type)}
													className={`dash-focus-ring px-2.5 py-1 text-[11px] uppercase tracking-wide rounded-md border transition-colors ${
														include[type]
															? "border-dash-accent/45 text-dash-accent bg-dash-accent/5"
															: "border-dash-border text-dash-text-muted hover:bg-dash-surface-hover"
													}`}
												>
													{t(TYPE_LABEL_KEYS[type])}
												</button>
											))}
										</div>
									</div>
								</div>

								<div className="dash-panel p-4 md:p-5">
									<h2 className="text-sm font-semibold text-dash-text mb-4">
										{t("migrateSourceSummary")}
									</h2>
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

								<div className="dash-panel p-4 md:p-5">
									<div className="flex items-center justify-between mb-4">
										<h2 className="text-sm font-semibold text-dash-text">
											{t("migrateProvidersHeading")}
										</h2>
										<p className="text-xs text-dash-text-muted">
											{filteredProviders.length} {t("migrateProvidersCountSuffix")}
										</p>
									</div>

									{providers.length === 0 ? (
										<div className="text-sm text-dash-text-muted">{t("migrateNoProviders")}</div>
									) : filteredProviders.length === 0 ? (
										<div className="text-sm text-dash-text-muted">
											{t("migrateNoProvidersMatch")}
										</div>
									) : (
										<div className="space-y-5">
											{groupedProviders.map((group) => (
												<div key={group.key}>
													<div className="flex items-center gap-2.5 mb-3">
														<div
															className="w-2 h-2 rounded-full"
															style={{ background: SECTION_COLORS[group.key] }}
														/>
														<h2
															className="text-[13px] font-semibold uppercase tracking-wide"
															style={{ color: SECTION_COLORS[group.key] }}
														>
															{group.label}
														</h2>
														<span className="text-[11px] text-dash-text-muted ml-auto">
															{group.providers.length} {t("migrateProvidersCountSuffix")}
														</span>
														<div className="flex-1 h-px bg-dash-border ml-3" />
													</div>
													<div className="space-y-2">
														{group.providers.map((provider) => (
															<ProviderRow
																key={provider.name}
																provider={provider}
																include={include}
																isSelected={selectedProviderSet.has(provider.name)}
																onToggleSelect={toggleProvider}
																onOpenDetails={setActiveProviderName}
																t={t}
															/>
														))}
													</div>
												</div>
											))}
										</div>
									)}
								</div>
							</>
						)}
					</section>

					<aside className="order-1 xl:order-2 space-y-4 self-start xl:sticky xl:top-[84px]">
						{migration.phase === "complete" && migration.results ? (
							<div className="dash-panel p-4 md:p-5 space-y-4">
								<div>
									<p className="text-sm font-semibold text-dash-text">{t("migrateSummaryTitle")}</p>
									<p className="text-xs text-dash-text-muted mt-1">
										{migration.results.counts.installed +
											migration.results.counts.skipped +
											migration.results.counts.failed}{" "}
										{t("migrateSummarySubtitle")}
									</p>
								</div>

								<div className="grid grid-cols-3 gap-2">
									<SummaryStat
										label={t("migrateInstalled")}
										value={migration.results.counts.installed}
										tone="success"
									/>
									<SummaryStat
										label={t("migrateSkipped")}
										value={migration.results.counts.skipped}
									/>
									<SummaryStat label={t("migrateFailed")} value={migration.results.counts.failed} />
								</div>

								{migration.results.discovery && (
									<div className="space-y-1.5">
										<p className="text-[10px] font-semibold uppercase tracking-wide text-dash-text-muted">
											{t("migrateTypes")}
										</p>
										{TYPE_ORDER.map((type) => {
											const count = migration.results?.discovery?.[type] ?? 0;
											if (count === 0) return null;
											return (
												<div
													key={type}
													className="flex items-center justify-between px-3 py-1.5 bg-dash-bg rounded-md text-xs"
												>
													<span className="text-dash-text-secondary">
														{t(TYPE_LABEL_KEYS[type])}
													</span>
													<span className="font-semibold text-dash-text">{count}</span>
												</div>
											);
										})}
									</div>
								)}

								{selectedProviders.length > 0 && (
									<div className="space-y-1.5">
										<p className="text-[10px] font-semibold uppercase tracking-wide text-dash-text-muted">
											{t("migrateSummaryProviders")}
										</p>
										<div className="flex flex-wrap gap-1.5">
											{selectedProviders.map((prov) => {
												const info = providerByName.get(prov);
												return (
													<span
														key={prov}
														className="text-[10px] px-2 py-0.5 rounded border border-dash-accent/30 text-dash-accent"
													>
														{info?.displayName || prov}
													</span>
												);
											})}
										</div>
									</div>
								)}

								<div className="text-[10px] px-3 py-1.5 bg-dash-bg rounded-md text-dash-text-muted">
									{installGlobally ? t("migrateScopeGlobal") : t("migrateScopeProject")}
								</div>

								<button
									type="button"
									onClick={migration.reset}
									className="dash-focus-ring w-full px-4 py-2.5 bg-dash-accent text-white rounded-md text-sm font-semibold hover:bg-dash-accent/90 transition-colors"
								>
									{t("migrateSummaryNewMigration")}
								</button>
							</div>
						) : (
							<>
								<div className="dash-panel p-4 md:p-5 space-y-4">
									<div>
										<p className="text-sm font-semibold text-dash-text">
											{t("migrateActionSummaryTitle")}
										</p>
										<p className="text-xs text-dash-text-muted mt-1">
											{selectedProviderCount} {t("migrateProvidersCountSuffix")} ·{" "}
											{enabledTypeCount}/5 {t("migrateTypes")}
										</p>
									</div>

									<div className="grid grid-cols-2 gap-2">
										<SummaryStat
											label={t("migrateSelectedProviders")}
											value={selectedProviderCount}
											tone="accent"
										/>
										<SummaryStat
											label={t("migrateDetectedProviders")}
											value={detectedProviderCount}
										/>
										<SummaryStat label={t("migrateTypes")} value={enabledTypeCount} />
										<SummaryStat
											label={t("migrateFilterRecommended")}
											value={recommendedProviderCount}
											tone="success"
										/>
									</div>

									<div className="inline-flex w-full rounded-md border border-dash-border overflow-hidden">
										<button
											type="button"
											onClick={() => setInstallGlobally(false)}
											className={`dash-focus-ring flex-1 px-3 py-2 text-sm ${
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
											className={`dash-focus-ring flex-1 px-3 py-2 text-sm border-l border-dash-border ${
												installGlobally
													? "bg-dash-accent-subtle text-dash-accent"
													: "bg-dash-bg text-dash-text-secondary"
											}`}
										>
											{t("migrateScopeGlobal")}
										</button>
									</div>

									<button
										type="button"
										onClick={runMigration}
										disabled={!canRun}
										className="dash-focus-ring w-full px-4 py-2.5 bg-dash-accent text-white rounded-md text-sm font-semibold hover:bg-dash-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{migration.phase === "reconciling" ? t("migrateRunning") : t("migrateRun")}
									</button>

									{preflightWarnings.length > 0 && (
										<div className="space-y-2">
											{preflightWarnings.map((warning, index) => (
												<p
													key={`${warning}-${index}`}
													className="text-xs px-3 py-2 border border-yellow-500/30 bg-yellow-500/10 rounded text-yellow-400"
												>
													{warning}
												</p>
											))}
										</div>
									)}
								</div>

								<div className="dash-panel-muted p-4">
									<p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-dash-text-muted">
										{t("migrateSelectProviderAction")}
									</p>
									<div className="grid grid-cols-2 gap-2">
										<button
											type="button"
											onClick={() => applyPreset("codex")}
											className="dash-focus-ring px-3 py-1.5 bg-dash-bg border border-dash-border rounded-md text-xs text-dash-text-secondary hover:bg-dash-surface-hover"
										>
											{t("migratePresetCodex")}
										</button>
										<button
											type="button"
											onClick={() => applyPreset("antigravity")}
											className="dash-focus-ring px-3 py-1.5 bg-dash-bg border border-dash-border rounded-md text-xs text-dash-text-secondary hover:bg-dash-surface-hover"
										>
											{t("migratePresetAntigravity")}
										</button>
										<button
											type="button"
											onClick={() => applyPreset("core")}
											className="dash-focus-ring px-3 py-1.5 bg-dash-bg border border-dash-border rounded-md text-xs text-dash-text-secondary hover:bg-dash-surface-hover"
										>
											{t("migratePresetBoth")}
										</button>
										<button
											type="button"
											onClick={() => applyPreset("detected")}
											className="dash-focus-ring px-3 py-1.5 bg-dash-bg border border-dash-border rounded-md text-xs text-dash-text-secondary hover:bg-dash-surface-hover"
										>
											{t("migratePresetDetected")}
										</button>
									</div>
								</div>
							</>
						)}
					</aside>
				</div>
			</div>

			{activeProvider && (
				<ProviderDetailPanel
					provider={activeProvider}
					include={include}
					isSelected={selectedProviderSet.has(activeProvider.name)}
					latestResult={latestResultByProvider.get(activeProvider.name) || null}
					onToggleSelect={toggleProvider}
					onClose={closeProviderDetails}
					t={t}
				/>
			)}
		</div>
	);
};

export default MigratePage;
