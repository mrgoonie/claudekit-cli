/**
 * Circular SVG health score indicator for the page header
 */
import type React from "react";

interface HealthScoreRingProps {
	percent: number;
	failed: number;
	warnings: number;
}

const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function getScoreColor(failed: number, warnings: number): string {
	if (failed > 0) return "text-red-500";
	if (warnings > 0) return "text-amber-500";
	return "text-emerald-500";
}

function getStrokeColor(failed: number, warnings: number): string {
	if (failed > 0) return "#ef4444";
	if (warnings > 0) return "#f59e0b";
	return "#10b981";
}

const HealthScoreRing: React.FC<HealthScoreRingProps> = ({ percent, failed, warnings }) => {
	const offset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;
	const color = getScoreColor(failed, warnings);
	const stroke = getStrokeColor(failed, warnings);

	return (
		<div className="relative w-14 h-14 shrink-0">
			<svg className="w-14 h-14 -rotate-90" viewBox="0 0 48 48">
				<circle
					cx="24"
					cy="24"
					r={RADIUS}
					fill="none"
					className="stroke-dash-border"
					strokeWidth="3"
				/>
				<circle
					cx="24"
					cy="24"
					r={RADIUS}
					fill="none"
					stroke={stroke}
					strokeWidth="3"
					strokeLinecap="round"
					strokeDasharray={CIRCUMFERENCE}
					strokeDashoffset={offset}
					style={{ transition: "stroke-dashoffset 0.6s ease" }}
				/>
			</svg>
			<span
				className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${color}`}
			>
				{percent}%
			</span>
		</div>
	);
};

export default HealthScoreRing;
