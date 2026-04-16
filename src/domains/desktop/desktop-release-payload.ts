import { type GitHubRelease, GitHubReleaseSchema } from "@/types";

export function parseDesktopReleasePayload(input: unknown): GitHubRelease {
	const payload = GitHubReleaseSchema.parse(input);
	if (payload.assets.length === 0) {
		throw new Error("Desktop release payload contains no assets");
	}
	return payload;
}
