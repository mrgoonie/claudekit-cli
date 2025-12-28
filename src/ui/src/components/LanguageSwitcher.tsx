import type React from "react";
import { useI18n } from "../i18n";

/**
 * Language toggle showing both options with current highlighted
 * Pattern: [EN] VI or EN [VI] - user always knows current and target
 */
const LanguageSwitcher: React.FC = () => {
	const { lang, setLang } = useI18n();

	return (
		<div className="flex items-center rounded-lg border border-dash-border overflow-hidden">
			<button
				onClick={() => setLang("en")}
				className={`px-2 py-1 text-xs font-medium transition-colors ${
					lang === "en"
						? "bg-dash-accent text-dash-bg"
						: "text-dash-text-muted hover:bg-dash-surface-hover"
				}`}
				title="English"
			>
				EN
			</button>
			<button
				onClick={() => setLang("vi")}
				className={`px-2 py-1 text-xs font-medium transition-colors ${
					lang === "vi"
						? "bg-dash-accent text-dash-bg"
						: "text-dash-text-muted hover:bg-dash-surface-hover"
				}`}
				title="Tiếng Việt"
			>
				VI
			</button>
		</div>
	);
};

export default LanguageSwitcher;
