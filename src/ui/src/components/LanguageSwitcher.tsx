import type React from "react";
import { useI18n } from "../i18n";

const LanguageSwitcher: React.FC = () => {
	const { lang, setLang } = useI18n();

	return (
		<button
			onClick={() => setLang(lang === "en" ? "vi" : "en")}
			className="px-2 py-1 text-xs font-medium rounded-lg flex items-center gap-1.5 text-dash-text-secondary hover:bg-dash-surface-hover transition-colors border border-transparent hover:border-dash-border"
			title={lang === "en" ? "Chuyển sang tiếng Việt" : "Switch to English"}
		>
			{lang === "en" ? (
				<>
					<span>🇻🇳</span>
					<span className="hidden sm:inline">VI</span>
				</>
			) : (
				<>
					<span>🇺🇸</span>
					<span className="hidden sm:inline">EN</span>
				</>
			)}
		</button>
	);
};

export default LanguageSwitcher;
