import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import MarkdownRenderer from "../components/markdown-renderer";
import ReaderHeader from "../components/plans/ReaderHeader";
import ReaderTOC from "../components/plans/ReaderTOC";
import { encodePlanPath } from "../components/plans/plan-path-utils";
import { usePlanNavigation } from "../hooks/use-plan-navigation";
import { useI18n } from "../i18n";
import type { PlanFileResponse } from "../types/plan-types";

export default function PlanReaderPage() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const { planSlug = "*", "*": phasePath } = useParams();
	const [searchParams] = useSearchParams();
	const rootDir = searchParams.get("dir") ?? "plans";
	const navigation = usePlanNavigation(rootDir, planSlug, phasePath);
	const [data, setData] = useState<PlanFileResponse | null>(null);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			const planDir = `${rootDir}/${planSlug}`;
			const file = phasePath ? `${planDir}/${phasePath}` : `${planDir}/plan.md`;
			const response = await fetch(
				`/api/plan/file?file=${encodeURIComponent(file)}&dir=${encodeURIComponent(planDir)}`,
			);
			if (!response.ok) throw new Error(`Failed to load file (${response.status})`);
			setData((await response.json()) as PlanFileResponse);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load file");
		}
	}, [phasePath, planSlug, rootDir]);

	useEffect(() => {
		void load();
	}, [load]);

	const goToFile = (file: string) =>
		navigate(
			`/plans/${encodeURIComponent(planSlug)}/read/${encodePlanPath(file)}?dir=${encodeURIComponent(rootDir)}`,
		);

	return (
		<div className="flex h-full flex-col gap-4 overflow-auto">
			<ReaderHeader
				planTitle={navigation.planTitle}
				phaseTitle={phasePath ?? null}
				prev={navigation.prev}
				next={navigation.next}
				onBack={() =>
					navigate(`/plans/${encodeURIComponent(planSlug)}?dir=${encodeURIComponent(rootDir)}`)
				}
				onNavigate={goToFile}
			/>
			{error && <p className="text-sm text-red-300">{error}</p>}
			{data && (
				<div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
					<ReaderTOC content={data.raw} />
					<div className="rounded-xl border border-dash-border bg-dash-surface p-5">
						<MarkdownRenderer content={data.raw} />
					</div>
				</div>
			)}
			{!data && !error && <p className="text-sm text-dash-text-muted">{t("plansLoadingReader")}</p>}
		</div>
	);
}
