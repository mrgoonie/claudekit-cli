/**
 * Shared utilities for config editor components
 * Extracted from GlobalConfigPage, ProjectConfigPage, and SchemaForm
 */
import { CONFIG_FIELD_DOCS, type FieldDoc } from "../services/configFieldDocs";

/**
 * Set nested value in object using dot-notation path
 * Creates intermediate objects if they don't exist
 */
export function setNestedValue(
	obj: Record<string, unknown>,
	path: string,
	value: unknown,
): Record<string, unknown> {
	const result = { ...obj };
	const keys = path.split(".");
	let current: Record<string, unknown> = result;

	for (let i = 0; i < keys.length - 1; i++) {
		const key = keys[i];
		if (!(key in current) || typeof current[key] !== "object" || current[key] === null) {
			current[key] = {};
		} else {
			current[key] = { ...(current[key] as Record<string, unknown>) };
		}
		current = current[key] as Record<string, unknown>;
	}

	current[keys[keys.length - 1]] = value;
	return result;
}

/**
 * Get nested value from object using dot-notation path
 * Returns undefined if path doesn't exist
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
	const keys = path.split(".");
	let current: unknown = obj;
	for (const key of keys) {
		if (current === null || current === undefined) return undefined;
		if (typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[key];
	}
	return current;
}

/**
 * Get schema definition for a field path from JSON Schema
 * Traverses nested properties to find the field schema
 */
export function getSchemaForPath(
	schema: Record<string, unknown>,
	path: string,
): Record<string, unknown> {
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

function getSchemaTypeLabel(schemaNode: Record<string, unknown>): string {
	if (Array.isArray(schemaNode.oneOf)) {
		const labels = schemaNode.oneOf
			.map((option) => {
				if (!option || typeof option !== "object") return null;
				const typedOption = option as Record<string, unknown>;
				if (typedOption.const !== undefined) return JSON.stringify(typedOption.const);
				if (typedOption.type === "array" && typedOption.items) return "string[]";
				if (Array.isArray(typedOption.type)) return typedOption.type.join(" | ");
				return typeof typedOption.type === "string" ? typedOption.type : null;
			})
			.filter((label): label is string => Boolean(label));

		return labels.length > 0 ? labels.join(" | ") : "unknown";
	}

	if (Array.isArray(schemaNode.type)) return schemaNode.type.join(" | ");
	return typeof schemaNode.type === "string" ? schemaNode.type : "unknown";
}

export function buildSchemaFieldDoc(
	path: string | null,
	schema: Record<string, unknown> | null,
): FieldDoc | null {
	if (!path) return null;

	const explicitDoc = CONFIG_FIELD_DOCS[path];
	if (explicitDoc) return explicitDoc;
	if (!schema) return null;

	const schemaNode = getSchemaForPath(schema, path);
	if (Object.keys(schemaNode).length === 0) return null;

	const validValues = Array.isArray(schemaNode.enum)
		? schemaNode.enum.map((value) => String(value))
		: Array.isArray(schemaNode.oneOf)
			? schemaNode.oneOf
					.map((option) => {
						if (!option || typeof option !== "object") return null;
						const typedOption = option as Record<string, unknown>;
						return typedOption.const !== undefined ? String(typedOption.const) : null;
					})
					.filter((value): value is string => Boolean(value))
			: undefined;

	return {
		path,
		type: getSchemaTypeLabel(schemaNode),
		default: schemaNode.default !== undefined ? JSON.stringify(schemaNode.default) : "n/a",
		validValues: validValues && validValues.length > 0 ? validValues : undefined,
		description:
			typeof schemaNode.description === "string"
				? schemaNode.description
				: "Schema-derived help is available for this field.",
		descriptionVi:
			typeof schemaNode.description === "string"
				? schemaNode.description
				: "Trường này đang hiển thị mô tả được suy ra từ schema.",
	};
}

export function resolveActiveFieldPath(
	focusedFieldPath: string | null,
	jsonFieldPath: string | null,
): string | null {
	return focusedFieldPath ?? jsonFieldPath ?? null;
}

function normalizeProviderToken(token: string): string {
	const trimmed = token.trim();
	const unwrapped =
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
			? trimmed.slice(1, -1)
			: trimmed;

	return unwrapped.trim().toLowerCase();
}

function parseProviderInput(value: string): string | string[] {
	const trimmed = value.trim();
	if (!trimmed) return [];

	try {
		const parsed = JSON.parse(trimmed);
		if (typeof parsed === "string" || Array.isArray(parsed)) {
			return parsed;
		}
	} catch {
		// Fall back to plain-text parsing below.
	}

	if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
		return trimmed
			.slice(1, -1)
			.split(",")
			.map((part) => part.trim())
			.filter(Boolean);
	}

	return trimmed;
}

export function normalizeStringArrayUnionInput(value: string): string | string[] {
	const parsed = parseProviderInput(value);
	const parts = (Array.isArray(parsed) ? parsed : String(parsed).split(","))
		.map(normalizeProviderToken)
		.filter(Boolean)
		.filter((part, index, list) => list.indexOf(part) === index);

	if (parts.length === 0 || (parts.length === 1 && parts[0] === "auto")) {
		return "auto";
	}

	return parts.filter((part) => part !== "auto");
}
