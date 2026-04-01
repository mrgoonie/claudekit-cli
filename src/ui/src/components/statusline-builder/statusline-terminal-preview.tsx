import {
	SECTION_MOCK_VALUES,
	type StatuslineSection,
	type StatuslineTheme,
} from "@/types/statusline-types";
/**
 * Live terminal preview of the statusline layout.
 * Simulates ANSI colors via CSS classes in a dark terminal-style container.
 */
import type React from "react";
import { useState } from "react";
import { useI18n } from "../../i18n";

interface StatuslineTerminalPreviewProps {
	sections: StatuslineSection[];
	theme: StatuslineTheme;
}

/** Map ANSI color names to Tailwind-compatible CSS colors for preview */
const COLOR_MAP: Record<string, string> = {
	green: "#4ade80",
	yellow: "#facc15",
	red: "#f87171",
	cyan: "#22d3ee",
	blue: "#60a5fa",
	magenta: "#e879f9",
	white: "#f1f5f9",
	dim: "#64748b",
	default: "#94a3b8",
};

function resolveColor(name: string): string {
	return COLOR_MAP[name] ?? COLOR_MAP.default;
}

interface SectionChipProps {
	section: StatuslineSection;
	theme: StatuslineTheme;
}

const SectionChip: React.FC<SectionChipProps> = ({ section, theme }) => {
	const mockValue = SECTION_MOCK_VALUES[section.id];
	const icon = section.icon ?? "";
	const accentColor = resolveColor(theme.accent);
	const mutedColor = resolveColor(theme.muted);

	// Context section gets special color treatment
	let textColor = accentColor;
	if (section.id === "context") {
		// Simulate 52% context → mid color
		textColor = resolveColor(theme.contextMid);
	} else if (section.id === "cost" || section.id === "quota") {
		textColor = mutedColor;
	}

	const displayText = section.label
		? `${icon} ${section.label}: ${mockValue}`
		: icon
			? `${icon} ${mockValue}`
			: mockValue;

	const truncated =
		section.maxWidth && displayText.length > section.maxWidth
			? `${displayText.slice(0, section.maxWidth - 1)}…`
			: displayText;

	return (
		<span className="font-mono text-xs whitespace-nowrap" style={{ color: textColor }}>
			{truncated}
		</span>
	);
};

const SEPARATOR = (
	<span className="font-mono text-xs" style={{ color: COLOR_MAP.dim }}>
		{" │ "}
	</span>
);

/** Width options for the responsive preview slider */
const WIDTH_OPTIONS = [
	{ label: "Narrow (80)", cols: 80 },
	{ label: "Medium (120)", cols: 120 },
	{ label: "Wide (200)", cols: 200 },
];

export const StatuslineTerminalPreview: React.FC<StatuslineTerminalPreviewProps> = ({
	sections,
	theme,
}) => {
	const { t } = useI18n();
	const [widthIndex, setWidthIndex] = useState(1);

	const enabledSections = sections.filter((s) => s.enabled).sort((a, b) => a.order - b.order);

	const cols = WIDTH_OPTIONS[widthIndex].cols;
	// Simulate responsive: at narrow width, limit sections shown
	const visibleSections =
		cols < 100
			? enabledSections.slice(0, 4)
			: cols < 160
				? enabledSections.slice(0, 7)
				: enabledSections;

	return (
		<div className="space-y-3">
			{/* Width slider */}
			<div className="flex items-center gap-3">
				<span className="text-xs text-dash-text-muted shrink-0">{t("statuslinePreview")}:</span>
				<div className="flex gap-1">
					{WIDTH_OPTIONS.map((opt, i) => (
						<button
							key={opt.label}
							type="button"
							onClick={() => setWidthIndex(i)}
							className={`text-xs px-2 py-0.5 rounded border transition-colors ${
								widthIndex === i
									? "border-dash-accent bg-dash-accent/10 text-dash-accent"
									: "border-dash-border text-dash-text-muted hover:text-dash-text"
							}`}
						>
							{opt.cols}
						</button>
					))}
				</div>
			</div>

			{/* Terminal window */}
			<div className="rounded-lg overflow-hidden border border-dash-border shadow-lg">
				{/* Title bar */}
				<div className="flex items-center gap-2 px-3 py-2 bg-[#1e1e2e] border-b border-[#313244]">
					<div className="flex gap-1.5">
						<span className="w-3 h-3 rounded-full bg-[#f38ba8]" />
						<span className="w-3 h-3 rounded-full bg-[#f9e2af]" />
						<span className="w-3 h-3 rounded-full bg-[#a6e3a1]" />
					</div>
					<span className="text-xs text-[#6c7086] font-mono ml-2">
						Claude Code — statusline preview
					</span>
				</div>

				{/* Terminal content */}
				<div
					className="bg-[#1e1e2e] p-4 font-mono text-xs overflow-x-auto"
					style={{ minHeight: "80px" }}
				>
					{/* Fake prompt line */}
					<div className="mb-2">
						<span style={{ color: COLOR_MAP.green }}>user@machine</span>
						<span style={{ color: COLOR_MAP.dim }}>:</span>
						<span style={{ color: COLOR_MAP.blue }}>~/projects/myapp</span>
						<span style={{ color: COLOR_MAP.white }}> $ </span>
					</div>

					{/* Statusline row */}
					<div
						className="flex flex-wrap items-center gap-0 py-1 px-2 rounded"
						style={{
							backgroundColor: "#313244",
							maxWidth: `${Math.min(cols * 7, 100)}%`,
						}}
					>
						{visibleSections.length === 0 ? (
							<span className="text-xs font-mono" style={{ color: COLOR_MAP.dim }}>
								(no sections enabled)
							</span>
						) : (
							visibleSections.map((section, idx) => (
								<span key={section.id} className="flex items-center">
									<SectionChip section={section} theme={theme} />
									{idx < visibleSections.length - 1 && SEPARATOR}
								</span>
							))
						)}
					</div>

					{/* Cursor */}
					<div className="mt-2 flex items-center">
						<span style={{ color: COLOR_MAP.green }}>user@machine</span>
						<span style={{ color: COLOR_MAP.dim }}>:</span>
						<span style={{ color: COLOR_MAP.blue }}>~/projects/myapp</span>
						<span style={{ color: COLOR_MAP.white }}> $ </span>
						<span className="inline-block w-2 h-4 bg-white/70 animate-pulse ml-0.5" />
					</div>
				</div>
			</div>

			{/* Section count */}
			<p className="text-xs text-dash-text-muted text-right">
				{visibleSections.length} / {sections.length} sections visible
			</p>
		</div>
	);
};
