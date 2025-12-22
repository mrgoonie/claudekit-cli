import { Badge } from "./ui/badge";

interface SourceBadgeProps {
	source: "DEFAULT" | "GLOBAL" | "LOCAL";
}

export function SourceBadge({ source }: SourceBadgeProps) {
	const variants = {
		DEFAULT: "secondary",
		GLOBAL: "default",
		LOCAL: "outline",
	} as const;

	const colors = {
		DEFAULT: "bg-gray-100 text-gray-600",
		GLOBAL: "bg-blue-100 text-blue-700",
		LOCAL: "bg-yellow-100 text-yellow-700",
	};

	return (
		<Badge variant={variants[source]} className={colors[source]}>
			{source}
		</Badge>
	);
}
