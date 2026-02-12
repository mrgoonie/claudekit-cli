/**
 * SystemEnvironmentCard - Environment info card (config path, runtime versions, OS)
 */
import type React from "react";
import { useI18n } from "../i18n";

interface SystemEnvironmentCardProps {
	configPath: string;
	nodeVersion: string;
	bunVersion: string | null;
	os: string;
}

const SystemEnvironmentCard: React.FC<SystemEnvironmentCardProps> = ({
	configPath,
	nodeVersion,
	bunVersion,
	os,
}) => {
	const { t } = useI18n();

	return (
		<div className="dash-panel p-5">
			<h3 className="text-sm font-semibold uppercase tracking-wide text-dash-text mb-3">
				{t("environment")}
			</h3>
			<div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
				<InfoItem label={t("claudeConfigPath")} value={configPath} mono />
				<InfoItem label={t("osVersion")} value={os} />
				<InfoItem label={t("nodeVersion")} value={nodeVersion} mono />
				{bunVersion && <InfoItem label={t("bunVersion")} value={bunVersion} mono />}
			</div>
		</div>
	);
};

const InfoItem: React.FC<{ label: string; value: string; mono?: boolean }> = ({
	label,
	value,
	mono,
}) => (
	<div className="rounded-lg border border-dash-border bg-dash-bg/70 p-2.5">
		<p className="text-dash-text-muted text-[11px] uppercase tracking-wide mb-1">{label}</p>
		<p className={`text-dash-text-secondary break-all ${mono ? "mono text-xs" : "text-sm"}`}>{value}</p>
	</div>
);

export default SystemEnvironmentCard;
