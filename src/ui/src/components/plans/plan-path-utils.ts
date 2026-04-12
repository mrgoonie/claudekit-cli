export function toRelativePlanPath(filePath: string, planDir: string): string {
	const normalizedPlanDir = planDir.replace(/\\/g, "/").replace(/\/$/, "");
	const normalizedFile = filePath.replace(/\\/g, "/");
	if (normalizedFile.startsWith(`${normalizedPlanDir}/`)) {
		return normalizedFile.slice(normalizedPlanDir.length + 1);
	}
	return normalizedFile.split("/").slice(-1)[0] ?? normalizedFile;
}

export function encodePlanPath(path: string): string {
	return path
		.split("/")
		.filter(Boolean)
		.map((segment) => encodeURIComponent(segment))
		.join("/");
}
