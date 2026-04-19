import { z } from "zod";

export const DesktopPlatformKeySchema = z.enum([
	"darwin-aarch64",
	"darwin-x86_64",
	"linux-x86_64",
	"windows-x86_64",
]);
export type DesktopPlatformKey = z.infer<typeof DesktopPlatformKeySchema>;

export const DesktopAssetTypeSchema = z.enum(["app-zip", "appimage", "portable-exe"]);
export type DesktopAssetType = z.infer<typeof DesktopAssetTypeSchema>;

export const DesktopPlatformAssetSchema = z.object({
	name: z.string().min(1),
	url: z
		.string()
		.url()
		.refine((value) => value.startsWith("https://"), {
			message: "Desktop asset URLs must use HTTPS",
		}),
	size: z.number().int().nonnegative(),
	assetType: DesktopAssetTypeSchema,
});
export type DesktopPlatformAsset = z.infer<typeof DesktopPlatformAssetSchema>;

export const DesktopReleaseManifestSchema = z.object({
	version: z.string().min(1),
	date: z.string().min(1),
	platforms: z.object({
		"darwin-aarch64": DesktopPlatformAssetSchema,
		"darwin-x86_64": DesktopPlatformAssetSchema,
		"linux-x86_64": DesktopPlatformAssetSchema,
		"windows-x86_64": DesktopPlatformAssetSchema,
	}),
	channel: z.enum(["stable", "dev"]).default("stable"),
});
export type DesktopReleaseManifest = z.infer<typeof DesktopReleaseManifestSchema>;

export const DesktopInstallMetadataSchema = z.object({
	version: z.string().min(1),
	manifestDate: z.string().min(1),
	channel: z.enum(["stable", "dev"]),
	platformKey: DesktopPlatformKeySchema,
	assetName: z.string().min(1),
	assetSize: z.number().int().nonnegative(),
	installedAt: z.string().min(1),
});
export type DesktopInstallMetadata = z.infer<typeof DesktopInstallMetadataSchema>;
