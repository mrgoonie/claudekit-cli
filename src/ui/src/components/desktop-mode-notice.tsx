import type React from "react";

interface DesktopModeNoticeProps {
	title: string;
	description: string;
	commandHint?: string;
}

const DesktopModeNotice: React.FC<DesktopModeNoticeProps> = ({
	title,
	description,
	commandHint,
}) => {
	return (
		<div className="flex h-full items-center justify-center">
			<div className="max-w-xl rounded-2xl border border-dash-border bg-dash-surface p-8 text-center shadow-sm">
				<p className="text-[10px] font-bold uppercase tracking-[0.2em] text-dash-accent">
					Desktop Mode
				</p>
				<h2 className="mt-3 text-xl font-semibold text-dash-text">{title}</h2>
				<p className="mt-3 text-sm leading-relaxed text-dash-text-muted">{description}</p>
				{commandHint && (
					<p className="mt-4 rounded-lg border border-dash-border bg-dash-bg px-4 py-3 text-xs font-medium text-dash-text">
						{commandHint}
					</p>
				)}
			</div>
		</div>
	);
};

export default DesktopModeNotice;
