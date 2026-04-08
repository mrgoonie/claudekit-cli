/**
 * Session search bar — debounced in-page text search with match navigation.
 * Wraps text-node matches in <mark> elements within [data-search-content] scope.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";

export interface SessionSearchBarProps {
	containerRef: React.RefObject<HTMLElement>;
	visible: boolean;
}

const MARK_ATTR = "data-search-mark";
const MARK_BASE = "bg-yellow-300/40 text-dash-text rounded-sm px-0.5";
const MARK_ACTIVE = "ring-2 ring-dash-accent bg-yellow-300/60";

function clearMarks(root: HTMLElement) {
	for (const mark of root.querySelectorAll(`mark[${MARK_ATTR}]`)) {
		const p = mark.parentNode;
		if (p) {
			p.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
			p.normalize();
		}
	}
}

function highlightMatches(root: HTMLElement, query: string): number {
	const lc = query.toLowerCase();
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode(n) {
			const el = n.parentElement;
			if (!el || el.tagName === "MARK" || !el.closest("[data-search-content]"))
				return NodeFilter.FILTER_REJECT;
			return n.textContent?.toLowerCase().includes(lc)
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_REJECT;
		},
	});
	const nodes: Text[] = [];
	let next = walker.nextNode();
	while (next) {
		nodes.push(next as Text);
		next = walker.nextNode();
	}
	let count = 0;
	for (const tn of nodes) {
		const text = tn.textContent ?? "";
		const parent = tn.parentNode;
		if (!parent) continue;
		const frag = document.createDocumentFragment();
		let pos = 0;
		let idx = text.toLowerCase().indexOf(lc, 0);
		while (idx !== -1) {
			if (idx > pos) frag.appendChild(document.createTextNode(text.slice(pos, idx)));
			const m = document.createElement("mark");
			m.setAttribute(MARK_ATTR, "");
			m.setAttribute("data-match-index", String(count));
			m.className = MARK_BASE;
			m.textContent = text.slice(idx, idx + query.length);
			frag.appendChild(m);
			count++;
			pos = idx + query.length;
			idx = text.toLowerCase().indexOf(lc, pos);
		}
		if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
		parent.replaceChild(frag, tn);
	}
	return count;
}

const SessionSearchBar: React.FC<SessionSearchBarProps> = ({ containerRef, visible }) => {
	const { t } = useI18n();
	const [query, setQuery] = useState("");
	const [debounced, setDebounced] = useState("");
	const [total, setTotal] = useState(0);
	const [current, setCurrent] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);

	// Debounce
	useEffect(() => {
		const id = setTimeout(() => setDebounced(query), 300);
		return () => clearTimeout(id);
	}, [query]);

	// Focus on show
	useEffect(() => {
		if (visible) inputRef.current?.focus();
	}, [visible]);

	// Highlight matches
	useEffect(() => {
		const root = containerRef.current;
		if (!root) return;
		clearMarks(root);
		if (!debounced.trim()) {
			setTotal(0);
			setCurrent(0);
			return;
		}
		const n = highlightMatches(root, debounced.trim());
		setTotal(n);
		setCurrent(n > 0 ? 1 : 0);
	}, [debounced, containerRef]);

	// Style + scroll to current
	useEffect(() => {
		const root = containerRef.current;
		if (!root || total === 0) return;
		const marks = root.querySelectorAll<HTMLElement>(`mark[${MARK_ATTR}]`);
		marks.forEach((m, i) => {
			m.className = i === current - 1 ? `${MARK_BASE} ${MARK_ACTIVE}` : MARK_BASE;
		});
		marks[current - 1]?.scrollIntoView({ behavior: "smooth", block: "center" });
	}, [current, total, containerRef]);

	// Cleanup on hide / unmount
	useEffect(() => {
		if (!visible && containerRef.current) clearMarks(containerRef.current);
	}, [visible, containerRef]);
	useEffect(
		() => () => {
			if (containerRef.current) clearMarks(containerRef.current);
		},
		[containerRef],
	);

	const navigate = useCallback(
		(dir: 1 | -1) => {
			if (total === 0) return;
			setCurrent((c) => ((c - 1 + dir + total) % total) + 1);
		},
		[total],
	);

	if (!visible) return null;

	return (
		<div className="flex items-center gap-2 px-4 py-2 border-b border-dash-border bg-dash-surface">
			<svg
				className="w-4 h-4 text-dash-text-muted shrink-0"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<circle cx="11" cy="11" r="8" />
				<path d="m21 21-4.35-4.35" />
			</svg>
			<input
				ref={inputRef}
				type="text"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				placeholder={t("sessionSearchPlaceholder")}
				className="flex-1 bg-dash-bg border border-dash-border rounded-lg px-3 py-1.5 text-sm text-dash-text outline-none focus:border-dash-accent min-w-0"
			/>
			<span className="text-xs text-dash-text-muted whitespace-nowrap shrink-0">
				{total === 0 ? t("sessionNoResults") : `${current}/${total} ${t("sessionSearchResults")}`}
			</span>
			<button
				type="button"
				onClick={() => navigate(-1)}
				disabled={total === 0}
				className="p-1 rounded hover:bg-dash-hover disabled:opacity-40"
				aria-label="previous match"
			>
				<svg
					className="w-4 h-4 text-dash-text"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path d="m18 15-6-6-6 6" />
				</svg>
			</button>
			<button
				type="button"
				onClick={() => navigate(1)}
				disabled={total === 0}
				className="p-1 rounded hover:bg-dash-hover disabled:opacity-40"
				aria-label="next match"
			>
				<svg
					className="w-4 h-4 text-dash-text"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path d="m6 9 6 6 6-6" />
				</svg>
			</button>
		</div>
	);
};

export default SessionSearchBar;
