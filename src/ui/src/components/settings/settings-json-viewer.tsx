/**
 * Read-only JSON viewer with copy-to-clipboard
 * Supports fullHeight mode for side-panel layout (fills parent container)
 */
import type React from "react";
import { useEffect, useState } from "react";
import { useI18n } from "../../i18n";
import { fetchFullSettings } from "../../services/api";

/** Copy icon SVG */
const CopyIcon: React.FC = () => (
	<svg
		className="w-3.5 h-3.5"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth={1.5}
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
		/>
	</svg>
);

/** Check icon for copied state */
const CheckIcon: React.FC = () => (
	<svg
		className="w-3.5 h-3.5"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth={2}
	>
		<path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
	</svg>
);

/** Document/JSON icon */
const JsonIcon: React.FC = () => (
	<svg
		className="w-4 h-4 text-dash-text-muted"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth={1.5}
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
		/>
	</svg>
);

interface SettingsJsonViewerProps {
	/** When true, fills parent height with no border/rounding — for side-panel use */
	fullHeight?: boolean;
}

const SettingsJsonViewer: React.FC<SettingsJsonViewerProps> = ({ fullHeight }) => {
	const { t } = useI18n();
	const [json, setJson] = useState<string>("");
	const [loading, setLoading] = useState(true);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		fetchFullSettings()
			.then((data) => setJson(JSON.stringify(data, null, 2)))
			.catch(() => setJson("{}"))
			.finally(() => setLoading(false));
	}, []);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(json);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard API not available — silently ignore
		}
	};

	const wrapperClass = fullHeight
		? "h-full flex flex-col border-l border-dash-border bg-dash-surface"
		: "bg-dash-surface rounded-lg border border-dash-border p-5";

	const preClass = fullHeight
		? "flex-1 text-[11px] font-mono text-dash-text-secondary bg-dash-bg p-4 overflow-auto leading-relaxed min-h-0"
		: "text-[11px] font-mono text-dash-text-secondary bg-dash-bg rounded-md p-4 overflow-auto border border-dash-border-subtle leading-relaxed max-h-96";

	return (
		<div className={wrapperClass}>
			{/* Header with copy action */}
			<div
				className={`flex items-center justify-between shrink-0 ${fullHeight ? "px-4 py-3 border-b border-dash-border" : "mb-3"}`}
			>
				<div className="flex items-center gap-2">
					<JsonIcon />
					<h3 className="text-sm font-semibold text-dash-text">{t("settingsRawJson")}</h3>
				</div>
				{!loading && (
					<button
						type="button"
						onClick={handleCopy}
						className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
							copied
								? "text-emerald-600 bg-emerald-500/10"
								: "text-dash-text-muted hover:text-dash-text hover:bg-dash-surface-hover"
						}`}
					>
						{copied ? <CheckIcon /> : <CopyIcon />}
						{copied ? t("settingsJsonCopied") : t("settingsJsonCopy")}
					</button>
				)}
			</div>

			{/* JSON content */}
			{loading ? (
				<div
					className={`animate-pulse ${fullHeight ? "flex-1 px-4 py-4" : "bg-dash-bg rounded-md p-4"}`}
				>
					<div className="h-3 w-3/4 bg-dash-surface-hover rounded mb-2" />
					<div className="h-3 w-1/2 bg-dash-surface-hover rounded mb-2" />
					<div className="h-3 w-2/3 bg-dash-surface-hover rounded" />
				</div>
			) : (
				<pre className={preClass}>{json}</pre>
			)}
		</div>
	);
};

export default SettingsJsonViewer;
