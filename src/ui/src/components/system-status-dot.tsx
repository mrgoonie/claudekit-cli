/**
 * SystemStatusDot - Reusable status indicator with color and animation states
 */
import type React from "react";

export type UpdateStatus = "idle" | "checking" | "up-to-date" | "update-available";

interface StatusDotProps {
	status: UpdateStatus;
	ariaLabel?: string;
	size?: "sm" | "md";
}

const statusConfig = {
	idle: { color: "bg-dash-text-muted", pulse: false },
	checking: { color: "bg-dash-text-muted", pulse: true },
	"up-to-date": { color: "bg-emerald-500", pulse: false },
	"update-available": { color: "bg-amber-500", pulse: false },
} as const;

const SystemStatusDot: React.FC<StatusDotProps> = ({ status, ariaLabel, size = "sm" }) => {
	const config = statusConfig[status];
	const sizeClass = size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5";

	return (
		<span
			className={`
				inline-block rounded-full ${sizeClass} ${config.color}
				${config.pulse ? "animate-pulse motion-reduce:animate-none" : ""}
			`}
			role="status"
			aria-label={ariaLabel}
		/>
	);
};

export default SystemStatusDot;
