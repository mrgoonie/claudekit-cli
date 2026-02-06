/**
 * Changelog section showing recent GitHub releases
 */
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../../i18n";
import { fetchKitChangelog } from "../../services/api";
import type { GitHubRelease } from "../../services/api";

const KitChangelogSection: React.FC = () => {
	const { t } = useI18n();
	const [releases, setReleases] = useState<GitHubRelease[]>([]);
	const [loading, setLoading] = useState(true);
	const [expandedTag, setExpandedTag] = useState<string | null>(null);

	const loadChangelog = useCallback(async () => {
		try {
			setLoading(true);
			const data = await fetchKitChangelog();
			setReleases(data);
		} catch {
			// Silently fail - changelog is non-critical
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadChangelog();
	}, [loadChangelog]);

	if (loading) {
		return (
			<div className="py-4 text-center">
				<div className="w-5 h-5 border-2 border-dash-accent border-t-transparent rounded-full animate-spin mx-auto" />
			</div>
		);
	}

	if (releases.length === 0) {
		return (
			<div className="py-4 text-center text-dash-text-muted text-sm">{t("kitNoReleases")}</div>
		);
	}

	return (
		<div className="space-y-2">
			{releases.map((release) => {
				const isExpanded = expandedTag === release.tag_name;
				const date = new Date(release.published_at).toLocaleDateString();

				return (
					<div key={release.tag_name} className="border border-dash-border rounded-lg">
						<button
							type="button"
							onClick={() => setExpandedTag(isExpanded ? null : release.tag_name)}
							className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-dash-surface-hover transition-colors rounded-lg"
						>
							<span className="text-xs font-mono bg-dash-accent/10 text-dash-accent px-2 py-0.5 rounded">
								{release.tag_name}
							</span>
							<span className="text-sm font-medium text-dash-text truncate flex-1">
								{release.name || release.tag_name}
							</span>
							<span className="text-xs text-dash-text-muted shrink-0">{date}</span>
							<svg
								className={`w-4 h-4 text-dash-text-muted transition-transform ${
									isExpanded ? "rotate-180" : ""
								}`}
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2}
							>
								<path d="M19 9l-7 7-7-7" />
							</svg>
						</button>

						{isExpanded && release.body && (
							<div className="px-4 pb-3 border-t border-dash-border/50">
								<pre className="text-xs text-dash-text-secondary whitespace-pre-wrap mt-2 max-h-60 overflow-y-auto">
									{release.body}
								</pre>
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
};

export default KitChangelogSection;
