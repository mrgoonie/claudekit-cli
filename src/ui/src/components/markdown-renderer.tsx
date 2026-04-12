/**
 * Shared markdown renderer — converts markdown text to styled React nodes.
 * No dangerouslySetInnerHTML, no external deps — safe JSX output only.
 *
 * Supports: headings (h1-h3), bold, italic, inline code, fenced code blocks,
 * unordered/ordered lists, paragraphs, blockquotes, links, horizontal rules,
 * frontmatter (---) stripping.
 */
import type React from "react";

export interface MarkdownHeading {
	level: number;
	text: string;
	id: string;
}

export function slugifyHeading(text: string): string {
	return text
		.toLowerCase()
		.trim()
		.replace(/[`*_~]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

export function extractMarkdownHeadings(content: string): MarkdownHeading[] {
	return content.split("\n").flatMap((line) => {
		const match = /^(#{1,6})\s+(.+)$/.exec(line.trim());
		if (!match) return [];
		return [
			{
				level: match[1].length,
				text: match[2].trim(),
				id: slugifyHeading(match[2]),
			},
		];
	});
}

// ─── Inline formatting ────────────────────────────────────────────────────────

/**
 * Splits a text string on markdown inline patterns and returns React nodes.
 * Processes: **bold**, *italic* / _italic_, `code`, [link](url)
 */
function formatInline(text: string, keyPrefix: string): React.ReactNode {
	// Pattern order matters — bold before italic to avoid partial matches
	const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
	const nodes: React.ReactNode[] = [];
	let lastIndex = 0;
	let segIdx = 0;

	// Use matchAll to avoid assignment-in-expression lint violation
	for (const match of text.matchAll(pattern)) {
		// Plain text before this match
		if (match.index !== undefined && match.index > lastIndex) {
			nodes.push(text.slice(lastIndex, match.index));
		}

		const nodeKey = `${keyPrefix}-inline-${segIdx++}`;

		if (match[0].startsWith("**")) {
			// **bold**
			nodes.push(<strong key={nodeKey}>{match[2]}</strong>);
		} else if (match[0].startsWith("`")) {
			// `inline code`
			nodes.push(
				<code
					key={nodeKey}
					className="bg-[var(--dash-surface)] border border-[var(--dash-border)] px-1.5 py-0.5 rounded text-sm font-mono text-[var(--dash-accent)]"
				>
					{match[5]}
				</code>,
			);
		} else if (match[0].startsWith("[")) {
			// [link text](url)
			nodes.push(
				<a
					key={nodeKey}
					href={match[7]}
					target="_blank"
					rel="noopener noreferrer"
					className="text-[var(--dash-accent)] hover:underline"
				>
					{match[6]}
				</a>,
			);
		} else {
			// *italic* or _italic_
			nodes.push(<em key={nodeKey}>{match[3] ?? match[4]}</em>);
		}

		if (match.index !== undefined) {
			lastIndex = match.index + match[0].length;
		}
	}

	// Remaining plain text
	if (lastIndex < text.length) {
		nodes.push(text.slice(lastIndex));
	}

	return nodes.length === 1 ? nodes[0] : <>{nodes}</>;
}

// ─── Block parser ─────────────────────────────────────────────────────────────

interface MarkdownRendererProps {
	/** Raw markdown string to render */
	content: string;
	/** Optional extra className on the wrapper div */
	className?: string;
}

/**
 * Renders a markdown string as styled React JSX nodes.
 * Uses Tailwind classes matching the CK dashboard theme (dash-* CSS vars).
 */
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = "" }) => {
	const lines = content.split("\n");
	const elements: React.ReactNode[] = [];
	let i = 0;
	let keyIdx = 0;

	function key() {
		keyIdx += 1;
		return `md-${keyIdx}`;
	}

	// Strip leading frontmatter block (--- ... ---)
	if (lines[0]?.trim() === "---") {
		i = 1;
		while (i < lines.length && lines[i]?.trim() !== "---") {
			i++;
		}
		i++; // skip closing ---
	}

	while (i < lines.length) {
		const line = lines[i];

		// ── Fenced code block ──────────────────────────────────────────────────
		if (line.startsWith("```")) {
			const lang = line.slice(3).trim();
			const codeLines: string[] = [];
			i++;
			while (i < lines.length && !lines[i].startsWith("```")) {
				codeLines.push(lines[i]);
				i++;
			}
			const k = key();
			elements.push(
				<div key={k} className="my-3">
					{lang && (
						<div className="text-[10px] font-mono text-[var(--dash-text-muted)] bg-[var(--dash-surface)] border border-b-0 border-[var(--dash-border)] rounded-t px-3 py-1">
							{lang}
						</div>
					)}
					<pre
						className={[
							"overflow-x-auto p-4 text-xs font-mono text-[var(--dash-text)]",
							"bg-[var(--dash-surface)] border border-[var(--dash-border)]",
							lang ? "rounded-b" : "rounded",
						].join(" ")}
					>
						<code>{codeLines.join("\n")}</code>
					</pre>
				</div>,
			);
			i++; // skip closing ```
			continue;
		}

		// ── Horizontal rule ────────────────────────────────────────────────────
		if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
			elements.push(<hr key={key()} className="border-[var(--dash-border)] my-4" />);
			i++;
			continue;
		}

		// ── Headings ───────────────────────────────────────────────────────────
		if (line.startsWith("### ")) {
			const text = line.slice(4);
			elements.push(
				<h3
					id={slugifyHeading(text)}
					key={key()}
					className="text-sm font-semibold text-[var(--dash-text)] mt-4 mb-1 scroll-mt-24"
				>
					{formatInline(text, `h3-${keyIdx}`)}
				</h3>,
			);
			i++;
			continue;
		}
		if (line.startsWith("## ")) {
			const text = line.slice(3);
			elements.push(
				<h2
					id={slugifyHeading(text)}
					key={key()}
					className="text-base font-semibold text-[var(--dash-text)] mt-5 mb-2 pb-1 border-b border-[var(--dash-border)] scroll-mt-24"
				>
					{formatInline(text, `h2-${keyIdx}`)}
				</h2>,
			);
			i++;
			continue;
		}
		if (line.startsWith("# ")) {
			const text = line.slice(2);
			elements.push(
				<h1
					id={slugifyHeading(text)}
					key={key()}
					className="text-xl font-bold text-[var(--dash-text)] mt-4 mb-2 first:mt-0 scroll-mt-24"
				>
					{formatInline(text, `h1-${keyIdx}`)}
				</h1>,
			);
			i++;
			continue;
		}

		// ── Markdown table ────────────────────────────────────────────────────
		if (
			line.trim().startsWith("|") &&
			/^\|(?:\s*:?-+:?\s*\|)+\s*$/.test(lines[i + 1]?.trim() ?? "")
		) {
			const headerCells = line
				.trim()
				.split("|")
				.slice(1, -1)
				.map((cell) => cell.trim());
			const rows: string[][] = [];
			i += 2;
			while (i < lines.length && lines[i].trim().startsWith("|")) {
				rows.push(
					lines[i]
						.trim()
						.split("|")
						.slice(1, -1)
						.map((cell) => cell.trim()),
				);
				i++;
			}
			const k = key();
			elements.push(
				<div key={k} className="my-4 overflow-x-auto rounded-lg border border-[var(--dash-border)]">
					<table className="min-w-full text-sm">
						<thead className="bg-[var(--dash-surface)] text-[var(--dash-text)]">
							<tr>
								{headerCells.map((cell, index) => (
									<th key={`${k}-head-${index}`} className="px-3 py-2 text-left font-semibold">
										{formatInline(cell, `${k}-head-${index}`)}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{rows.map((row, rowIndex) => (
								<tr
									key={`${k}-row-${rowIndex}`}
									className="border-t border-[var(--dash-border)] text-[var(--dash-text-muted)]"
								>
									{row.map((cell, cellIndex) => (
										<td key={`${k}-cell-${rowIndex}-${cellIndex}`} className="px-3 py-2 align-top">
											{formatInline(cell, `${k}-cell-${rowIndex}-${cellIndex}`)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>,
			);
			continue;
		}

		// ── Blockquote ─────────────────────────────────────────────────────────
		if (line.startsWith("> ")) {
			const quoteLines: string[] = [];
			while (i < lines.length && lines[i].startsWith("> ")) {
				quoteLines.push(lines[i].slice(2));
				i++;
			}
			const k = key();
			elements.push(
				<blockquote
					key={k}
					className="border-l-2 border-[var(--dash-accent)] pl-4 italic text-[var(--dash-text-muted)] my-2"
				>
					{quoteLines.map((ql, qi) => (
						<p key={`${k}-q${qi}`} className="text-sm leading-relaxed">
							{formatInline(ql, `${k}-q${qi}`)}
						</p>
					))}
				</blockquote>,
			);
			continue;
		}

		// ── Unordered list ─────────────────────────────────────────────────────
		if (/^\s*[-*+] /.test(line)) {
			const items: string[] = [];
			while (i < lines.length && /^\s*[-*+] /.test(lines[i])) {
				items.push(lines[i].replace(/^\s*[-*+] /, ""));
				i++;
			}
			const k = key();
			elements.push(
				<ul key={k} className="list-disc pl-6 space-y-1 my-2">
					{items.map((item, idx) => (
						<li key={`${k}-li${idx}`} className="text-sm text-[var(--dash-text)] leading-relaxed">
							{formatInline(item, `${k}-li${idx}`)}
						</li>
					))}
				</ul>,
			);
			continue;
		}

		// ── Ordered list ───────────────────────────────────────────────────────
		if (/^\d+\. /.test(line)) {
			const items: string[] = [];
			while (i < lines.length && /^\d+\. /.test(lines[i])) {
				items.push(lines[i].replace(/^\d+\. /, ""));
				i++;
			}
			const k = key();
			elements.push(
				<ol key={k} className="list-decimal pl-6 space-y-1 my-2">
					{items.map((item, idx) => (
						<li key={`${k}-ol${idx}`} className="text-sm text-[var(--dash-text)] leading-relaxed">
							{formatInline(item, `${k}-ol${idx}`)}
						</li>
					))}
				</ol>,
			);
			continue;
		}

		// ── Empty line ─────────────────────────────────────────────────────────
		if (line.trim() === "") {
			elements.push(<div key={key()} className="h-2" />);
			i++;
			continue;
		}

		// ── Paragraph ──────────────────────────────────────────────────────────
		elements.push(
			<p key={key()} className="text-sm text-[var(--dash-text)] leading-relaxed my-1">
				{formatInline(line, `p-${keyIdx}`)}
			</p>,
		);
		i++;
	}

	return <div className={`markdown-content ${className}`.trim()}>{elements}</div>;
};

export default MarkdownRenderer;
