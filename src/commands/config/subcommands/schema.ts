import { getJsonSchema, getSchemaDescription } from "@/domains/config/schema-descriptions.js";

export function showSchema(options: { json?: boolean }) {
	if (options.json) {
		console.log(JSON.stringify(getJsonSchema(), null, 2));
	} else {
		console.log(getSchemaDescription());
	}
}
