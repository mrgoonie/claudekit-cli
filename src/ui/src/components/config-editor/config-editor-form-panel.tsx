/**
 * ConfigEditorFormPanel - Left panel with schema-driven form
 */
import type React from "react";
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
}

export const ConfigEditorFormPanel: React.FC<ConfigEditorFormPanelProps> = ({
	width,
	isLoading,
	schema,
	config,
	sources,
	sections,
	onChange,
}) => {
	const { t } = useI18n();

	return (
		<div
			style={{ width: `${width}%` }}
			className="bg-dash-surface border border-dash-border rounded-xl overflow-hidden flex flex-col shadow-sm min-w-0"
		>
			<div className="p-3 border-b border-dash-border bg-dash-surface-hover/50 shrink-0">
				<h3 className="text-xs font-bold text-dash-text-secondary uppercase tracking-widest">
					{t("formTab")}
				</h3>
			</div>
			<div className="flex-1 overflow-auto p-4">
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
					/>
				) : null}
			</div>
		</div>
	);
};
