/**
 * ConfigEditorFormPanel - Left panel with schema-driven form
 */
import type React from "react";
import { useEffect, useRef } from "react";
import { useI18n } from "../../i18n";
import { type ConfigSource, SchemaForm, type SectionConfig } from "../schema-form";

export interface ConfigEditorFormPanelProps {
	width: number;
	isLoading: boolean;
	schema: Record<string, unknown> | null;
	config: Record<string, unknown>;
	sources: Record<string, ConfigSource>;
	sections: SectionConfig[];
	onChange: (path: string, value: unknown) => void;
	onFieldFocus?: (path: string | null) => void;
	onNaturalHeightChange?: (height: number) => void;
}

export const ConfigEditorFormPanel: React.FC<ConfigEditorFormPanelProps> = ({
	width,
	isLoading,
	schema,
	config,
	sources,
	sections,
	onChange,
	onFieldFocus,
	onNaturalHeightChange,
}) => {
	const { t } = useI18n();
	const panelRef = useRef<HTMLDivElement>(null);
	const headerRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const innerContentRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!onNaturalHeightChange) return;

		const reportHeight = () => {
			const headerHeight = headerRef.current?.getBoundingClientRect().height ?? 0;
			const contentElement = contentRef.current;

			if (!contentElement) {
				onNaturalHeightChange(Math.ceil(headerHeight));
				return;
			}

			const styles = window.getComputedStyle(contentElement);
			const paddingTop = Number.parseFloat(styles.paddingTop || "0");
			const paddingBottom = Number.parseFloat(styles.paddingBottom || "0");
			const innerContentHeight = innerContentRef.current?.getBoundingClientRect().height ?? 0;

			onNaturalHeightChange(
				Math.ceil(headerHeight + paddingTop + paddingBottom + innerContentHeight),
			);
		};

		reportHeight();

		if (typeof ResizeObserver === "undefined") return;

		const observer = new ResizeObserver(() => {
			reportHeight();
		});

		if (panelRef.current) observer.observe(panelRef.current);
		if (headerRef.current) observer.observe(headerRef.current);
		if (contentRef.current) observer.observe(contentRef.current);
		if (innerContentRef.current) observer.observe(innerContentRef.current);

		return () => observer.disconnect();
	}, [onNaturalHeightChange]);

	return (
		<div
			ref={panelRef}
			data-form-panel
			style={{ width: `${width}%` }}
			className="bg-dash-surface border border-dash-border rounded-xl overflow-hidden flex flex-col shadow-sm min-w-0 h-full"
		>
			<div
				ref={headerRef}
				data-form-panel-header
				className="p-3 border-b border-dash-border bg-dash-surface-hover/50 shrink-0"
			>
				<h3 className="text-xs font-bold text-dash-text-secondary uppercase tracking-widest">
					{t("formTab")}
				</h3>
			</div>
			<div ref={contentRef} data-form-panel-scroll className="flex-1 overflow-auto p-4">
				<div ref={innerContentRef} data-form-panel-content>
					{isLoading ? (
						<div className="h-full flex items-center justify-center">
							<div className="animate-pulse text-dash-text-muted text-sm">{t("loading")}</div>
						</div>
					) : schema ? (
						<SchemaForm
							schema={schema}
							value={config}
							sources={sources}
							sections={sections}
							onChange={onChange}
							onFieldFocus={onFieldFocus}
						/>
					) : null}
				</div>
			</div>
		</div>
	);
};
