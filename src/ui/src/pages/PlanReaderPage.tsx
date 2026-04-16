import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import DesktopModeNotice from "../components/desktop-mode-notice";
import MarkdownRenderer from "../components/markdown-renderer";
import ReaderHeader from "../components/plans/ReaderHeader";
import ReaderTOC from "../components/plans/ReaderTOC";
import { encodePlanPath } from "../components/plans/plan-path-utils";
import { usePlanNavigation } from "../hooks/use-plan-navigation";
import { isTauri } from "../hooks/use-tauri";
import { useI18n } from "../i18n";
import type { PlanFileResponse } from "../types/plan-types";

function PlanReaderPageContent() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const { planSlug = "*", "*": phasePath } = useParams();
	const [searchParams] = useSearchParams();
	const rootDir = searchParams.get("dir") ?? "plans";
	const projectId = searchParams.get("projectId");
	const origin = searchParams.get("origin");
	const navigation = usePlanNavigation(rootDir, planSlug, phasePath, projectId);
	const [data, setData] = useState<PlanFileResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const phaseTitle =
		(navigation.currentIndex >= 0
			? (navigation.phases[navigation.currentIndex]?.name ?? null)
			: null) ?? (typeof data?.frontmatter.title === "string" ? data.frontmatter.title : null);

	const load = useCallback(async () => {
		setError(null);
		try {
			const planDir = `${rootDir}/${planSlug}`;
			const file = phasePath ? `${planDir}/${phasePath}` : `${planDir}/plan.md`;
			const params = new URLSearchParams({ file, dir: planDir });
			if (projectId) params.set("projectId", projectId);
			const response = await fetch(`/api/plan/file?${params.toString()}`);
			if (!response.ok) {
				throw new Error(t("plansLoadFileFailed").replace("{status}", String(response.status)));
			}
			setData((await response.json()) as PlanFileResponse);
		} catch (err) {
			setError(err instanceof Error ? err.message : t("plansLoadFileFallback"));
		}
	}, [phasePath, planSlug, projectId, rootDir, t]);

	useEffect(() => {
		void load();
	}, [load]);

	const goToFile = (file: string) =>
		navigate(
			`/plans/${encodeURIComponent(planSlug)}/read/${encodePlanPath(file)}?dir=${encodeURIComponent(rootDir)}${
				projectId ? `&projectId=${encodeURIComponent(projectId)}` : ""
			}${origin ? `&origin=${encodeURIComponent(origin)}` : ""}`,
		);

	return (
		<div className="flex h-full flex-col gap-4 overflow-auto">
			<ReaderHeader
				planTitle={navigation.planTitle}
				phaseTitle={phaseTitle}
				prev={navigation.prev}
				next={navigation.next}
				onBack={() =>
					navigate(
						`/plans/${encodeURIComponent(planSlug)}?dir=${encodeURIComponent(rootDir)}${
							projectId ? `&projectId=${encodeURIComponent(projectId)}` : ""
						}${origin ? `&origin=${encodeURIComponent(origin)}` : ""}`,
					)
				}
				onNavigate={goToFile}
			/>
			{error && <p className="text-sm text-red-300">{error}</p>}
			{data && (
				<div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
					<ReaderTOC content={data.content} />
					<div className="rounded-xl border border-dash-border bg-dash-surface p-5">
						<MarkdownRenderer content={data.raw} />
					</div>
				</div>
			)}
			{!data && !error && <p className="text-sm text-dash-text-muted">{t("plansLoadingReader")}</p>}
		</div>
	);
}

export default function PlanReaderPage() {
	if (isTauri()) {
		return (
			<DesktopModeNotice
				titleKey="desktopModePlanReaderTitle"
				descriptionKey="desktopModePlanReaderDescription"
				commandHintKey="desktopModePlanReaderHint"
			/>
		);
	}

	return <PlanReaderPageContent />;
}
