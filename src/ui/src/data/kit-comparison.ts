/**
 * Kit comparison data structures for onboarding and feature comparison
 * Uses translation keys for all user-facing strings
 */

export type KitType = "engineer" | "marketing";

export interface KitFeature {
	id: string;
	name: string; // Translation key: e.g., "featureAgents"
	description: string; // Translation key
	engineer: boolean;
	marketing: boolean;
}

export interface KitComparison {
	id: KitType;
	name: string; // Translation key
	tagline: string; // Translation key
	primaryColor: string; // Tailwind color class
	features: string[]; // Feature IDs included
}

export const KIT_FEATURES: KitFeature[] = [
	{
		id: "agents",
		name: "featureAgents",
		description: "featureAgentsDesc",
		engineer: true,
		marketing: true,
	},
	{
		id: "hooks",
		name: "featureHooks",
		description: "featureHooksDesc",
		engineer: true,
		marketing: true,
	},
	{
		id: "skills",
		name: "featureSkills",
		description: "featureSkillsDesc",
		engineer: true,
		marketing: true,
	},
	{
		id: "multiagent",
		name: "featureMultiAgent",
		description: "featureMultiAgentDesc",
		engineer: true,
		marketing: false,
	},
	{
		id: "content",
		name: "featureContent",
		description: "featureContentDesc",
		engineer: false,
		marketing: true,
	},
	{
		id: "social",
		name: "featureSocial",
		description: "featureSocialDesc",
		engineer: false,
		marketing: true,
	},
];

export const KIT_COMPARISONS: Record<KitType, KitComparison> = {
	engineer: {
		id: "engineer",
		name: "kitEngineerName",
		tagline: "kitEngineerTagline",
		primaryColor: "text-blue-500",
		features: ["agents", "hooks", "skills", "multiagent"],
	},
	marketing: {
		id: "marketing",
		name: "kitMarketingName",
		tagline: "kitMarketingTagline",
		primaryColor: "text-purple-500",
		features: ["agents", "hooks", "skills", "content", "social"],
	},
};

export function getKitFeatures(kit: KitType): KitFeature[] {
	const comparison = KIT_COMPARISONS[kit];
	if (!comparison) {
		console.warn(`Unknown kit type: ${kit}`);
		return [];
	}
	return KIT_FEATURES.filter((f) => comparison.features.includes(f.id));
}
