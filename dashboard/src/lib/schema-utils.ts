import type { TracedValue } from "../api/config";
import type { FormField } from "../components/ConfigSection";
import type { SchemaProperty, SchemaSection } from "../hooks/useSchema";

export interface FormSection {
	title: string;
	description?: string;
	fields: FormField[];
}

export interface ValidationInfo {
	getValidationError: (path: string) => string | undefined;
	isFieldValid: (path: string) => boolean;
}

/**
 * Convert a JSON schema section to form fields
 */
export function schemaToFormFields(
	sectionKey: string,
	section: SchemaSection,
	traced: Record<string, TracedValue>,
	pendingChanges: Record<string, unknown>,
	validation?: ValidationInfo,
): FormField[] {
	const fields: FormField[] = [];

	for (const [propKey, prop] of Object.entries(section.properties)) {
		const fullKey = `${sectionKey}.${propKey}`;
		const field = propertyToFormField(fullKey, propKey, prop, traced, pendingChanges, validation);
		if (field) {
			fields.push(field);
		}
	}

	return fields;
}

/**
 * Convert a single JSON schema property to a form field
 */
function propertyToFormField(
	fullKey: string,
	propKey: string,
	prop: SchemaProperty,
	traced: Record<string, TracedValue>,
	pendingChanges: Record<string, unknown>,
	validation?: ValidationInfo,
): FormField | null {
	// Skip complex nested objects for now (only handle primitives)
	if (prop.type === "object" && prop.properties) {
		return null;
	}

	// Skip arrays for now
	if (prop.type === "array") {
		return null;
	}

	const label = formatLabel(propKey);
	const fieldType = mapSchemaTypeToFieldType(prop);

	return {
		key: fullKey,
		label,
		type: fieldType,
		description: prop.description,
		placeholder: prop.description || `Enter ${label.toLowerCase()}`,
		options: prop.enum,
		traced: traced[fullKey],
		pendingValue: pendingChanges[fullKey],
		validationError: validation?.getValidationError(fullKey),
		isValid: validation?.isFieldValid(fullKey),
	};
}

/**
 * Map JSON schema types to form field types
 */
function mapSchemaTypeToFieldType(prop: SchemaProperty): FormField["type"] {
	if (prop.enum && prop.enum.length > 0) {
		return "select";
	}

	switch (prop.type) {
		case "number":
		case "integer":
			return "number";
		case "boolean":
			return "boolean";
		default:
			return "text";
	}
}

/**
 * Format a camelCase or snake_case key into a human-readable label
 */
function formatLabel(key: string): string {
	return key
		.replace(/([A-Z])/g, " $1") // Add space before uppercase
		.replace(/[_-]/g, " ") // Replace underscores and hyphens with spaces
		.replace(/^\s*/, "") // Trim leading space
		.replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize first letter of each word
}

/**
 * Generate form sections from parsed schema
 */
export function schemaToFormSections(
	sections: Record<string, SchemaSection>,
	traced: Record<string, TracedValue>,
	pendingChanges: Record<string, unknown>,
	validation?: ValidationInfo,
): FormSection[] {
	const formSections: FormSection[] = [];

	for (const [sectionKey, section] of Object.entries(sections)) {
		const fields = schemaToFormFields(sectionKey, section, traced, pendingChanges, validation);

		// Only add sections that have at least one field
		if (fields.length > 0) {
			formSections.push({
				title: formatLabel(sectionKey),
				description: section.description,
				fields,
			});
		}
	}

	return formSections;
}
