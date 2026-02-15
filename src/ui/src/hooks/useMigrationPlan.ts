/**
 * Hook for managing migration plan state across phases
 * Phases: idle → reconciling → reviewing → executing → complete → error
 */

import type { MigrationExecutionResponse, MigrationIncludeOptions } from "@/types";
import { useCallback, useMemo, useRef, useState } from "react";
import type { ConflictResolution, ReconcileAction, ReconcilePlan } from "../types/reconcile-types";

type MigrationPhase = "idle" | "reconciling" | "reviewing" | "executing" | "complete" | "error";

export interface ReconcileParams {
	providers: string[];
	global: boolean;
	include: MigrationIncludeOptions;
	source?: string;
}

export interface MigrationResults {
	results: MigrationExecutionResponse["results"];
	counts: MigrationExecutionResponse["counts"];
	warnings: string[];
}

/**
 * Action key for resolution tracking
 */
function actionKey(action: ReconcileAction): string {
	return `${action.provider}:${action.type}:${action.item}:${action.global}`;
}

export function useMigrationPlan() {
	const [phase, setPhase] = useState<MigrationPhase>("idle");
	const [plan, setPlan] = useState<ReconcilePlan | null>(null);
	const [resolutions, setResolutions] = useState<Map<string, ConflictResolution>>(new Map());
	const [results, setResults] = useState<MigrationResults | null>(null);
	const [error, setError] = useState<string | null>(null);
	const reconcileRequestIdRef = useRef(0);
	const executeRequestIdRef = useRef(0);
	const reconcileControllerRef = useRef<AbortController | null>(null);
	const executeControllerRef = useRef<AbortController | null>(null);

	const reconcile = useCallback(async (params: ReconcileParams) => {
		setPhase("reconciling");
		setError(null);
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
			});

			if (params.source) {
				query.set("source", params.source);
			}

			const response = await fetch(`/api/migrate/reconcile?${query.toString()}`, {
				signal: controller.signal,
			});
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
				throw new Error(errorData.error || "Failed to reconcile migration plan");
			}

			const data = await response.json();
			if (requestId !== reconcileRequestIdRef.current) {
				return;
			}
			setPlan(data.plan as ReconcilePlan);
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

	const resolve = useCallback((action: ReconcileAction, resolution: ConflictResolution) => {
		setResolutions((prev) => {
			const next = new Map(prev);
			next.set(actionKey(action), resolution);
			return next;
		});
	}, []);

	const execute = useCallback(async (): Promise<boolean> => {
		if (!plan) {
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

			const response = await fetch("/api/migrate/execute", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ plan, resolutions: resolutionsObj }),
				signal: controller.signal,
			});
			if (requestId !== executeRequestIdRef.current) {
				return false;
			}

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
				if (response.status === 501) {
					setError(errorData.error || "Plan execution is not available in this server build");
					setPhase("reviewing");
					return false;
				}
				throw new Error(errorData.error || "Failed to execute migration");
			}

			const data = await response.json();
			if (requestId !== executeRequestIdRef.current) {
				return false;
			}
			setResults({
				results: data.results,
				counts: data.counts,
				warnings: data.warnings ?? [],
			});
			setPhase("complete");
			return true;
		} catch (err) {
			if (controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
				return false;
			}
			if (requestId !== executeRequestIdRef.current) {
				return false;
			}
			setError(err instanceof Error ? err.message : "Failed to execute migration");
			setPhase("error");
			return false;
		}
	}, [plan, resolutions]);

	const reset = useCallback(() => {
		reconcileControllerRef.current?.abort();
		executeControllerRef.current?.abort();
		setPhase("idle");
		setPlan(null);
		setResolutions(new Map());
		setResults(null);
		setError(null);
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
		reconcile,
		resolve,
		execute,
		reset,
		allConflictsResolved,
		actionKey,
	};
}
