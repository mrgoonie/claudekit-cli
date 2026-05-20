/**
 * Command palette modal triggered by Cmd+K / Ctrl+K
 * Grouped results: Navigation, Projects, Agents, Commands, Skills
 * Keyboard navigation: arrows + Enter to select, Escape to close
 */
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type SearchItem, type SearchItemType, useSearchIndex } from "../hooks/use-search-index";
import { useI18n } from "../i18n";
import type { Project } from "../types";

interface SearchPaletteProps {
	open: boolean;
	projects: Project[];
	onClose: () => void;
}

const TYPE_ORDER: SearchItemType[] = ["navigation", "project", "agent", "command", "skill"];

const TYPE_BADGE_CLASSES: Record<SearchItemType, string> = {
	navigation: "bg-dash-accent/20 text-dash-accent",
	project: "bg-dash-text-muted/20 text-dash-text-muted",
	agent: "bg-[#e85d4a]/20 text-[#e85d4a]",
	command: "bg-blue-500/20 text-blue-400",
	skill: "bg-green-500/20 text-green-400",
};

/** Highlight matched query terms in text */
function HighlightMatch({ text, query }: { text: string; query: string }) {
	if (!query.trim()) return <span>{text}</span>;

	const terms = query
		.trim()
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.sort((a, b) => b.length - a.length);

	const parts: { text: string; match: boolean }[] = [];
	let remaining = text;

	while (remaining.length > 0) {
		let bestIdx = -1;
		let bestLen = 0;
		let bestTerm = "";

		for (const term of terms) {
			const idx = remaining.toLowerCase().indexOf(term);
			if (
				idx !== -1 &&
				(bestIdx === -1 || idx < bestIdx || (idx === bestIdx && term.length > bestLen))
			) {
				bestIdx = idx;
				bestLen = term.length;
				bestTerm = term;
			}
		}

		if (bestIdx === -1 || !bestTerm) {
			parts.push({ text: remaining, match: false });
			break;
		}

		if (bestIdx > 0) parts.push({ text: remaining.slice(0, bestIdx), match: false });
		parts.push({ text: remaining.slice(bestIdx, bestIdx + bestLen), match: true });
		remaining = remaining.slice(bestIdx + bestLen);
	}

	return (
		<span>
			{parts.map((p, i) =>
				p.match ? (
					<mark
						// Index key is safe: parts are derived from a single stable string, no reorder
						key={`m${i}`}
						className="bg-dash-accent/30 text-dash-text rounded-sm px-0.5"
					>
						{p.text}
					</mark>
				) : (
					<span key={`s${i}`}>{p.text}</span>
				),
			)}
		</span>
	);
}

const SearchPalette: React.FC<SearchPaletteProps> = ({ open, projects, onClose }) => {
	const { t } = useI18n();
	const navigate = useNavigate();
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);

	const { search, loading } = useSearchIndex({ projects });

	const grouped = search(query);

	// Flat ordered list for keyboard navigation
	const flatItems: SearchItem[] = TYPE_ORDER.flatMap((type) => grouped[type] ?? []);

	// Reset state and focus input when opening
	useEffect(() => {
		if (open) {
			setQuery("");
			setActiveIndex(0);
			setTimeout(() => inputRef.current?.focus(), 0);
		}
	}, [open]);

	// Keep active item scrolled into view
	useEffect(() => {
		const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`);
		el?.scrollIntoView({ block: "nearest" });
	}, [activeIndex]);

	const selectItem = useCallback(
		(item: SearchItem) => {
			navigate(item.route);
			onClose();
		},
		[navigate, onClose],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
				return;
			}
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				setActiveIndex((i) => Math.max(i - 1, 0));
				return;
			}
			if (e.key === "Enter") {
				e.preventDefault();
				const item = flatItems[activeIndex];
				if (item) selectItem(item);
			}
		},
		[flatItems, activeIndex, onClose, selectItem],
	);

	const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setQuery(e.target.value);
		setActiveIndex(0);
	};

	if (!open) return null;

	let itemCursor = 0;

	const getSectionLabel = (type: SearchItemType): string => {
		switch (type) {
			case "navigation":
				return t("paletteNavigation");
			case "project":
				return t("paletteProjects");
			case "agent":
				return t("paletteAgents");
			case "command":
				return t("paletteCommands");
			case "skill":
				return t("paletteSkills");
		}
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
			style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
			aria-label="Search"
			onClick={onClose}
			onKeyDown={(e) => e.key === "Escape" && onClose()}
		>
			{/* Modal */}
			<div
				className="w-full max-w-[600px] mx-4 bg-dash-surface border border-dash-border rounded-xl shadow-2xl overflow-hidden"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				{/* Search input */}
				<div className="flex items-center gap-3 px-4 py-3 border-b border-dash-border">
					<svg
						className="w-4 h-4 text-dash-text-muted shrink-0"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
					<input
						ref={inputRef}
						type="text"
						className="flex-1 bg-transparent text-dash-text placeholder:text-dash-text-muted text-base outline-none"
						placeholder={t("palettePlaceholder")}
						value={query}
						onChange={handleQueryChange}
						onKeyDown={handleKeyDown}
						autoComplete="off"
						spellCheck={false}
					/>
					<kbd className="hidden sm:block text-[10px] text-dash-text-muted bg-dash-surface border border-dash-border rounded px-1.5 py-0.5">
						esc
					</kbd>
				</div>

				{/* Results */}
				<div ref={listRef} className="max-h-[420px] overflow-y-auto py-2">
					{loading && (
						<div className="px-4 py-6 text-center text-dash-text-muted text-sm">{t("loading")}</div>
					)}

					{!loading && flatItems.length === 0 && (
						<div className="px-4 py-6 text-center text-dash-text-muted text-sm">
							{t("paletteNoResults")}
						</div>
					)}

					{!loading &&
						TYPE_ORDER.map((type) => {
							const items = grouped[type];
							if (!items || items.length === 0) return null;

							const sectionLabel = getSectionLabel(type);

							return (
								<div key={type}>
									{/* Section header */}
									<div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-dash-text-muted">
										{sectionLabel}
									</div>

									{items.map((item) => {
										const idx = itemCursor++;
										const isActive = idx === activeIndex;

										return (
											<button
												key={`${type}-${item.route}`}
												type="button"
												data-idx={idx}
												className={`w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-colors ${
													isActive
														? "bg-dash-accent/10 text-dash-text"
														: "text-dash-text hover:bg-dash-surface"
												}`}
												onClick={() => selectItem(item)}
												onMouseEnter={() => setActiveIndex(idx)}
											>
												{/* Type badge */}
												<span
													className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${TYPE_BADGE_CLASSES[type]}`}
												>
													{sectionLabel}
												</span>

												{/* Name + description */}
												<div className="flex-1 min-w-0">
													<div className="text-sm font-medium truncate">
														<HighlightMatch text={item.name} query={query} />
													</div>
													{item.description && (
														<div className="text-xs text-dash-text-muted truncate mt-0.5">
															<HighlightMatch text={item.description} query={query} />
														</div>
													)}
												</div>

												{/* Enter hint on active */}
												{isActive && (
													<kbd className="shrink-0 text-[10px] text-dash-text-muted bg-dash-surface border border-dash-border rounded px-1.5 py-0.5">
														↵
													</kbd>
												)}
											</button>
										);
									})}
								</div>
							);
						})}
				</div>

				{/* Footer hint */}
				{flatItems.length > 0 && (
					<div className="px-4 py-2 border-t border-dash-border flex gap-4 text-[10px] text-dash-text-muted">
						<span>↑↓ navigate</span>
						<span>↵ select</span>
						<span>esc close</span>
					</div>
				)}
			</div>
		</div>
	);
};

export default SearchPalette;
