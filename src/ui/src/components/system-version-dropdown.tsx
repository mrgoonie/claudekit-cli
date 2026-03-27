/**
 * SystemVersionDropdown - Version picker for CLI/Kit updates
 * Fetches available versions, displays dropdown with latest/prerelease badges
 */
import type React from "react";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n";

interface VersionInfo {
	version: string;
	publishedAt: string;
	isPrerelease: boolean;
}

interface SystemVersionDropdownProps {
	target: "cli" | "kit";
	kitName?: string;
	currentVersion: string;
	latestVersion: string;
	onVersionSelect: (version: string) => void;
}

const SystemVersionDropdown: React.FC<SystemVersionDropdownProps> = ({
	target,
	kitName,
	currentVersion,
	latestVersion,
	onVersionSelect,
}) => {
	const { t } = useI18n();
	const [versions, setVersions] = useState<VersionInfo[]>([]);
	const [loading, setLoading] = useState(false);
	const [selectedVersion, setSelectedVersion] = useState(latestVersion);

	useEffect(() => {
		const fetchVersions = async () => {
			setLoading(true);
			try {
				const params = new URLSearchParams({ target });
				if (kitName) params.set("kit", kitName);

				const res = await fetch(`/api/system/versions?${params}`);
				const data = await res.json();
				if (data.versions) {
					setVersions(data.versions);
				}
			} catch (error) {
				console.error("Failed to fetch versions:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchVersions();
	}, [target, kitName]);

	const handleVersionChange = (version: string) => {
		setSelectedVersion(version);
		onVersionSelect(version);
	};

	if (loading) {
		return (
			<span className="text-xs text-dash-text-muted flex items-center gap-1.5">
				<span className="w-3 h-3 border-2 border-dash-text-muted border-t-transparent rounded-full animate-spin" />
				{t("loadingVersions")}
			</span>
		);
	}

	return (
		<select
			value={selectedVersion}
			onChange={(e) => handleVersionChange(e.target.value)}
			className="text-xs text-amber-500 hover:text-amber-600 font-medium transition-colors
				bg-transparent border border-amber-500/30 rounded px-2 py-1
				focus:outline-none focus:ring-2 focus:ring-amber-500/50
				cursor-pointer appearance-none"
			title={t("selectVersion")}
		>
			{versions.map((ver) => {
				const isLatest = ver.version === latestVersion;
				const isCurrent = ver.version === currentVersion;
				const label = `v${ver.version.replace(/^v/, "")}${isLatest ? ` (${t("latestVersion")})` : ""}${
					ver.isPrerelease ? ` [${t("prereleaseLabel")}]` : ""
				}${isCurrent ? ` - ${t("currentVersionLabel")}` : ""}`;

				return (
					<option key={ver.version} value={ver.version} disabled={isCurrent}>
						{label}
					</option>
				);
			})}
		</select>
	);
};

export default SystemVersionDropdown;
