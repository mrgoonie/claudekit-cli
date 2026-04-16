import type React from "react";
import { useI18n } from "../i18n";
import type { TranslationKey } from "../i18n";

interface DesktopModeNoticeProps {
	titleKey: TranslationKey;
	descriptionKey: TranslationKey;
	commandHintKey?: TranslationKey;
}

const DesktopModeNotice: React.FC<DesktopModeNoticeProps> = ({
	titleKey,
	descriptionKey,
	commandHintKey,
}) => {
	const { t } = useI18n();

	return (
		<div className="flex h-full items-center justify-center">
			<div className="max-w-xl rounded-2xl border border-dash-border bg-dash-surface p-8 text-center shadow-sm">
				<p className="text-[10px] font-bold uppercase tracking-[0.2em] text-dash-accent">
					{t("desktopModeLabel")}
				</p>
				<h2 className="mt-3 text-xl font-semibold text-dash-text">{t(titleKey)}</h2>
				<p className="mt-3 text-sm leading-relaxed text-dash-text-muted">{t(descriptionKey)}</p>
				{commandHintKey && (
					<p className="mt-4 rounded-lg border border-dash-border bg-dash-bg px-4 py-3 text-xs font-medium text-dash-text">
						{t(commandHintKey)}
					</p>
				)}
			</div>
		</div>
	);
};

export default DesktopModeNotice;
