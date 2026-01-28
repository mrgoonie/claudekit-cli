/**
 * SchemaForm - Main schema-driven form component
 * Dynamically renders form sections and fields from JSON Schema
 */
import type React from "react";
import { SchemaField } from "./SchemaField";
import { SchemaSection } from "./SchemaSection";
import type { ConfigSource } from "./SourceBadge";

export interface SectionConfig {
	id: string;
	title: string;
	titleVi: string;
	fields: FieldConfig[];
	defaultCollapsed?: boolean;
}

export interface FieldConfig {
	path: string;
	label: string;
	labelVi: string;
	description?: string;
	descriptionVi?: string;
}

export interface SchemaFormProps {
	schema: Record<string, unknown>;
	value: Record<string, unknown>;
	sources: Record<string, ConfigSource>;
	sections: SectionConfig[];
	onChange: (path: string, value: unknown) => void;
	disabled?: boolean;
}

/** Get nested value from object using dot-notation path */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
	const keys = path.split(".");
	let current: unknown = obj;
	for (const key of keys) {
		if (current === null || current === undefined) return undefined;
		if (typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[key];
	}
	return current;
}

/** Get schema definition for a field path */
function getSchemaForPath(schema: Record<string, unknown>, path: string): Record<string, unknown> {
	const keys = path.split(".");
	let current = schema;

	for (const key of keys) {
		if (!current.properties) return {};
		const props = current.properties as Record<string, Record<string, unknown>>;
		if (!props[key]) return {};
		current = props[key];
	}

	return current;
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
					titleVi={section.titleVi}
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
								labelVi={field.labelVi}
								description={field.description || (fieldSchema.description as string)}
								descriptionVi={field.descriptionVi}
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
