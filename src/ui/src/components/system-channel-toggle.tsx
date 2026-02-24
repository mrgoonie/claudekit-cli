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
		<fieldset
			className="inline-flex items-center rounded-xl border border-dash-border bg-dash-surface p-1 gap-1"
			role="radiogroup"
			aria-label="Update channel"
		>
			<label
				className={`dash-focus-ring px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
					value === "stable"
						? "bg-dash-accent-subtle text-dash-accent"
						: "text-dash-text-secondary hover:text-dash-text hover:bg-dash-surface-hover"
				} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
			>
				<input
					type="radio"
					name="channel"
					value="stable"
					checked={value === "stable"}
					onChange={() => onChange("stable")}
					disabled={disabled}
					className="sr-only"
				/>
				{t("channelStable")}
			</label>
			<label
				className={`dash-focus-ring px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
					value === "beta"
						? "bg-amber-500/15 text-amber-500"
						: "text-dash-text-secondary hover:text-dash-text hover:bg-dash-surface-hover"
				} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
			>
				<input
					type="radio"
					name="channel"
					value="beta"
					checked={value === "beta"}
					onChange={() => onChange("beta")}
					disabled={disabled}
					className="sr-only"
				/>
				{t("channelBeta")}
			</label>
		</fieldset>
	);
};

export default SystemChannelToggle;
