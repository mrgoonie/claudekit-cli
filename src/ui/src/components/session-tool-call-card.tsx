/**
 * Tool call card — collapsible card for a single tool invocation.
 * Color-coded by tool name; shows input + result in expandable sections.
 */
import type React from "react";
import { useState } from "react";
import { useI18n } from "../i18n";

// ─── Tool style map ───────────────────────────────────────────────────────────

const TOOL_STYLES: Record<string, { colorClass: string; bgClass: string }> = {
	Bash: {
		colorClass: "text-purple-500 dark:text-purple-400",
		bgClass: "bg-gray-100 dark:bg-[#1a1b26]",
	},
	Read: { colorClass: "text-blue-400", bgClass: "bg-blue-500/5" },
	Write: { colorClass: "text-emerald-400", bgClass: "bg-emerald-500/5" },
	Edit: { colorClass: "text-amber-400", bgClass: "bg-amber-500/5" },
	MultiEdit: { colorClass: "text-amber-400", bgClass: "bg-amber-500/5" },
	Grep: { colorClass: "text-cyan-400", bgClass: "bg-cyan-500/5" },
	Glob: { colorClass: "text-cyan-400", bgClass: "bg-cyan-500/5" },
	Agent: { colorClass: "text-violet-400", bgClass: "bg-violet-500/5" },
	WebSearch: { colorClass: "text-indigo-400", bgClass: "bg-indigo-500/5" },
	WebFetch: { colorClass: "text-indigo-400", bgClass: "bg-indigo-500/5" },
	Skill: { colorClass: "text-pink-400", bgClass: "bg-pink-500/5" },
};
const DEFAULT_STYLE = { colorClass: "text-dash-text-muted", bgClass: "bg-dash-bg/50" };

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SessionToolCallCardProps {
	toolName: string;
	toolInput?: string;
	result?: string;
	isError?: boolean;
	/** For Skill tool calls: the resolved skill name (e.g. "cook", "fix") */
	skillName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
	return s.length <= max ? s : `${s.slice(0, max)}…`;
}

/** Attempt to pretty-print JSON; fall back to raw string. */
function formatInput(raw: string): string {
	try {
		return JSON.stringify(JSON.parse(raw), null, 2);
	} catch {
		return raw;
	}
}

// ─── Component ────────────────────────────────────────────────────────────────

const SessionToolCallCard: React.FC<SessionToolCallCardProps> = ({
	toolName,
	toolInput,
	result,
	isError = false,
	skillName,
}) => {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const style = TOOL_STYLES[toolName] ?? DEFAULT_STYLE;
	const isBash = toolName === "Bash";
	const isSkillCall = toolName === "Skill" && skillName;

	// Result preview shown in header when collapsed
	const preview = result ? truncate(result.trim(), 80) : null;

	return (
		<div
			className={`rounded-lg border overflow-hidden ${
				isSkillCall ? "border-pink-500/20 bg-pink-500/5" : `border-dash-border ${style.bgClass}`
			}`}
		>
			{/* ── Header button ── */}
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
				aria-expanded={open}
			>
				{/* Chevron rotates when open */}
				<svg
					width="12"
					height="12"
					viewBox="0 0 16 16"
					fill="none"
					aria-hidden="true"
					className={`shrink-0 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
				>
					<path
						d="M6 4l4 4-4 4"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>

				{isSkillCall ? (
					<>
						{/* Skill-specific header: zap icon + "Skill: name" */}
						<svg
							width="14"
							height="14"
							viewBox="0 0 16 16"
							fill="none"
							aria-hidden="true"
							className="shrink-0 text-pink-500 dark:text-pink-400"
						>
							<path
								d="M8.5 1.5L3 9h4.5l-1 5.5L13 7H8.5l1-5.5z"
								stroke="currentColor"
								strokeWidth="1.2"
								strokeLinejoin="round"
							/>
						</svg>
						<span className="font-semibold text-sm text-pink-600 dark:text-pink-400">Skill:</span>
						<span className="font-mono text-sm text-pink-600 dark:text-pink-400">{skillName}</span>
					</>
				) : (
					/* Standard tool name */
					<span className={`font-mono font-semibold text-sm ${style.colorClass}`}>{toolName}</span>
				)}

				{/* Result preview (collapsed only) */}
				{!open && preview && (
					<span className="ml-2 truncate text-xs text-dash-text-muted">{preview}</span>
				)}
			</button>

			{/* ── Expandable body ── */}
			{open && (
				<div className="border-t border-dash-border/50 flex flex-col gap-0">
					{/* Input section */}
					{toolInput && (
						<div className="px-3 py-2">
							<div className="mb-1 text-[10px] uppercase tracking-wider text-dash-text-muted">
								{t("sessionToolInput")}
							</div>
							<pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded text-xs text-dash-text">
								{formatInput(toolInput)}
							</pre>
						</div>
					)}

					{/* Result section */}
					{result && (
						<div className={`px-3 py-2 ${toolInput ? "border-t border-dash-border/30" : ""}`}>
							<div className="mb-1 text-[10px] uppercase tracking-wider text-dash-text-muted">
								{t("sessionToolResult")}
							</div>
							<pre
								className={`max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded text-xs ${
									isBash
										? "bg-gray-100 dark:bg-[#1a1b26] px-2 py-1.5 text-gray-800 dark:text-[#9ece6a] font-mono"
										: isError
											? "border border-red-500/30 bg-red-500/5 px-2 py-1.5 text-red-400"
											: "text-dash-text"
								}`}
							>
								{result}
							</pre>
						</div>
					)}
				</div>
			)}
		</div>
	);
};

export default SessionToolCallCard;
