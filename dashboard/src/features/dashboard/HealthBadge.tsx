import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HealthBadgeProps {
	status: "healthy" | "warning" | "error";
	issueCount?: number;
}

export function HealthBadge({ status, issueCount }: HealthBadgeProps) {
	const config = {
		healthy: {
			icon: CheckCircle,
			label: "Healthy",
			className: "bg-green-100 text-green-700 border-green-200",
		},
		warning: {
			icon: AlertTriangle,
			label: `${issueCount ?? 0} warnings`,
			className: "bg-yellow-100 text-yellow-700 border-yellow-200",
		},
		error: {
			icon: XCircle,
			label: `${issueCount ?? 0} errors`,
			className: "bg-red-100 text-red-700 border-red-200",
		},
	};

	const { icon: Icon, label, className } = config[status];

	return (
		<Badge variant="outline" className={`flex items-center gap-1 ${className}`}>
			<Icon className="h-3 w-3" />
			{label}
		</Badge>
	);
}
