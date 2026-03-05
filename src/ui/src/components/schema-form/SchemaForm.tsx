/**
 * SchemaForm - Main schema-driven form component
 * Dynamically renders form sections and fields from JSON Schema
 */
import type React from "react";
import { getNestedValue, getSchemaForPath } from "../../utils/config-editor-utils";
import { SchemaField } from "./SchemaField";
import { SchemaSection } from "./SchemaSection";
import type { ConfigSource } from "./SourceBadge";

export interface SectionConfig {
	id: string;
	title: string;
	fields: FieldConfig[];
	defaultCollapsed?: boolean;
}

export interface FieldConfig {
	path: string;
	label: string;
	description?: string;
}

export interface SchemaFormProps {
	schema: Record<string, unknown>;
	value: Record<string, unknown>;
	sources: Record<string, ConfigSource>;
	sections: SectionConfig[];
	onChange: (path: string, value: unknown) => void;
	disabled?: boolean;
}

export const SchemaForm: React.FC<SchemaFormProps> = ({
	schema,
	value,
	sources,
	sections,
	onChange,
	disabled,
}) => {
	return (
		<div className="space-y-4">
			{sections.map((section, sectionIndex) => (
				<SchemaSection
					key={section.id}
					id={section.id}
					title={section.title}
					defaultCollapsed={section.defaultCollapsed ?? sectionIndex > 1}
				>
					{section.fields.map((field) => {
						const fieldSchema = getSchemaForPath(schema, field.path);
						const fieldValue = getNestedValue(value, field.path);
						const fieldSource = sources[field.path] || "default";

						return (
							<SchemaField
								key={field.path}
								fieldPath={field.path}
								label={field.label}
								description={field.description || (fieldSchema.description as string)}
								schema={fieldSchema}
								value={fieldValue}
								source={fieldSource}
								onChange={(newValue) => onChange(field.path, newValue)}
								disabled={disabled}
							/>
						);
					})}
				</SchemaSection>
			))}
		</div>
	);
};
