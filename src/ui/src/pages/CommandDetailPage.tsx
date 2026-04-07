/**
 * CommandDetailPage — read-only markdown view of a single command file.
 * Route: /commands/:slug (splat, any depth)
 */
import type React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCommandDetail } from "../hooks/use-commands";
import { useI18n } from "../i18n";

// ─── Minimal markdown renderer ────────────────────────────────────────────────

/**
 * Very lightweight markdown → HTML conversion for command files.
 * Handles: headings, bold, inline code, code blocks, lists, paragraphs.
 * No external dep required — commands are short, structured docs.
 */
function renderMarkdown(md: string): string {
	// Escape HTML first (before we insert our own tags)
	const htmlEscape = (s: string) =>
		s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

	const lines = md.split("\n");
	const out: string[] = [];
	let inCode = false;
	let codeLang = "";
	let codeLines: string[] = [];
	let inList = false;

	const flushList = () => {
		if (inList) {
			out.push("</ul>");
			inList = false;
		}
	};

	const flushCode = () => {
		if (inCode) {
			const escaped = codeLines.map(htmlEscape).join("\n");
			const langClass = codeLang ? ` class="language-${htmlEscape(codeLang)}"` : "";
			out.push(`<pre class="code-block"><code${langClass}>${escaped}</code></pre>`);
			codeLines = [];
			codeLang = "";
			inCode = false;
		}
	};

	for (const raw of lines) {
		// Code fence toggle
		if (/^```/.test(raw)) {
			if (inCode) {
				flushCode();
			} else {
				flushList();
				codeLang = raw.slice(3).trim();
				inCode = true;
			}
			continue;
		}

		if (inCode) {
			codeLines.push(raw);
			continue;
		}

		// Headings
		const h3 = /^### (.+)/.exec(raw);
		if (h3) {
			flushList();
			out.push(`<h3 class="md-h3">${htmlEscape(h3[1])}</h3>`);
			continue;
		}
		const h2 = /^## (.+)/.exec(raw);
		if (h2) {
			flushList();
			out.push(`<h2 class="md-h2">${htmlEscape(h2[1])}</h2>`);
			continue;
		}
		const h1 = /^# (.+)/.exec(raw);
		if (h1) {
			flushList();
			out.push(`<h1 class="md-h1">${htmlEscape(h1[1])}</h1>`);
			continue;
		}

		// List items
		const li = /^[-*] (.+)/.exec(raw);
		if (li) {
			if (!inList) {
				out.push('<ul class="md-ul">');
				inList = true;
			}
			out.push(`<li class="md-li">${inlineFormat(htmlEscape(li[1]))}</li>`);
			continue;
		}

		// Empty line
		if (raw.trim() === "") {
			flushList();
			out.push('<p class="md-spacer"></p>');
			continue;
		}

		// Paragraph
		flushList();
		out.push(`<p class="md-p">${inlineFormat(htmlEscape(raw))}</p>`);
	}

	flushCode();
	flushList();

	return out.join("\n");
}

/** Apply inline formatting: **bold**, `code`, _italic_ */
function inlineFormat(s: string): string {
	return s
		.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
		.replace(/`(.+?)`/g, '<code class="md-inline-code">$1</code>')
		.replace(/_(.+?)_/g, "<em>$1</em>");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const CommandDetailPage: React.FC = () => {
	const { t } = useI18n();
	const navigate = useNavigate();
	// React Router v6 splat param is "*"
	const params = useParams<{ "*": string }>();
	const commandPath = params["*"];

	const { detail, loading, error } = useCommandDetail(commandPath);

	const renderedHtml = detail ? renderMarkdown(detail.content) : "";

	return (
		<div className="flex flex-col h-full gap-4 max-w-3xl mx-auto w-full">
			{/* Back button + header */}
			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={() => navigate("/commands")}
					className="flex items-center gap-1.5 text-sm text-dash-text-muted hover:text-dash-text transition-colors shrink-0"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						className="w-4 h-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M15 19l-7-7 7-7"
						/>
					</svg>
					{t("backToCommands")}
				</button>
				<span className="text-dash-border">/</span>
				{detail && (
					<h1 className="text-sm font-semibold text-dash-text font-mono truncate">
						/{detail.name}
					</h1>
				)}
				<span className="ml-auto text-xs px-2 py-0.5 rounded bg-dash-accent-subtle text-dash-accent font-semibold shrink-0">
					{t("sessionReadOnly")}
				</span>
			</div>

			{/* Loading */}
			{loading && (
				<div className="flex flex-1 items-center justify-center text-dash-text-muted text-sm">
					{t("sessionLoading")}
				</div>
			)}

			{/* Error */}
			{!loading && error && (
				<div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-400 text-sm">
					{t("sessionError")}: {error}
				</div>
			)}

			{/* Detail */}
			{!loading && !error && detail && (
				<div className="flex flex-col gap-4 overflow-y-auto pb-6">
					{/* Meta card */}
					{detail.description && (
						<div className="rounded-lg border border-dash-border bg-dash-surface px-4 py-3">
							<p className="text-sm text-dash-text-muted">{detail.description}</p>
						</div>
					)}

					{/* Path badge */}
					<div className="flex items-center gap-2 text-xs text-dash-text-muted">
						<span className="font-mono px-2 py-0.5 rounded bg-dash-surface border border-dash-border text-dash-accent">
							~/.claude/commands/{detail.path}
						</span>
					</div>

					{/* Markdown content — safe: htmlEscape applied to all user-file content before insertion */}
					<div
						className="command-markdown rounded-lg border border-dash-border bg-dash-surface p-5 text-sm text-dash-text overflow-x-auto"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: content rendered via htmlEscape pipeline, no raw user input
						dangerouslySetInnerHTML={{ __html: renderedHtml }}
					/>
				</div>
			)}

			{/* Embedded styles for markdown rendering */}
			<style>{`
				.command-markdown .md-h1 {
					font-size: 1.25rem;
					font-weight: 700;
					margin: 1rem 0 0.5rem;
					color: var(--dash-text);
				}
				.command-markdown .md-h2 {
					font-size: 1.05rem;
					font-weight: 600;
					margin: 0.9rem 0 0.4rem;
					color: var(--dash-text);
					border-bottom: 1px solid var(--dash-border);
					padding-bottom: 0.25rem;
				}
				.command-markdown .md-h3 {
					font-size: 0.95rem;
					font-weight: 600;
					margin: 0.75rem 0 0.3rem;
					color: var(--dash-text);
				}
				.command-markdown .md-p {
					margin: 0.35rem 0;
					line-height: 1.6;
				}
				.command-markdown .md-spacer {
					margin: 0.5rem 0;
				}
				.command-markdown .md-ul {
					margin: 0.4rem 0;
					padding-left: 1.25rem;
					list-style-type: disc;
				}
				.command-markdown .md-li {
					margin: 0.2rem 0;
					line-height: 1.5;
				}
				.command-markdown .code-block {
					background: var(--dash-bg);
					border: 1px solid var(--dash-border);
					border-radius: 0.375rem;
					padding: 0.75rem 1rem;
					margin: 0.5rem 0;
					overflow-x: auto;
					font-size: 0.8125rem;
					line-height: 1.5;
					font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
				}
				.command-markdown .md-inline-code {
					background: var(--dash-bg);
					border: 1px solid var(--dash-border);
					border-radius: 0.25rem;
					padding: 0.1em 0.35em;
					font-size: 0.85em;
					font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
					color: var(--dash-accent);
				}
			`}</style>
		</div>
	);
};

export default CommandDetailPage;
