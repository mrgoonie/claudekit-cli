/**
 * React context for i18n with browser detection and localStorage persistence
 */
import { type ReactNode, createContext, useContext, useState } from "react";
import { type Language, type TranslationKey, translations } from "./translations";

interface I18nContextType {
	lang: Language;
	setLang: (lang: Language) => void;
	t: (key: TranslationKey) => string;
}

export const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_KEY = "ck-dashboard-lang";

function detectLanguage(): Language {
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === "en" || stored === "vi") return stored;
	return navigator.language.startsWith("vi") ? "vi" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
	const [lang, setLangState] = useState<Language>(detectLanguage);

	const setLang = (newLang: Language) => {
		localStorage.setItem(STORAGE_KEY, newLang);
		setLangState(newLang);
	};

	const t = (key: TranslationKey): string => translations[lang][key];

	return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
	const ctx = useContext(I18nContext);
	if (!ctx) throw new Error("useI18n must be used within I18nProvider");
	return ctx;
}
