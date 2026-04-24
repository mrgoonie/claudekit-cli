/**
 * InstallPicker — flat, type-grouped opt-in picker for Install mode.
 *
 * Groups items by portable type (agents, commands, skills, config, rules, hooks).
 * Skills (isDirectoryItem=true) get a directory-level checkbox, not per-file.
 * All items default-checked per decisions Q5 (all-checked on fresh registry).
 * Provides "Select all" / "Deselect all" per group and a global CTA.
 */

import type React from "react";
import { useCallback, useMemo } from "react";
import { type TranslationKey, useI18n } from "../../i18n";
import type { InstallCandidate } from "../../types/reconcile-types";

export type { InstallCandidate };

/** Key used to identify a candidate uniquely across types + providers */
function candidateKey(c: InstallCandidate): string {
	return `${c.provider}::${c.type}::${c.item}::${String(c.global)}`;
}

const TYPE_ORDER: InstallCandidate["type"][] = [
	"agent",
	"command",
	"skill",
	"config",
	"rules",
	"hooks",
];

const TYPE_LABEL_KEYS: Record<InstallCandidate["type"], TranslationKey> = {
	agent: "migrateTypeAgents",
	command: "migrateTypeCommands",
	skill: "migrateTypeSkills",
	config: "migrateTypeConfig",
	rules: "migrateTypeRules",
	hooks: "migrateTypeHooks",
};

const TYPE_BADGE_CLASS: Record<InstallCandidate["type"], string> = {
	agent: "border-dash-accent/30 text-dash-accent",
	command: "border-yellow-500/30 text-yellow-400",
	skill: "border-purple-500/30 text-purple-400",
	config: "border-teal-500/30 text-teal-400",
	rules: "border-rose-500/30 text-rose-400",
	hooks: "border-cyan-500/30 text-cyan-400",
};

interface InstallPickerProps {
	/** All available candidates from install-discovery endpoint */
	candidates: InstallCandidate[];
	/** Set of selected candidate keys (use candidateKey() to build keys) */
	selected: Set<string>;
	/** Called when the selected set changes */
	onSelectionChange: (next: Set<string>) => void;
	/** Called when user confirms the install CTA */
	onInstall: (selected: Set<string>) => void;
	/** Whether an install is already in flight */
	isInstalling?: boolean;
}

interface TypeGroupProps {
	type: InstallCandidate["type"];
	candidates: InstallCandidate[];
	selected: Set<string>;
	onToggleItem: (key: string) => void;
	onSelectAll: (keys: string[]) => void;
	onDeselectAll: (keys: string[]) => void;
}

const TypeGroup: React.FC<TypeGroupProps> = ({
	type,
	candidates,
	selected,
	onToggleItem,
	onSelectAll,
	onDeselectAll,
}) => {
	const { t } = useI18n();
	const keys = useMemo(() => candidates.map(candidateKey), [candidates]);
	const selectedInGroup = keys.filter((k) => selected.has(k)).length;
	const allSelected = selectedInGroup === keys.length;
	const badgeClass = TYPE_BADGE_CLASS[type];
	const label = t(TYPE_LABEL_KEYS[type]);

	return (
		<div className="border border-dash-border rounded-lg bg-dash-surface overflow-hidden">
			{/* Group header */}
			<div className="px-4 py-2.5 flex items-center justify-between border-b border-dash-border bg-dash-bg">
				<div className="flex items-center gap-2">
					<h4 className="text-sm font-semibold text-dash-text">{label}</h4>
					<span className={`px-2 py-0.5 text-xs rounded-md border ${badgeClass}`}>
						{selectedInGroup}/{candidates.length}
					</span>
				</div>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => onSelectAll(keys)}
						disabled={allSelected}
						className="dash-focus-ring px-2.5 py-1 text-[11px] rounded border border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover disabled:opacity-40"
					>
						{t("migrateInstallSelectAll")}
					</button>
					<button
						type="button"
						onClick={() => onDeselectAll(keys)}
						disabled={selectedInGroup === 0}
						className="dash-focus-ring px-2.5 py-1 text-[11px] rounded border border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover disabled:opacity-40"
					>
						{t("migrateInstallDeselectAll")}
					</button>
				</div>
			</div>

			{/* Rows */}
			<div className="divide-y divide-dash-border/50">
				{candidates.map((c) => {
					const key = candidateKey(c);
					const isChecked = selected.has(key);
					return (
						<label
							key={key}
							className="flex items-center gap-3 px-4 py-2.5 hover:bg-dash-surface-hover cursor-pointer"
						>
							<input
								type="checkbox"
								checked={isChecked}
								onChange={() => onToggleItem(key)}
								className="h-4 w-4 rounded border-dash-border accent-dash-accent"
								aria-label={`${c.item} from ${c.provider}`}
							/>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2 flex-wrap">
									<span className="text-sm font-mono text-dash-text truncate">{c.item}</span>
									{c.isDirectoryItem && (
										<span className="text-[10px] uppercase px-1.5 py-0.5 rounded border border-purple-500/30 text-purple-400">
											{t("migrateInstallDirItem")}
										</span>
									)}
									{c.alreadyInstalled && (
										<span className="text-[10px] uppercase px-1.5 py-0.5 rounded border border-dash-border text-dash-text-muted">
											{t("migrateInstallAlreadyInstalled")}
										</span>
									)}
								</div>
								<div className="text-[11px] text-dash-text-muted mt-0.5">{c.provider}</div>
							</div>
							{c.description && (
								<p className="hidden md:block text-xs text-dash-text-secondary max-w-[200px] truncate shrink-0">
									{c.description}
								</p>
							)}
						</label>
					);
				})}
			</div>
		</div>
	);
};

export const InstallPicker: React.FC<InstallPickerProps> = ({
	candidates,
	selected,
	onSelectionChange,
	onInstall,
	isInstalling = false,
}) => {
	const { t } = useI18n();

	// Group candidates by type, preserving TYPE_ORDER ordering
	const groups = useMemo(() => {
		const map = new Map<InstallCandidate["type"], InstallCandidate[]>();
		for (const c of candidates) {
			const list = map.get(c.type) ?? [];
			list.push(c);
			map.set(c.type, list);
		}
		return TYPE_ORDER.filter((type) => (map.get(type)?.length ?? 0) > 0).map((type) => ({
			type,
			candidates: map.get(type) ?? [],
		}));
	}, [candidates]);

	const allKeys = useMemo(() => candidates.map(candidateKey), [candidates]);

	const handleToggleItem = useCallback(
		(key: string) => {
			const next = new Set(selected);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			onSelectionChange(next);
		},
		[selected, onSelectionChange],
	);

	const handleSelectAll = useCallback(
		(keys: string[]) => {
			const next = new Set(selected);
			for (const k of keys) next.add(k);
			onSelectionChange(next);
		},
		[selected, onSelectionChange],
	);

	const handleDeselectAll = useCallback(
		(keys: string[]) => {
			const next = new Set(selected);
			for (const k of keys) next.delete(k);
			onSelectionChange(next);
		},
		[selected, onSelectionChange],
	);

	const handleSelectAllGlobal = useCallback(() => {
		onSelectionChange(new Set(allKeys));
	}, [allKeys, onSelectionChange]);

	const handleDeselectAllGlobal = useCallback(() => {
		onSelectionChange(new Set());
	}, [onSelectionChange]);

	if (candidates.length === 0) {
		return (
			<div className="dash-panel p-8 text-center">
				<p className="text-dash-text-muted text-sm">{t("migrateInstallNoCandidates")}</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Global controls */}
			<div className="flex items-center justify-between flex-wrap gap-2">
				<p className="text-sm text-dash-text-secondary">
					{/* Inline interpolation: template has {count} and {total} placeholders */}
					{t("migrateInstallSelectedCount")
						.replace("{count}", String(selected.size))
						.replace("{total}", String(candidates.length))}
				</p>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={handleSelectAllGlobal}
						disabled={selected.size === candidates.length}
						className="dash-focus-ring px-3 py-1.5 text-xs rounded-md border border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover disabled:opacity-40"
					>
						{t("migrateInstallSelectAll")}
					</button>
					<button
						type="button"
						onClick={handleDeselectAllGlobal}
						disabled={selected.size === 0}
						className="dash-focus-ring px-3 py-1.5 text-xs rounded-md border border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover disabled:opacity-40"
					>
						{t("migrateInstallDeselectAll")}
					</button>
				</div>
			</div>

			{/* Type groups */}
			{groups.map(({ type, candidates: groupCandidates }) => (
				<TypeGroup
					key={type}
					type={type}
					candidates={groupCandidates}
					selected={selected}
					onToggleItem={handleToggleItem}
					onSelectAll={handleSelectAll}
					onDeselectAll={handleDeselectAll}
				/>
			))}

			{/* Install CTA */}
			<div className="flex items-center justify-end pt-2">
				<button
					type="button"
					disabled={selected.size === 0 || isInstalling}
					onClick={() => onInstall(selected)}
					className="dash-focus-ring px-6 py-2.5 bg-dash-accent text-white rounded-md text-sm font-semibold hover:bg-dash-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isInstalling
						? t("migrateInstallInstalling")
						: /* Inline interpolation: template has {count} placeholder */
							t("migrateInstallCta").replace("{count}", String(selected.size))}
				</button>
			</div>
		</div>
	);
};

/** Build a Set of all candidate keys (all-checked default per decisions Q5) */
export function buildDefaultSelectedSet(candidates: InstallCandidate[]): Set<string> {
	return new Set(candidates.map(candidateKey));
}

/**
 * Build a synthetic ReconcilePlan from selected InstallCandidates.
 * Used to POST to /api/migrate/execute in Install mode.
 *
 * Meta is populated from the ACTUAL selection so server-side helpers
 * (`getIncludeFromPlan`, `getPlanItemsByType`) don't over-expand scope
 * and trigger fallbacks for types the user didn't select. See #740.
 */
export function buildSyntheticPlan(
	candidates: InstallCandidate[],
	selectedKeys: Set<string>,
): {
	actions: Array<{
		action: "install";
		item: string;
		type: InstallCandidate["type"];
		provider: string;
		global: boolean;
		targetPath: string;
		reason: string;
		reasonCode: "new-item";
		isDirectoryItem: boolean;
	}>;
	summary: { install: number; update: number; skip: number; conflict: number; delete: number };
	hasConflicts: boolean;
	banners: never[];
	meta: {
		include: Record<"agents" | "commands" | "skills" | "config" | "rules" | "hooks", boolean>;
		providers: string[];
		items: Record<"agents" | "commands" | "skills" | "config" | "rules" | "hooks", string[]>;
		mode: "install";
	};
} {
	const selected = candidates.filter((c) => selectedKeys.has(candidateKey(c)));
	const actions = selected.map((c) => ({
		action: "install" as const,
		item: c.item,
		type: c.type,
		provider: c.provider,
		global: c.global,
		targetPath: c.registryPath ?? c.sourcePath,
		reason: "User-selected install",
		reasonCode: "new-item" as const,
		isDirectoryItem: c.isDirectoryItem,
	}));

	// Map portable type to include key
	const toKey = (t: InstallCandidate["type"]) =>
		({
			agent: "agents" as const,
			command: "commands" as const,
			skill: "skills" as const,
			config: "config" as const,
			rules: "rules" as const,
			hooks: "hooks" as const,
		})[t];

	const include = {
		agents: false,
		commands: false,
		skills: false,
		config: false,
		rules: false,
		hooks: false,
	};
	const items: Record<"agents" | "commands" | "skills" | "config" | "rules" | "hooks", string[]> = {
		agents: [],
		commands: [],
		skills: [],
		config: [],
		rules: [],
		hooks: [],
	};
	const providerSet = new Set<string>();
	for (const c of selected) {
		const key = toKey(c.type);
		include[key] = true;
		items[key].push(c.item);
		providerSet.add(c.provider);
	}

	return {
		actions,
		summary: { install: actions.length, update: 0, skip: 0, conflict: 0, delete: 0 },
		hasConflicts: false,
		banners: [],
		meta: {
			include,
			providers: Array.from(providerSet),
			items,
			mode: "install",
		},
	};
}
