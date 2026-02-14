/**
 * Hook for managing migration plan state across phases
 * Phases: idle → reconciling → reviewing → executing → complete → error
 */

import type { MigrationExecutionResponse, MigrationIncludeOptions } from "@/types";
import { useCallback, useMemo, useState } from "react";
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

	const reconcile = useCallback(async (params: ReconcileParams) => {
		setPhase("reconciling");
		setError(null);

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

			const response = await fetch(`/api/migrate/reconcile?${query.toString()}`);
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
				throw new Error(errorData.error || "Failed to reconcile migration plan");
			}

			const data = await response.json();
			setPlan(data.plan as ReconcilePlan);
			setPhase("reviewing");
		} catch (err) {
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

	const execute = useCallback(async () => {
		if (!plan) {
			setError("No plan to execute");
			setPhase("error");
			return;
		}

		setPhase("executing");
		setError(null);

		try {
			const resolutionsObj = Object.fromEntries(resolutions.entries());

			const response = await fetch("/api/migrate/execute", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ plan, resolutions: resolutionsObj }),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
				throw new Error(errorData.error || "Failed to execute migration");
			}

			const data = await response.json();
			setResults({
				results: data.results,
				counts: data.counts,
				warnings: data.warnings ?? [],
			});
			setPhase("complete");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to execute migration");
			setPhase("error");
		}
	}, [plan, resolutions]);

	const reset = useCallback(() => {
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
