import { useEffect, useState } from "react";
import { useI18n } from "../../i18n";
import type { HeatmapData } from "../../types/plan-types";
import HeatmapGrid from "./HeatmapGrid";

export default function HeatmapPanel({
	planDir,
	projectId,
}: {
	planDir: string;
	projectId?: string | null;
}) {
	const { t } = useI18n();
	const [source, setSource] = useState<HeatmapData["source"]>("both");
	const [data, setData] = useState<HeatmapData | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		async function load() {
			setError(null);
			try {
				const params = new URLSearchParams({
					dir: planDir,
					source,
				});
				if (projectId) {
					params.set("projectId", projectId);
				}
				const response = await fetch(`/api/plan/heatmap?${params.toString()}`);
				if (!response.ok) {
					throw new Error(t("plansHeatmapLoadError"));
				}
				const next = (await response.json()) as HeatmapData;
				if (!cancelled) setData(next);
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : t("plansHeatmapLoadError"));
				}
			}
		}
		void load();
		return () => {
			cancelled = true;
		};
	}, [planDir, projectId, source, t]);

	return (
		<section className="rounded-xl border border-dash-border bg-dash-surface p-5">
			<div className="mb-4 flex items-center justify-between gap-3">
				<div>
					<h2 className="text-lg font-semibold text-dash-text">{t("plansActivity")}</h2>
					<p className="text-sm text-dash-text-muted">{t("plansActivitySubtitle")}</p>
				</div>
				<select
					value={source}
					onChange={(event) => setSource(event.target.value as HeatmapData["source"])}
					className="rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-text"
				>
					<option value="both">{t("plansActivityCombined")}</option>
					<option value="git">{t("plansActivityCommits")}</option>
					<option value="mtime">{t("plansActivityFiles")}</option>
				</select>
			</div>
			{data?.cells?.length ? (
				<HeatmapGrid cells={data.cells} />
			) : (
				<p className="text-sm text-dash-text-muted">
					{error ?? data?.error ?? t("plansActivityEmpty")}
				</p>
			)}
		</section>
	);
}
