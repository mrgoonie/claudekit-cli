/**
 * SystemChannelToggle - Pill toggle for Stable/Beta update channel selection
 */
import type React from "react";
import { useI18n } from "../i18n";

export type Channel = "stable" | "beta";

interface SystemChannelToggleProps {
	value: Channel;
	onChange: (channel: Channel) => void;
	disabled?: boolean;
}

const SystemChannelToggle: React.FC<SystemChannelToggleProps> = ({
	value,
	onChange,
	disabled = false,
}) => {
	const { t } = useI18n();

	return (
		<div
			className="inline-flex rounded-lg border border-dash-border bg-dash-surface p-1 gap-1"
			role="radiogroup"
			aria-label="Update channel"
		>
			<button
				type="button"
				role="radio"
				aria-checked={value === "stable"}
				onClick={() => onChange("stable")}
				disabled={disabled}
				className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
					value === "stable"
						? "bg-dash-accent text-white"
						: "text-dash-text-secondary hover:text-dash-text"
				} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
			>
				{t("channelStable")}
			</button>
			<button
				type="button"
				role="radio"
				aria-checked={value === "beta"}
				onClick={() => onChange("beta")}
				disabled={disabled}
				className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
					value === "beta"
						? "bg-amber-500 text-white"
						: "text-dash-text-secondary hover:text-dash-text"
				} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
			>
				{t("channelBeta")}
			</button>
		</div>
	);
};

export default SystemChannelToggle;
