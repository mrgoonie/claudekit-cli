/**
 * Hook for managing migration plan state across phases
 * Phases: idle → reconciling → reviewing → executing → complete → error
 *
 * P4 additions:
 * - mode: "reconcile" | "install" param — switches between reconcile and install-discovery fetch
 * - reinstallEmptyDirs / respectDeletions forwarded as query params
 * - installCandidates in return shape for Install mode
 * - suggestedMode returned from reconcile endpoint for smart-default
 */

import type { MigrationExecutionResponse, MigrationIncludeOptions } from "@/types";
import { useCallback, useMemo, useRef, useState } from "react";
import type {
	ConflictResolution,
	InstallCandidate,
	ReconcileAction,
	ReconcilePlan,
} from "../types/reconcile-types";

type MigrationPhase = "idle" | "reconciling" | "reviewing" | "executing" | "complete" | "error";

export type MigrationMode = "reconcile" | "install";

export interface ReconcileParams {
	providers: string[];
	global: boolean;
	include: MigrationIncludeOptions;
	source?: string;
	/** Default: true — pass false to suppress empty-dir reinstall override */
	reinstallEmptyDirs?: boolean;
	/** Default: false — pass true to respect user deletions of empty dirs */
	respectDeletions?: boolean;
}

/** Per-type item counts from discovery */
export interface DiscoveryCounts {
	agents: number;
	commands: number;
	skills: number;
	config: number;
	rules: number;
	hooks: number;
}

export interface MigrationResults {
	results: MigrationExecutionResponse["results"];
	counts: MigrationExecutionResponse["counts"];
	warnings: string[];
	discovery?: DiscoveryCounts;
}

/**
 * Action key for resolution tracking
 */
function actionKey(action: ReconcileAction): string {
	return JSON.stringify([action.provider, action.type, action.item, action.global]);
}

function extractMessageFromUnknown(value: unknown): string | null {
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : null;
	}
	if (typeof value === "object" && value !== null) {
		const record = value as Record<string, unknown>;
		for (const key of ["message", "error", "detail", "details", "reason"] as const) {
			const candidate = record[key];
			if (typeof candidate === "string" && candidate.trim().length > 0) {
				return candidate.trim();
			}
		}
	}
	return null;
}

async function parseResponseError(response: Response, fallback: string): Promise<string> {
	const raw = await response.text().catch(() => "");
	const trimmed = raw.trim();
	if (!trimmed) return fallback;
	try {
		const parsed = JSON.parse(trimmed);
		return extractMessageFromUnknown(parsed) || fallback;
	} catch {
		return trimmed;
	}
}

export function useMigrationPlan() {
	const [phase, setPhase] = useState<MigrationPhase>("idle");
	const [plan, setPlan] = useState<ReconcilePlan | null>(null);
	const [resolutions, setResolutions] = useState<Map<string, ConflictResolution>>(new Map());
	const [results, setResults] = useState<MigrationResults | null>(null);
	const [error, setError] = useState<string | null>(null);
	/** suggestedMode returned by the reconcile endpoint for smart-default logic */
	const [suggestedMode, setSuggestedMode] = useState<MigrationMode | null>(null);
	/** Install candidates fetched in Install mode */
	const [installCandidates, setInstallCandidates] = useState<InstallCandidate[] | null>(null);
	const reconcileRequestIdRef = useRef(0);
	const executeRequestIdRef = useRef(0);
	const reconcileControllerRef = useRef<AbortController | null>(null);
	const executeControllerRef = useRef<AbortController | null>(null);

	const reconcile = useCallback(async (params: ReconcileParams) => {
		setPhase("reconciling");
		setError(null);
		setResults(null);
		reconcileRequestIdRef.current += 1;
		const requestId = reconcileRequestIdRef.current;

		reconcileControllerRef.current?.abort();
		const controller = new AbortController();
		reconcileControllerRef.current = controller;

		try {
			const query = new URLSearchParams({
				providers: params.providers.join(","),
				global: String(params.global),
				agents: String(params.include.agents ?? true),
				commands: String(params.include.commands ?? true),
				skills: String(params.include.skills ?? true),
				config: String(params.include.config ?? true),
				rules: String(params.include.rules ?? true),
				hooks: String(params.include.hooks ?? true),
			});

			if (params.source) {
				query.set("source", params.source);
			}
			if (params.reinstallEmptyDirs !== undefined) {
				query.set("reinstallEmptyDirs", String(params.reinstallEmptyDirs));
			}
			if (params.respectDeletions !== undefined) {
				query.set("respectDeletions", String(params.respectDeletions));
			}

			const response = await fetch(`/api/migrate/reconcile?${query.toString()}`, {
				signal: controller.signal,
			});
			if (!response.ok) {
				const errorMessage = await parseResponseError(
					response,
					"Failed to reconcile migration plan",
				);
				throw new Error(errorMessage);
			}

			const data = await response.json();
			if (requestId !== reconcileRequestIdRef.current) {
				return;
			}
			setPlan(data.plan as ReconcilePlan);
			// Capture suggested mode for smart-default (P4)
			if (data.suggestedMode === "reconcile" || data.suggestedMode === "install") {
				setSuggestedMode(data.suggestedMode as MigrationMode);
			}
			setResolutions(new Map());
			setPhase("reviewing");
		} catch (err) {
			if (controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
				return;
			}
			if (requestId !== reconcileRequestIdRef.current) {
				return;
			}
			setError(err instanceof Error ? err.message : "Failed to reconcile");
			setPhase("error");
		}
	}, []);

	/** Fetch install candidates for Install mode (no checksum computation) */
	const fetchCandidates = useCallback(async (params: ReconcileParams) => {
		setPhase("reconciling");
		setError(null);
		setResults(null);
		reconcileRequestIdRef.current += 1;
		const requestId = reconcileRequestIdRef.current;

		reconcileControllerRef.current?.abort();
		const controller = new AbortController();
		reconcileControllerRef.current = controller;

		try {
			const query = new URLSearchParams({
				providers: params.providers.join(","),
				global: String(params.global),
				agents: String(params.include.agents ?? true),
				commands: String(params.include.commands ?? true),
				skills: String(params.include.skills ?? true),
				config: String(params.include.config ?? true),
				rules: String(params.include.rules ?? true),
				hooks: String(params.include.hooks ?? true),
			});
			if (params.source) query.set("source", params.source);

			const response = await fetch(`/api/migrate/install-discovery?${query.toString()}`, {
				signal: controller.signal,
			});
			if (!response.ok) {
				const errorMessage = await parseResponseError(
					response,
					"Failed to fetch install candidates",
				);
				throw new Error(errorMessage);
			}

			const data = await response.json();
			if (requestId !== reconcileRequestIdRef.current) return;

			setInstallCandidates((data.candidates ?? []) as InstallCandidate[]);
			setPhase("reviewing");
		} catch (err) {
			if (controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
				return;
			}
			if (requestId !== reconcileRequestIdRef.current) return;
			setError(err instanceof Error ? err.message : "Failed to fetch candidates");
			setPhase("error");
		}
	}, []);

	const resolve = useCallback((action: ReconcileAction, resolution: ConflictResolution) => {
		setResolutions((prev) => {
			const next = new Map(prev);
			next.set(actionKey(action), resolution);
			return next;
		});
	}, []);

	/**
	 * Execute the active plan.
	 * @param planOverride - Pass a synthetic plan (Install mode) to override the reconcile plan.
	 * @param mode - The mode field sent to the server ("reconcile" | "install").
	 */
	const execute = useCallback(
		async (planOverride?: ReconcilePlan, mode?: MigrationMode): Promise<boolean> => {
			const activePlan = planOverride ?? plan;
			if (!activePlan) {
				setError("No plan to execute");
				setPhase("error");
				return false;
			}

			setPhase("executing");
			setError(null);
			executeRequestIdRef.current += 1;
			const requestId = executeRequestIdRef.current;

			executeControllerRef.current?.abort();
			const controller = new AbortController();
			executeControllerRef.current = controller;

			try {
				const resolutionsObj = Object.fromEntries(resolutions.entries());
				const body: Record<string, unknown> = {
					plan: activePlan,
					resolutions: resolutionsObj,
				};
				if (mode) body.mode = mode;

				const response = await fetch("/api/migrate/execute", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
					signal: controller.signal,
				});
				if (requestId !== executeRequestIdRef.current) {
					return false;
				}

				if (!response.ok) {
					const errorMessage = await parseResponseError(response, "Failed to execute migration");
					if (response.status === 501) {
						setError(errorMessage || "Plan execution is not available in this server build");
						setPhase("reviewing");
						return false;
					}
					throw new Error(errorMessage);
				}

				const data = await response.json();
				if (requestId !== executeRequestIdRef.current) {
					return false;
				}
				setResults({
					results: data.results,
					counts: data.counts,
					warnings: data.warnings ?? [],
					discovery: data.discovery,
				});
				setPhase("complete");
				return true;
			} catch (err) {
				if (
					controller.signal.aborted ||
					(err instanceof DOMException && err.name === "AbortError")
				) {
					return false;
				}
				if (requestId !== executeRequestIdRef.current) {
					return false;
				}
				setError(err instanceof Error ? err.message : "Failed to execute migration");
				setPhase("error");
				return false;
			}
		},
		[plan, resolutions],
	);

	const reset = useCallback(() => {
		reconcileControllerRef.current?.abort();
		executeControllerRef.current?.abort();
		setPhase("idle");
		setPlan(null);
		setResolutions(new Map());
		setResults(null);
		setError(null);
		setInstallCandidates(null);
	}, []);

	const allConflictsResolved = useMemo(() => {
		if (!plan) return true;
		return plan.actions
			.filter((a: ReconcileAction) => a.action === "conflict")
			.every((a: ReconcileAction) => resolutions.has(actionKey(a)));
	}, [plan, resolutions]);

	return {
		phase,
		plan,
		resolutions,
		results,
		error,
		/** suggestedMode from the reconcile endpoint — use for smart-default mode selection */
		suggestedMode,
		/** Install candidates — populated when fetchCandidates() is called */
		installCandidates,
		reconcile,
		/** Fetch install candidates for Install mode (fast, no checksums) */
		fetchCandidates,
		resolve,
		execute,
		reset,
		allConflictsResolved,
		actionKey,
	};
}
