/**
 * Legacy /kanban route compatibility shim.
 * Redirects stale deep links into the canonical /plans board with view=kanban.
 */
import { Navigate, useSearchParams } from "react-router-dom";

function derivePlansDir(planFile: string): string | null {
	const normalizedFile = planFile.replace(/\\/g, "/");
	const segments = normalizedFile.split("/").filter(Boolean);
	if (segments.length < 3) return null;
	const prefix = normalizedFile.startsWith("/") ? "/" : "";
	return `${prefix}${segments.slice(0, -2).join("/")}`;
}

export default function KanbanPage() {
	const [searchParams] = useSearchParams();
	const projectId = searchParams.get("projectId");
	const planFile = searchParams.get("file");
	const plansDir = planFile ? derivePlansDir(planFile) : null;
	const nextSearchParams = new URLSearchParams();

	if (plansDir) {
		nextSearchParams.set("dir", plansDir);
		nextSearchParams.set("view", "kanban");
		if (projectId) nextSearchParams.set("projectId", projectId);
	}

	return <Navigate replace to={plansDir ? `/plans?${nextSearchParams.toString()}` : "/plans"} />;
}
