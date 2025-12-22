import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import type { Project } from "../contexts/ProjectContext";
import { Badge } from "./ui/badge";

type HealthStatus = "healthy" | "warning" | "error" | "loading";

interface HeaderProps {
	project: Project | null;
	healthStatus?: HealthStatus;
	connected?: boolean;
}

function HealthIndicator({ status }: { status: HealthStatus }) {
	switch (status) {
		case "healthy":
			return <CheckCircle className="h-5 w-5 text-green-500" />;
		case "warning":
			return <AlertCircle className="h-5 w-5 text-yellow-500" />;
		case "error":
			return <AlertCircle className="h-5 w-5 text-red-500" />;
		case "loading":
			return <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />;
	}
}

export function Header({
	project,
	healthStatus = "loading",
	connected = true,
}: HeaderProps) {
	return (
		<header className="flex items-center justify-between bg-white border-b px-6 py-4">
			<div className="flex items-center gap-4">
				{/* Project Name */}
				<div>
					<h1 className="text-xl font-bold text-gray-900">
						{project?.name ?? "No Project Selected"}
					</h1>
					{project && (
						<p className="text-sm text-gray-500 truncate max-w-md">
							{project.path}
						</p>
					)}
				</div>

				{/* Kit Type Badge */}
				{project && (
					<Badge variant="secondary" className="ml-2">
						engineer
					</Badge>
				)}

				{/* Health Status */}
				<HealthIndicator status={healthStatus} />
			</div>

			{/* Connection Status */}
			<div className="flex items-center gap-2">
				{connected ? (
					<span className="text-sm text-green-600 flex items-center gap-1">
						<span className="h-2 w-2 bg-green-500 rounded-full" />
						Connected
					</span>
				) : (
					<span className="text-sm text-yellow-600 flex items-center gap-1">
						<span className="h-2 w-2 bg-yellow-500 rounded-full animate-pulse" />
						Reconnecting...
					</span>
				)}
			</div>
		</header>
	);
}
