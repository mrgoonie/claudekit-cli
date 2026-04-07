/**
 * Agent detail page — read-only view of frontmatter config + instructions body
 * Route: /agents/:slug
 */
import type React from "react";
import { useNavigate, useParams } from "react-router-dom";
import MarkdownRenderer from "../components/markdown-renderer";
import { useAgentDetail } from "../hooks/use-agents-browser";
import { useI18n } from "../i18n";

// ─── Frontmatter table ─────────────────────────────────────────────────────

/** Keys to skip in the frontmatter display (shown inline elsewhere) */
const SKIP_KEYS = new Set(["name", "description", "color"]);

interface FrontmatterTableProps {
	frontmatter: Record<string, unknown>;
}

const FrontmatterTable: React.FC<FrontmatterTableProps> = ({ frontmatter }) => {
	const entries = Object.entries(frontmatter).filter(
		([k, v]) => !SKIP_KEYS.has(k) && v !== undefined && v !== null && v !== "",
	);

	if (entries.length === 0) return null;

	return (
		<div className="rounded-lg border border-[var(--border)] overflow-hidden text-sm">
			<table className="w-full">
				<tbody>
					{entries.map(([key, value]) => (
						<tr key={key} className="border-b border-[var(--border)] last:border-0">
							<td className="px-3 py-2 font-mono text-xs text-[var(--muted-foreground)] bg-[var(--muted)] w-32 shrink-0 align-top">
								{key}
							</td>
							<td className="px-3 py-2 text-xs text-[var(--foreground)] break-all">
								{typeof value === "object" ? JSON.stringify(value) : String(value)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};

// ─── Instructions body renderer — delegates to shared MarkdownRenderer ────────

interface InstructionsBodyProps {
	body: string;
}

const InstructionsBody: React.FC<InstructionsBodyProps> = ({ body }) => (
	<div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4 overflow-auto">
		<MarkdownRenderer content={body} />
	</div>
);

// ─── Back button ───────────────────────────────────────────────────────────

interface BackButtonProps {
	label: string;
	onClick: () => void;
}

const BackButton: React.FC<BackButtonProps> = ({ label, onClick }) => (
	<button
		type="button"
		onClick={onClick}
		className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			className="w-3.5 h-3.5"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
		</svg>
		{label}
	</button>
);

// ─── Main page ─────────────────────────────────────────────────────────────

const AgentDetailPage: React.FC = () => {
	const { t } = useI18n();
	const navigate = useNavigate();
	const { slug } = useParams<{ slug: string }>();
	const { agent, loading, error } = useAgentDetail(slug);

	const accentColor = agent?.color || "hsl(var(--accent))";

	return (
		<div className="flex flex-col h-full overflow-hidden">
			{/* Header */}
			<div className="shrink-0 px-6 pt-5 pb-4 border-b border-[var(--border)]">
				<BackButton label={t("backToAgents")} onClick={() => navigate("/agents")} />

				{loading && <p className="mt-3 text-sm text-[var(--muted-foreground)]">{t("loading")}</p>}

				{!loading && agent && (
					<div className="mt-3 flex items-start gap-3">
						{/* Colored accent dot */}
						<div
							className="mt-1 w-3 h-3 rounded-full shrink-0"
							style={{ backgroundColor: accentColor }}
						/>
						<div className="min-w-0">
							<h1 className="text-lg font-bold text-[var(--foreground)] truncate">{agent.name}</h1>
							{agent.description && (
								<p className="text-sm text-[var(--muted-foreground)] mt-0.5">{agent.description}</p>
							)}
							<p className="text-[10px] text-[var(--muted-foreground)] mt-1 font-mono">
								{agent.dirLabel}/{slug}.md
							</p>
						</div>
					</div>
				)}

				{!loading && error && <p className="mt-3 text-sm text-red-500">{error}</p>}
			</div>

			{/* Body */}
			{!loading && agent && (
				<div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
					{/* Frontmatter section */}
					<section>
						<h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)] mb-3">
							{t("agentFrontmatter")}
						</h2>
						<FrontmatterTable frontmatter={agent.frontmatter} />
					</section>

					{/* Instructions section */}
					{agent.body && (
						<section>
							<h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)] mb-3">
								{t("agentInstructions")}
							</h2>
							<InstructionsBody body={agent.body} />
						</section>
					)}
				</div>
			)}
		</div>
	);
};

export default AgentDetailPage;
