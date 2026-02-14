/**
 * Lightweight diff viewer component
 * Color-coded unified diff display without heavy dependencies
 */

import type React from "react";

interface DiffViewerProps {
	diff: string;
	className?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diff, className = "" }) => {
	const lines = diff.split("\n");

	return (
		<pre
			className={`text-xs font-mono overflow-x-auto p-3 rounded bg-dash-bg border border-dash-border ${className}`}
		>
			{lines.map((line, i) => {
				let lineClass = "text-dash-text";

				if (line.startsWith("+")) {
					lineClass = "text-green-400 bg-green-500/10";
				} else if (line.startsWith("-")) {
					lineClass = "text-red-400 bg-red-500/10";
				} else if (line.startsWith("@@")) {
					lineClass = "text-blue-400";
				}

				return (
					<div key={i} className={lineClass}>
						{line}
					</div>
				);
			})}
		</pre>
	);
};
