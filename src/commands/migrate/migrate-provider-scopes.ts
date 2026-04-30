import { providers } from "../portable/provider-registry.js";
export { providerConfigAppliesToType } from "../portable/reconcile-types.js";
import type { ReconcileAction, ReconcileProviderInput } from "../portable/reconcile-types.js";
import type { ProviderType } from "../portable/types.js";
import type { MigrationScope } from "./migrate-scope-resolver.js";

export type PortableGroup = "agents" | "commands" | "skills" | "config" | "rules" | "hooks";
export type ReconcilePortableType = ReconcileAction["type"];

export const RECONCILE_PORTABLE_TYPES: ReconcilePortableType[] = [
	"agent",
	"command",
	"skill",
	"config",
	"rules",
	"hooks",
];

const TYPE_TO_GROUP: Record<ReconcilePortableType, PortableGroup> = {
	agent: "agents",
	command: "commands",
	skill: "skills",
	config: "config",
	rules: "rules",
	hooks: "hooks",
};

const GROUP_TO_TYPE: Record<PortableGroup, ReconcilePortableType> = {
	agents: "agent",
	commands: "command",
	skills: "skill",
	config: "config",
	rules: "rules",
	hooks: "hooks",
};

export function portableTypeToGroup(type: ReconcilePortableType): PortableGroup {
	return TYPE_TO_GROUP[type];
}

export function portableGroupToType(group: PortableGroup): ReconcilePortableType {
	return GROUP_TO_TYPE[group];
}

export function getEnabledPortableTypes(include: MigrationScope): ReconcilePortableType[] {
	return RECONCILE_PORTABLE_TYPES.filter((type) => include[portableTypeToGroup(type)]);
}

export function resolvePortableTypeGlobal(
	provider: ProviderType,
	type: ReconcilePortableType,
	requestedGlobal: boolean,
): boolean {
	if (requestedGlobal) return true;

	const providerConfig = providers[provider];
	const group = portableTypeToGroup(type);
	const pathConfig = providerConfig?.[group];
	if (pathConfig?.projectPath === null && pathConfig.globalPath !== null) {
		return true;
	}

	return false;
}

export function resolvePortableGroupGlobal(
	provider: ProviderType,
	group: PortableGroup,
	requestedGlobal: boolean,
): boolean {
	return resolvePortableTypeGlobal(provider, portableGroupToType(group), requestedGlobal);
}

export function buildScopedProviderConfigs(
	selectedProviders: ProviderType[],
	include: MigrationScope,
	requestedGlobal: boolean,
): ReconcileProviderInput[] {
	const enabledTypes = getEnabledPortableTypes(include);
	const configs: ReconcileProviderInput[] = [];

	for (const provider of selectedProviders) {
		const typesByScope = new Map<boolean, ReconcilePortableType[]>();
		for (const type of enabledTypes) {
			const isGlobal = resolvePortableTypeGlobal(provider, type, requestedGlobal);
			typesByScope.set(isGlobal, [...(typesByScope.get(isGlobal) ?? []), type]);
		}

		for (const [global, types] of typesByScope) {
			configs.push({ provider, global, types });
		}
	}

	return configs;
}
