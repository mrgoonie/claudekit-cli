/**
 * Multi-step installation wizard for ClaudeKit projects
 * Guides users through kit selection, configuration, and installation
 */
import type React from "react";
import { useState } from "react";
import { useI18n } from "../i18n";
import { KitType } from "../types";

interface InstallWizardProps {
	selectedKit: KitType | null;
	onKitSelect: (kit: KitType) => void;
	onInstall: () => void;
	installing: boolean;
}

const InstallWizard: React.FC<InstallWizardProps> = ({
	selectedKit,
	onKitSelect,
	onInstall,
	installing,
}) => {
	const { t } = useI18n();
	const [step, setStep] = useState<1 | 2 | 3>(1);

	return (
		<div className="space-y-6" data-testid="install-wizard">
			{/* Step indicator */}
			<div className="flex items-center gap-4">
				<StepIndicator number={1} active={step === 1} label={t("stepChooseKit")} />
				<div className="flex-1 h-px bg-[var(--dash-border)]" />
				<StepIndicator number={2} active={step === 2} label={t("stepConfigure")} />
				<div className="flex-1 h-px bg-[var(--dash-border)]" />
				<StepIndicator number={3} active={step === 3} label={t("stepInstall")} />
			</div>

			{/* Step content */}
			<div className="min-h-[200px]">
				{step === 1 && <KitSelection onSelect={onKitSelect} selected={selectedKit} />}
				{step === 2 && selectedKit && <ConfigPreview kit={selectedKit} />}
				{step === 3 && <InstallProgress installing={installing} />}
			</div>

			{/* Navigation */}
			<div className="flex justify-between pt-4 border-t border-[var(--dash-border)]">
				{step > 1 ? (
					<button
						onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
						className="px-4 py-2 text-sm font-medium text-[var(--dash-text)] bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-lg hover:bg-[var(--dash-surface-hover)] transition-colors"
						data-testid="wizard-back"
					>
						{t("back")}
					</button>
				) : (
					<div />
				)}
				{step < 3 && selectedKit && (
					<button
						onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
						className="px-4 py-2 text-sm font-medium text-white bg-[var(--dash-accent)] rounded-lg hover:opacity-90 transition-opacity"
						data-testid="wizard-next"
					>
						{t("next")}
					</button>
				)}
				{step === 3 && (
					<button
						onClick={onInstall}
						disabled={installing}
						className="px-4 py-2 text-sm font-medium text-white bg-[var(--dash-accent)] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
						data-testid="wizard-install"
					>
						{t("install")}
					</button>
				)}
			</div>
		</div>
	);
};

// Sub-component: Step indicator
interface StepIndicatorProps {
	number: number;
	active: boolean;
	label: string;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ number, active, label }) => (
	<div className="flex items-center gap-2">
		<div
			className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
				active
					? "bg-[var(--dash-accent)] text-white"
					: "bg-[var(--dash-surface)] text-[var(--dash-text-muted)] border border-[var(--dash-border)]"
			}`}
		>
			{number}
		</div>
		<span
			className={`text-sm font-medium ${
				active ? "text-[var(--dash-text)]" : "text-[var(--dash-text-muted)]"
			}`}
		>
			{label}
		</span>
	</div>
);

// Sub-component: Kit selection step
const KitSelection: React.FC<{
	onSelect: (kit: KitType) => void;
	selected: KitType | null;
}> = ({ onSelect, selected }) => {
	const { t } = useI18n();
	return (
		<div className="space-y-4">
			<p className="text-[var(--dash-text-muted)]">
				{selected
					? `Selected: ${selected === KitType.ENGINEER ? t("kitEngineerName") : t("kitMarketingName")}`
					: "Please select a kit above"}
			</p>
			{selected && (
				<button
					type="button"
					onClick={() =>
						onSelect(selected === KitType.ENGINEER ? KitType.MARKETING : KitType.ENGINEER)
					}
					className="text-sm text-[var(--dash-accent)] hover:underline"
				>
					Switch to {selected === KitType.ENGINEER ? t("kitMarketingName") : t("kitEngineerName")}
				</button>
			)}
		</div>
	);
};

const ConfigPreview: React.FC<{ kit: KitType }> = () => (
	<div className="text-[var(--dash-text-muted)]">Configuration preview placeholder</div>
);

const InstallProgress: React.FC<{ installing: boolean }> = ({ installing }) => (
	<div className="text-[var(--dash-text-muted)]">
		{installing ? "Installing..." : "Ready to install"}
	</div>
);

export default InstallWizard;
