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
		<div className="bg-dash-bg border border-dash-border rounded-lg p-5">
			<h3 className="text-base font-bold text-dash-text mb-3">{t("environment")}</h3>
			<div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
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
	<div>
		<span className="text-dash-text-muted text-xs">{label}: </span>
		<span className={`text-dash-text-secondary ${mono ? "mono" : ""}`}>{value}</span>
	</div>
);

export default SystemEnvironmentCard;
