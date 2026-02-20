import { json } from "@codemirror/lang-json";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import CodeMirror from "@uiw/react-codemirror";
/**
 * Reusable JSON editor component with syntax highlighting and line tracking
 * Uses CodeMirror 6 with custom theme that adapts to light/dark mode via CSS variables
 */
import type React from "react";
import { useMemo } from "react";

interface JsonEditorProps {
	/** JSON string value */
	value: string;
	/** Called when content changes */
	onChange: (value: string) => void;
	/** Called when cursor line changes (0-indexed) */
	onCursorLineChange?: (line: number) => void;
	/** Editor height - defaults to 100% */
	height?: string;
	/** Whether editor is read-only */
	readOnly?: boolean;
	/** Optional wrapper class for scoped styling from parent panels */
	className?: string;
}

/**
 * Custom CodeMirror theme using CSS variables from design system
 * Automatically adapts to light/dark mode
 */
const createDashboardTheme = () => {
	const dashTheme = EditorView.theme({
		"&": {
			backgroundColor: "var(--dash-surface)",
			color: "var(--dash-text)",
			height: "100%",
		},
		".cm-content": {
			caretColor: "var(--dash-accent)",
			fontFamily: "'JetBrains Mono', Menlo, monospace",
			padding: "1rem",
		},
		".cm-cursor, .cm-dropCursor": {
			borderLeftColor: "var(--dash-accent)",
		},
		// drawSelection disabled — native ::selection handles all selection styling
		"& ::selection": {
			backgroundColor: "var(--dash-accent-selection) !important",
			color: "inherit !important",
		},
		".cm-gutters": {
			backgroundColor: "var(--dash-surface)",
			color: "var(--dash-text-muted)",
			border: "none",
			borderRight: "1px solid var(--dash-border)",
			paddingRight: "0.5rem",
		},
		".cm-lineNumbers .cm-gutterElement": {
			padding: "0 0.5rem 0 1rem",
			minWidth: "3rem",
		},
		".cm-activeLineGutter": {
			backgroundColor: "var(--dash-accent-subtle)",
			color: "var(--dash-accent)",
			fontWeight: "600",
		},
		".cm-activeLine": {
			backgroundColor: "color-mix(in srgb, var(--dash-accent) 8%, transparent)",
		},
		".cm-matchingBracket": {
			backgroundColor: "var(--dash-accent-subtle)",
			outline: "1px solid var(--dash-accent)",
		},
		".cm-scroller": {
			overflow: "auto",
			minHeight: "100%",
		},
	});

	// Syntax highlighting using CSS variables
	const dashHighlightStyle = HighlightStyle.define([
		{ tag: tags.propertyName, color: "var(--dash-accent)" },
		{ tag: tags.string, color: "color-mix(in srgb, var(--dash-accent) 70%, var(--dash-text))" },
		{ tag: tags.number, color: "var(--dash-accent-hover)" },
		{ tag: tags.bool, color: "var(--dash-accent-hover)" },
		{ tag: tags.null, color: "var(--dash-text-muted)" },
		{ tag: tags.punctuation, color: "var(--dash-text-secondary)" },
		{ tag: tags.brace, color: "var(--dash-text-secondary)" },
		{ tag: tags.bracket, color: "var(--dash-text-secondary)" },
	]);

	return [dashTheme, syntaxHighlighting(dashHighlightStyle)];
};

const JsonEditor: React.FC<JsonEditorProps> = ({
	value,
	onChange,
	onCursorLineChange,
	height = "100%",
	readOnly = false,
	className,
}) => {
	// Memoize extensions to avoid recreating on every render
	const extensions = useMemo(
		() => [json(), EditorView.lineWrapping, ...createDashboardTheme()],
		[],
	);

	// Handle cursor position changes
	const handleUpdate = useMemo(() => {
		if (!onCursorLineChange) return undefined;
		return (viewUpdate: { state: { selection: { main: { head: number } } }; view: EditorView }) => {
			const pos = viewUpdate.state.selection.main.head;
			const line = viewUpdate.view.state.doc.lineAt(pos).number - 1;
			onCursorLineChange(line);
		};
	}, [onCursorLineChange]);

	return (
		<div
			className={`h-full [&_.cm-editor]:h-full [&_.cm-editor]:outline-none [&_.cm-focused]:outline-none ${className ?? ""}`.trim()}
		>
			<CodeMirror
				value={value}
				height={height}
				extensions={extensions}
				onChange={onChange}
				onUpdate={handleUpdate}
				theme="none"
				readOnly={readOnly}
				basicSetup={{
					lineNumbers: true,
					highlightActiveLineGutter: true,
					highlightActiveLine: true,
					foldGutter: false,
					dropCursor: true,
					drawSelection: false,
					allowMultipleSelections: false,
					indentOnInput: true,
					bracketMatching: true,
					closeBrackets: true,
					autocompletion: false,
					rectangularSelection: false,
					crosshairCursor: false,
					highlightSelectionMatches: true,
				}}
			/>
		</div>
	);
};

export default JsonEditor;
