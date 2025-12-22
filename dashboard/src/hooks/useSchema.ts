import { useCallback, useEffect, useState } from "react";
import { fetchSchema, type SchemaResponse } from "../api/config";

export interface SchemaProperty {
	type: string;
	description?: string;
	default?: unknown;
	enum?: string[];
	properties?: Record<string, SchemaProperty>;
	items?: SchemaProperty;
}

export interface ParsedSchema {
	title: string;
	sections: Record<string, SchemaSection>;
}

export interface SchemaSection {
	type: string;
	description?: string;
	properties: Record<string, SchemaProperty>;
}

export function useSchema() {
	const [schema, setSchema] = useState<ParsedSchema | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		try {
			setLoading(true);
			const data = await fetchSchema();
			const parsed = parseSchema(data);
			setSchema(parsed);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load schema");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	return {
		schema,
		loading,
		error,
		reload: load,
	};
}

function parseSchema(response: SchemaResponse): ParsedSchema {
	const sections: Record<string, SchemaSection> = {};

	const properties = response.properties as Record<string, SchemaProperty>;

	for (const [key, value] of Object.entries(properties)) {
		if (value.type === "object" && value.properties) {
			sections[key] = {
				type: value.type,
				description: value.description,
				properties: value.properties,
			};
		}
	}

	return {
		title: response.title,
		sections,
	};
}
