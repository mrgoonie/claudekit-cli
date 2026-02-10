/**
 * Detail panel for selected kit item — side panel on desktop, full overlay on mobile
 * Includes copy-to-clipboard buttons for file names and commands
 */
import type React from "react";
import { useCallback, useState } from "react";
import { useI18n } from "../../i18n";
import type { KitCategory } from "./kit-category-tabs";
import type { KitItem } from "./kit-item-list";

interface KitItemDetailProps {
	item: KitItem;
	category: KitCategory;
	onClose: () => void;
}

/** Inline copy button for mono fields */
const CopyField: React.FC<{ value: string }> = ({ value }) => {
	const { t } = useI18n();
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(() => {
		navigator.clipboard.writeText(value).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		});
	}, [value]);

	return (
		<div className="flex items-center gap-2 mt-1 bg-dash-bg rounded-md group">
			<code className="flex-1 text-sm text-dash-text font-mono px-2.5 py-1.5 truncate">
				{value}
			</code>
			<button
				type="button"
				onClick={handleCopy}
				className="shrink-0 p-1.5 text-dash-text-muted hover:text-dash-accent opacity-0 group-hover:opacity-100 transition-opacity"
				title={t("kitCopyToClipboard")}
			>
				{copied ? (
					<svg
						className="w-3.5 h-3.5 text-emerald-500"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
					>
						<polyline points="20 6 9 17 4 12" />
					</svg>
				) : (
					<svg
						className="w-3.5 h-3.5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
					>
						<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
						<path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
					</svg>
				)}
			</button>
		</div>
	);
};

/** Section label */
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
	<span className="text-[10px] font-semibold uppercase tracking-wider text-dash-text-muted">
		{children}
	</span>
);

const KitItemDetail: React.FC<KitItemDetailProps> = ({ item, category, onClose }) => {
	const { t } = useI18n();

	return (
		<div className="h-full border-l border-dash-border bg-dash-surface flex flex-col">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-dash-border shrink-0">
				{/* Back arrow on mobile, hidden on desktop */}
				<button
					type="button"
					onClick={onClose}
					className="md:hidden mr-2 text-dash-text-muted hover:text-dash-text transition-colors"
				>
					<svg
						className="w-5 h-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
					>
						<path d="M15 19l-7-7 7-7" />
					</svg>
				</button>
				<h3 className="text-sm font-semibold text-dash-text truncate flex-1">{item.name}</h3>
				<button
					type="button"
					onClick={onClose}
					className="hidden md:block text-dash-text-muted hover:text-dash-text transition-colors ml-2"
				>
					<svg className="w-4 h-4 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2}>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{/* Type badge */}
				<div>
					<SectionLabel>{t("kitType")}</SectionLabel>
					<div className="mt-1">
						<span className="text-xs bg-dash-accent/10 text-dash-accent px-2 py-1 rounded">
							{t(`kitCategory_${category}` as Parameters<typeof t>[0])}
						</span>
					</div>
				</div>

				{/* Description */}
				{item.description && (
					<div>
						<SectionLabel>{t("description")}</SectionLabel>
						<p className="text-sm text-dash-text-secondary mt-1 leading-relaxed">
							{item.description}
						</p>
					</div>
				)}

				{/* File name (copyable) */}
				{item.fileName && (
					<div>
						<SectionLabel>{t("kitFileName")}</SectionLabel>
						<CopyField value={item.fileName} />
					</div>
				)}

				{/* Hook event (copyable) */}
				{item.event && (
					<div>
						<SectionLabel>{t("kitEvent")}</SectionLabel>
						<CopyField value={item.event} />
					</div>
				)}

				{/* Hook command (copyable) */}
				{item.command && (
					<div>
						<SectionLabel>{t("kitCommand")}</SectionLabel>
						<CopyField value={item.command} />
					</div>
				)}

				{/* Skill badges */}
				{category === "skills" && (item.hasScript || item.hasDeps) && (
					<div>
						<SectionLabel>{t("kitAttributes")}</SectionLabel>
						<div className="flex gap-2 mt-1.5">
							{item.hasScript && (
								<span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-1 rounded">
									{t("kitHasScript")}
								</span>
							)}
							{item.hasDeps && (
								<span className="text-xs bg-amber-500/10 text-amber-500 px-2 py-1 rounded">
									{t("kitHasDeps")}
								</span>
							)}
						</div>
					</div>
				)}

				{/* Nested badge for commands */}
				{item.isNested && (
					<div>
						<SectionLabel>{t("kitAttributes")}</SectionLabel>
						<div className="mt-1.5">
							<span className="text-xs bg-dash-surface-hover text-dash-text-muted px-2 py-1 rounded">
								{t("kitNested")}
							</span>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default KitItemDetail;
