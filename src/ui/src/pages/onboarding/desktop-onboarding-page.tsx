import type React from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n";
import * as tauri from "../../lib/tauri-commands";
import { addProject } from "../../services/api";
import { setDesktopOnboardingCompleted } from "../../services/desktop-onboarding-state";
import { buildDesktopScanRoots, dedupeDiscoveredProjects } from "./desktop-onboarding-utils";
import DesktopProjectSelectionList from "./desktop-project-selection-list";

type Step = "welcome" | "discovering" | "selection" | "done";

const SCAN_DEPTH = 3;

const DesktopOnboardingPage: React.FC = () => {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [step, setStep] = useState<Step>("welcome");
	const [projects, setProjects] = useState<tauri.ProjectInfo[]>([]);
	const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [targetProjectId, setTargetProjectId] = useState<string | null>(null);

	const selectedCount = selectedPaths.size;
	const discoveredCount = projects.length;
	const finishTarget = useMemo(
		() => (targetProjectId ? `/project/${targetProjectId}` : "/"),
		[targetProjectId],
	);

	const togglePath = (path: string) => {
		setSelectedPaths((current) => {
			const next = new Set(current);
			if (next.has(path)) {
				next.delete(path);
			} else {
				next.add(path);
			}
			return next;
		});
	};

	const startDiscovery = async () => {
		setError(null);
		setStep("discovering");

		try {
			const globalConfigDir = await tauri.getGlobalConfigDir();
			const roots = buildDesktopScanRoots(globalConfigDir);
			const scanned = await Promise.allSettled(
				roots.map((root) => tauri.scanForProjects(root, SCAN_DEPTH)),
			);
			const discovered = dedupeDiscoveredProjects(
				scanned.flatMap((result) => (result.status === "fulfilled" ? result.value : [])),
			);

			setProjects(discovered);
			setSelectedPaths(new Set(discovered.map((project) => project.path)));
			setStep("selection");
		} catch (scanError) {
			setError(scanError instanceof Error ? scanError.message : t("desktopOnboardingScanFailed"));
			setStep("selection");
		}
	};

	const completeOnboarding = async (paths: string[]) => {
		setSaving(true);
		setError(null);

		try {
			const results = await Promise.allSettled(paths.map((path) => addProject({ path })));
			const added = results.flatMap((result) =>
				result.status === "fulfilled" ? [result.value] : [],
			);
			if (paths.length > 0 && added.length === 0) {
				throw new Error(t("desktopOnboardingAddFailed"));
			}

			await setDesktopOnboardingCompleted(true);
			setTargetProjectId(added[0]?.id ?? null);
			setStep("done");
		} catch (saveError) {
			setError(saveError instanceof Error ? saveError.message : t("desktopOnboardingAddFailed"));
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="mx-auto flex h-full w-full max-w-4xl flex-col justify-center px-4 py-8">
			<div className="rounded-[2rem] border border-dash-border bg-dash-surface p-8 shadow-sm">
				<div className="mb-8 text-center">
					<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-dash-accent-subtle text-3xl">
						CK
					</div>
					<p className="mt-4 text-[10px] font-bold uppercase tracking-[0.3em] text-dash-accent">
						{t("desktopOnboardingEyebrow")}
					</p>
					<h1 className="mt-3 text-3xl font-bold text-dash-text">{t("desktopOnboardingTitle")}</h1>
					<p className="mt-3 text-sm leading-relaxed text-dash-text-muted">
						{step === "done"
							? t("desktopOnboardingDoneDescription")
							: t("desktopOnboardingDescription")}
					</p>
				</div>

				{error ? (
					<div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
						{error}
					</div>
				) : null}

				{step === "welcome" ? (
					<div className="space-y-6 text-center">
						<p className="text-sm text-dash-text-muted">{t("desktopOnboardingWelcomeBody")}</p>
						<button
							type="button"
							onClick={() => void startDiscovery()}
							className="rounded-xl bg-dash-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-dash-accent/90"
						>
							{t("desktopOnboardingStart")}
						</button>
					</div>
				) : null}

				{step === "discovering" ? (
					<div className="space-y-4 text-center">
						<div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-dash-accent border-t-transparent" />
						<p className="text-sm font-medium text-dash-text">{t("desktopOnboardingScanning")}</p>
						<p className="text-xs text-dash-text-muted">{t("desktopOnboardingScanningHint")}</p>
					</div>
				) : null}

				{step === "selection" ? (
					<div className="space-y-6">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<h2 className="text-lg font-semibold text-dash-text">
									{t("desktopOnboardingSelectTitle")}
								</h2>
								<p className="mt-1 text-sm text-dash-text-muted">
									{discoveredCount > 0
										? t("desktopOnboardingSelectDescription")
										: t("desktopOnboardingNoProjects")}
								</p>
							</div>
							<span className="rounded-full border border-dash-border px-3 py-1 text-xs font-semibold text-dash-text-secondary">
								{t("desktopOnboardingSelectedCount").replace("{count}", String(selectedCount))}
							</span>
						</div>

						{discoveredCount > 0 ? (
							<DesktopProjectSelectionList
								projects={projects}
								selectedPaths={selectedPaths}
								onToggle={togglePath}
							/>
						) : null}

						<div className="flex flex-wrap justify-end gap-3">
							<button
								type="button"
								onClick={() => void completeOnboarding([])}
								className="rounded-xl border border-dash-border px-4 py-2 text-sm font-medium text-dash-text-secondary transition hover:bg-dash-bg"
							>
								{t("desktopOnboardingSkip")}
							</button>
							<button
								type="button"
								onClick={() => void completeOnboarding(Array.from(selectedPaths))}
								disabled={saving || (discoveredCount > 0 && selectedCount === 0)}
								className="rounded-xl bg-dash-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-dash-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{saving ? t("desktopOnboardingSaving") : t("desktopOnboardingContinue")}
							</button>
						</div>
					</div>
				) : null}

				{step === "done" ? (
					<div className="space-y-4 text-center">
						<p className="text-lg font-semibold text-dash-text">
							{t("desktopOnboardingDoneTitle")}
						</p>
						<button
							type="button"
							onClick={() => navigate(finishTarget, { replace: true })}
							className="rounded-xl bg-dash-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-dash-accent/90"
						>
							{t("desktopOnboardingOpenDashboard")}
						</button>
					</div>
				) : null}
			</div>
		</div>
	);
};

export default DesktopOnboardingPage;
