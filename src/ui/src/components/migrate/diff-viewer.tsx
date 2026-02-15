/**
 * Lightweight diff viewer component
 * Color-coded unified diff display without heavy dependencies
 */

import type React from "react";

interface DiffViewerProps {
	diff: string;
	className?: string;
}

const MAX_DIFF_LINES = 500;

function isDisallowedControlCode(codePoint: number): boolean {
	return (
		(codePoint >= 0x00 && codePoint <= 0x08) ||
		(codePoint >= 0x0b && codePoint <= 0x1f) ||
		(codePoint >= 0x7f && codePoint <= 0x9f)
	);
}

function sanitizeLine(line: string): string {
	let output = "";
	for (const char of line) {
		const codePoint = char.codePointAt(0);
		if (codePoint === undefined) continue;
		if (!isDisallowedControlCode(codePoint)) {
			output += char;
		}
	}
	return output;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diff, className = "" }) => {
	const lines = diff.split("\n");
	const shownLines = lines.slice(0, MAX_DIFF_LINES);
	const truncatedCount = lines.length - shownLines.length;

	return (
		<pre
			className={`text-xs font-mono overflow-x-auto p-3 rounded bg-dash-bg border border-dash-border ${className}`}
		>
			{shownLines.map((rawLine, i) => {
				const line = sanitizeLine(rawLine);
				let lineClass = "text-dash-text";

				if (line.startsWith("+")) {
					lineClass = "text-green-400 bg-green-500/10";
				} else if (line.startsWith("-")) {
					lineClass = "text-red-400 bg-red-500/10";
				} else if (line.startsWith("@@")) {
					lineClass = "text-blue-400";
				}

				return (
					<div key={`${i}:${line.slice(0, 24)}`} className={lineClass}>
						{line}
					</div>
				);
			})}
			{truncatedCount > 0 && (
				<div className="text-dash-text-muted">
					... truncated {truncatedCount} additional line(s)
				</div>
			)}
		</pre>
	);
};
