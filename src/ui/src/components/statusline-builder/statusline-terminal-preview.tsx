import {
	ANSI_COLOR_HEX_MAP,
	SECTION_MOCK_VALUES,
	type SectionConfig,
	type StatuslineTheme,
} from "@/types/statusline-types";
/**
 * Live terminal preview of the multi-line statusline layout.
 * Renders each line as a separate horizontal row in a dark terminal window.
 * Quota section uses theme.quotaLow / theme.quotaHigh for coloring.
 */
import type React from "react";
import { useState } from "react";
import { useI18n } from "../../i18n";

interface StatuslineTerminalPreviewProps {
	lines: string[][];
	sectionConfig: Record<string, SectionConfig>;
	theme: StatuslineTheme;
}

/** Alias for shared color map — maps ANSI color names to CSS hex for preview */
const COLOR_MAP = ANSI_COLOR_HEX_MAP;

function resolveColor(name: string): string {
	return COLOR_MAP[name] ?? COLOR_MAP.default;
}

interface SectionChipProps {
	sectionId: string;
	config: SectionConfig;
	theme: StatuslineTheme;
}

const SectionChip: React.FC<SectionChipProps> = ({ sectionId, config, theme }) => {
	const mockValue = SECTION_MOCK_VALUES[sectionId as keyof typeof SECTION_MOCK_VALUES] ?? sectionId;
	const icon = config.icon ?? "";

	// Determine text color based on section type
	let textColor = resolveColor(theme.accent);
	if (sectionId === "context") {
		// Simulate 52% context → mid color
		textColor = resolveColor(theme.contextMid);
	} else if (sectionId === "quota") {
		// Quota: show quotaHigh if >70% usage (mock shows 3.1h/5h = 62% → quotaLow)
		textColor = resolveColor(theme.quotaLow);
	} else if (sectionId === "cost") {
		textColor = resolveColor(theme.muted);
	}

	const displayText = config.label
		? `${icon} ${config.label}: ${mockValue}`
		: icon
			? `${icon} ${mockValue}`
			: mockValue;

	const truncated =
		config.maxWidth && displayText.length > config.maxWidth
			? `${displayText.slice(0, config.maxWidth - 1)}…`
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

/** Render one statusline row for a given list of section IDs */
const StatuslineRow: React.FC<{
	sectionIds: string[];
	sectionConfig: Record<string, SectionConfig>;
	theme: StatuslineTheme;
	cols: number;
}> = ({ sectionIds, sectionConfig, theme, cols }) => {
	// Responsive: at narrow width, limit sections shown per line
	const visible =
		cols < 100 ? sectionIds.slice(0, 3) : cols < 160 ? sectionIds.slice(0, 5) : sectionIds;

	return (
		<div
			className="flex flex-wrap items-center gap-0 py-1 px-2 rounded mb-1 last:mb-0"
			style={{
				backgroundColor: "#313244",
				maxWidth: `${Math.min(cols * 7, 100)}%`,
			}}
		>
			{visible.length === 0 ? (
				<span className="text-xs font-mono opacity-30" style={{ color: COLOR_MAP.dim }}>
					(empty line)
				</span>
			) : (
				visible.map((id, idx) => (
					<span key={id} className="flex items-center">
						<SectionChip sectionId={id} config={sectionConfig[id] ?? {}} theme={theme} />
						{idx < visible.length - 1 && SEPARATOR}
					</span>
				))
			)}
		</div>
	);
};

export const StatuslineTerminalPreview: React.FC<StatuslineTerminalPreviewProps> = ({
	lines,
	sectionConfig,
	theme,
}) => {
	const { t } = useI18n();
	const [widthIndex, setWidthIndex] = useState(1);

	const cols = WIDTH_OPTIONS[widthIndex].cols;
	const totalVisible = lines.reduce((sum, line) => sum + line.length, 0);
	const totalSections = totalVisible; // all sections in lines are visible by definition

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

					{/* Multi-line statusline */}
					{lines.length === 0 ? (
						<div
							className="py-1 px-2 rounded mb-1"
							style={{ backgroundColor: "#313244", maxWidth: `${Math.min(cols * 7, 100)}%` }}
						>
							<span className="text-xs font-mono opacity-30" style={{ color: COLOR_MAP.dim }}>
								(no lines configured)
							</span>
						</div>
					) : (
						lines.map((lineIds, idx) => (
							<StatuslineRow
								key={idx}
								sectionIds={lineIds}
								sectionConfig={sectionConfig}
								theme={theme}
								cols={cols}
							/>
						))
					)}

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
				{totalSections} {t("statuslineSectionsVisible")}
			</p>
		</div>
	);
};
