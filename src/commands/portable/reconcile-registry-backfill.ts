import { addPortableInstallation } from "./portable-registry.js";
import type { PortableRegistryV3 } from "./portable-registry.js";
import { isUnknownChecksum } from "./reconcile-types.js";
import type { ReconcileAction } from "./reconcile-types.js";
import type { ProviderType } from "./types.js";

function shouldBackfillRegistry(action: ReconcileAction): boolean {
	return (
		action.action === "skip" &&
		action.backfillRegistry === true &&
		typeof action.targetPath === "string" &&
		action.targetPath.length > 0 &&
		typeof action.sourceChecksum === "string" &&
		!isUnknownChecksum(action.sourceChecksum) &&
		typeof action.currentTargetChecksum === "string" &&
		!isUnknownChecksum(action.currentTargetChecksum)
	);
}

export async function backfillRegistryChecksums(
	actions: ReconcileAction[],
	registry: PortableRegistryV3,
): Promise<void> {
	for (const action of actions) {
		if (!shouldBackfillRegistry(action)) continue;

		const registryEntry = registry.installations.find(
			(entry) =>
				entry.item === action.item &&
				entry.type === action.type &&
				entry.provider === action.provider &&
				entry.global === action.global,
		);
		if (!registryEntry) continue;

		await addPortableInstallation(
			action.item,
			action.type,
			action.provider as ProviderType,
			action.global,
			action.targetPath,
			registryEntry.sourcePath,
			{
				sourceChecksum: action.sourceChecksum,
				targetChecksum: action.currentTargetChecksum,
				ownedSections: registryEntry.ownedSections,
				installSource: registryEntry.installSource === "manual" ? "manual" : "kit",
			},
		);
	}
}
