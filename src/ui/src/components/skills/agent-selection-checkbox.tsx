import type { AgentInfo } from "@/types";
/**
 * Checkbox component for agent selection with detection indicator
 */
import type React from "react";

interface AgentCheckboxProps {
	agent: AgentInfo;
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
}

const AgentCheckbox: React.FC<AgentCheckboxProps> = ({ agent, checked, onChange, disabled }) => {
	return (
		<label
			className={`flex items-center gap-3 p-3 rounded-md border transition-colors cursor-pointer ${
				checked
					? "bg-dash-accent/5 border-dash-accent"
					: "bg-dash-surface border-dash-border hover:bg-dash-surface-hover"
			} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
		>
			<input
				type="checkbox"
				checked={checked}
				onChange={(e) => onChange(e.target.checked)}
				disabled={disabled}
				className="w-4 h-4 text-dash-accent bg-dash-bg border-dash-border rounded focus:ring-2 focus:ring-dash-accent focus:ring-offset-0"
			/>
			<div className="flex-1 flex items-center gap-2">
				<div
					className={`w-2 h-2 rounded-full ${
						agent.detected ? "bg-dash-accent" : "bg-dash-text-muted"
					}`}
					title={agent.detected ? "Detected" : "Not detected"}
				/>
				<span className="text-sm font-medium text-dash-text">{agent.displayName}</span>
			</div>
		</label>
	);
};

export default AgentCheckbox;
