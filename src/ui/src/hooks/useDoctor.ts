import { fetchDoctorCheck, fixDoctorChecks } from "@/services/api";
import type { CheckSummaryResponse, HealingSummaryResponse } from "@/services/api";
import { useCallback, useEffect, useState } from "react";

export function useDoctor() {
	const [summary, setSummary] = useState<CheckSummaryResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [fixing, setFixing] = useState<Set<string>>(new Set());

	const runChecks = useCallback(async (groups?: string[]) => {
		try {
			setLoading(true);
			setError(null);
			const data = await fetchDoctorCheck(groups);
			setSummary(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Health check failed");
		} finally {
			setLoading(false);
		}
	}, []);

	const fixCheck = useCallback(
		async (checkIds: string[]): Promise<HealingSummaryResponse | null> => {
			try {
				setFixing((prev) => {
					const next = new Set(prev);
					for (const id of checkIds) next.add(id);
					return next;
				});
				const result = await fixDoctorChecks(checkIds);
				// Re-run checks after fix
				await runChecks();
				return result;
			} catch (err) {
				setError(err instanceof Error ? err.message : "Fix failed");
				return null;
			} finally {
				setFixing((prev) => {
					const next = new Set(prev);
					for (const id of checkIds) next.delete(id);
					return next;
				});
			}
		},
		[runChecks],
	);

	useEffect(() => {
		runChecks();
	}, [runChecks]);

	return { summary, loading, error, fixing, runChecks, fixCheck };
}
