/**
 * Hooks for session browser data fetching.
 * All operations are read-only — no write/delete/export.
 */
import { fetchProjectSessionsDetail, fetchSessions } from "@/services/api";
import { useCallback, useEffect, useState } from "react";

/** A project entry from GET /api/sessions */
export interface SessionProject {
	id: string;
	name: string;
	path: string;
	sessionCount: number;
	lastActive: string;
}

/** Typed content block from session JSONL parsing */
export interface ContentBlock {
	type: "text" | "thinking" | "tool_use" | "tool_result" | "system";
	text?: string;
	toolName?: string;
	toolInput?: string;
	toolUseId?: string;
	result?: string;
	isError?: boolean;
}

/** A message parsed from a session JSONL file */
export interface SessionMessage {
	role: string;
	timestamp?: string;
	contentBlocks: ContentBlock[];
}

/** Summary from session detail response */
export interface SessionSummary {
	messageCount: number;
	toolCallCount: number;
	duration?: string;
}

/** Full session detail response */
export interface SessionDetailData {
	messages: SessionMessage[];
	summary: SessionSummary;
}

/** Hook: list sessions for one project (uses existing endpoint) */
export function useProjectSessionList(projectId: string | undefined) {
	const [sessions, setSessions] = useState<
		Array<{ id: string; timestamp: string; duration: string; summary: string }>
	>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		if (!projectId) {
			setSessions([]);
			return;
		}
		try {
			setLoading(true);
			setError(null);
			const data = (await fetchSessions(projectId, 100)) as Array<{
				id: string;
				timestamp: string;
				duration: string;
				summary: string;
			}>;
			setSessions(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load");
		} finally {
			setLoading(false);
		}
	}, [projectId]);

	useEffect(() => {
		void load();
	}, [load]);

	return { sessions, loading, error, reload: load };
}

/** Hook: fetch paginated detail for one session */
export function useSessionDetail(
	projectId: string | undefined,
	sessionId: string | undefined,
	limit = 50,
	offset = 0,
) {
	const [data, setData] = useState<SessionDetailData | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		if (!projectId || !sessionId) {
			setData(null);
			return;
		}
		try {
			setLoading(true);
			setError(null);
			const result = (await fetchProjectSessionsDetail(
				projectId,
				sessionId,
				limit,
				offset,
			)) as SessionDetailData;
			setData(result);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load");
		} finally {
			setLoading(false);
		}
	}, [projectId, sessionId, limit, offset]);

	useEffect(() => {
		void load();
	}, [load]);

	return { data, loading, error, reload: load };
}
