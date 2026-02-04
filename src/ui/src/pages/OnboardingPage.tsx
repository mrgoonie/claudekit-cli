/**
 * Onboarding page - Kit selection and installation wizard for new users
 */
import type React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import FeaturePreviewCard from "../components/FeaturePreviewCard";
import InstallWizard from "../components/InstallWizard";
import SuccessScreen from "../components/SuccessScreen";
import { KIT_COMPARISONS, getKitFeatures } from "../data/kit-comparison";
import type { KitComparison as KitComparisonType, KitFeature } from "../data/kit-comparison";
import { useI18n } from "../i18n";
import type { TranslationKey } from "../i18n";
import { KitType } from "../types";

// Internal component for kit cards
interface KitCardProps {
	kit: KitComparisonType;
	selected: boolean;
	onSelect: () => void;
	features: KitFeature[];
}

const KitCard: React.FC<KitCardProps> = ({ kit, selected, onSelect, features }) => {
	const { t } = useI18n();
	return (
		<button
			type="button"
			onClick={onSelect}
			className={`p-6 rounded-lg border-2 text-left transition-all w-full ${
				selected
					? "border-[var(--dash-accent)] bg-[var(--dash-surface)] shadow-md"
					: "border-[var(--dash-border)] hover:border-[var(--dash-accent)]/50"
			}`}
		>
			<h3 className={`text-xl font-bold ${kit.primaryColor}`}>{t(kit.name as TranslationKey)}</h3>
			<p className="text-[var(--dash-text-muted)] mt-1">{t(kit.tagline as TranslationKey)}</p>
			<div className="mt-4 space-y-2">
				{features.slice(0, 3).map((f) => (
					<FeaturePreviewCard
						key={f.id}
						featureId={f.id}
						name={f.name as TranslationKey}
						description={f.description as TranslationKey}
						included={true}
					/>
				))}
			</div>
		</button>
	);
};

const OnboardingPage: React.FC = () => {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [selectedKit, setSelectedKit] = useState<KitType | null>(null);
	const [installing, setInstalling] = useState(false);
	const [installed, setInstalled] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleInstall = async () => {
		if (!selectedKit) return;
		setInstalling(true);
		setError(null);
		try {
			// API call to trigger install
			const response = await fetch("/api/install", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ kit: selectedKit }),
			});
			if (!response.ok) {
				throw new Error(`Installation failed: ${response.statusText}`);
			}
			setInstalled(true);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unknown error occurred";
			setError(message);
			console.error("Install failed:", err);
		} finally {
			setInstalling(false);
		}
	};

	if (installed && selectedKit) {
		return <SuccessScreen kit={selectedKit} onGetStarted={() => navigate("/")} />;
	}

	// Map string kit IDs to KitType enum
	const getKitTypeFromId = (id: string): KitType => {
		return id === "engineer" ? KitType.ENGINEER : KitType.MARKETING;
	};

	return (
		<div className="max-w-4xl mx-auto py-8 px-4">
			<header className="text-center mb-8">
				<h1 className="text-3xl font-bold text-[var(--dash-text)]">{t("onboardingTitle")}</h1>
				<p className="mt-2 text-[var(--dash-text-muted)]">{t("onboardingSubtitle")}</p>
			</header>

			{/* Kit comparison cards */}
			<section className="grid md:grid-cols-2 gap-6 mb-8">
				{Object.values(KIT_COMPARISONS).map((kit) => {
					const kitType = getKitTypeFromId(kit.id);
					return (
						<KitCard
							key={kit.id}
							kit={kit}
							selected={selectedKit === kitType}
							onSelect={() => setSelectedKit(kitType)}
							features={getKitFeatures(kit.id)}
						/>
					);
				})}
			</section>

			{/* Error message */}
			{error && (
				<div className="mb-6 p-4 rounded-lg bg-red-100 border border-red-300 text-red-800">
					<p className="font-medium">Installation Error</p>
					<p className="text-sm mt-1">{error}</p>
					<button
						type="button"
						onClick={() => setError(null)}
						className="mt-2 text-sm underline hover:no-underline"
					>
						Dismiss
					</button>
				</div>
			)}

			{/* Install wizard */}
			{selectedKit && (
				<InstallWizard
					selectedKit={selectedKit}
					onKitSelect={setSelectedKit}
					onInstall={handleInstall}
					installing={installing}
				/>
			)}
		</div>
	);
};

export default OnboardingPage;
