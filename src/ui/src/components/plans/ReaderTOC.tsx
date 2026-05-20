import { useI18n } from "../../i18n";
import { extractMarkdownHeadings } from "../markdown-renderer";

export default function ReaderTOC({ content }: { content: string }) {
	const { t } = useI18n();
	const headings = extractMarkdownHeadings(content).filter((heading) => heading.level <= 3);
	if (headings.length === 0) return null;
	return (
		<aside className="rounded-xl border border-dash-border bg-dash-surface p-4">
			<h2 className="mb-3 text-sm font-semibold text-dash-text">{t("plansContents")}</h2>
			<nav className="space-y-2">
				{headings.map((heading) => (
					<a
						key={heading.id}
						href={`#${heading.id}`}
						className="block text-sm text-dash-text-muted transition hover:text-dash-accent"
						style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
					>
						{heading.text}
					</a>
				))}
			</nav>
		</aside>
	);
}
