import { Clock } from "lucide-react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useSessions } from "./hooks/useSessions";
import { useProject } from "@/contexts/ProjectContext";

function formatDuration(minutes?: number): string {
	if (!minutes) return "";
	if (minutes < 60) return `${minutes}min`;
	return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}

function formatTimestamp(ts: string): string {
	const date = new Date(ts);
	const today = new Date();
	const isToday = date.toDateString() === today.toDateString();
	const time = date.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
	return isToday ? `Today ${time}` : date.toLocaleDateString();
}

export function SessionsPanel() {
	const { currentProject } = useProject();
	const { sessions, loading, error } = useSessions(currentProject?.id ?? null);

	if (!currentProject) return null;

	if (loading) {
		return (
			<Card>
				<CardContent className="py-4 text-center text-muted-foreground">
					Loading sessions...
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card>
				<CardContent className="py-4 text-center text-destructive">
					{error}
				</CardContent>
			</Card>
		);
	}

	if (sessions.length === 0) {
		return (
			<Card>
				<CardContent className="py-4 text-center text-muted-foreground">
					No recent sessions
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-sm font-medium flex items-center gap-2">
					<Clock className="h-4 w-4" />
					Recent Sessions
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{sessions.map((session) => (
					<div key={session.id} className="text-sm">
						<div className="flex justify-between">
							<span className="text-muted-foreground">
								{formatTimestamp(session.timestamp)}
							</span>
							<span className="text-muted-foreground/70">
								{formatDuration(session.duration)}
							</span>
						</div>
						<div className="line-clamp-1">{session.summary || "No summary"}</div>
					</div>
				))}
			</CardContent>
		</Card>
	);
}
