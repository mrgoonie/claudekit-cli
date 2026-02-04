/**
 * Shared utilities for config editor components
 * Extracted from GlobalConfigPage, ProjectConfigPage, and SchemaForm
 */

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
