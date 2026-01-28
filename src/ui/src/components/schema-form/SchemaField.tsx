/**
 * SchemaField - Wrapper that renders appropriate field renderer based on schema type
 */
import type React from "react";
import { useI18n } from "../../i18n";
import {
	ArrayField,
	BooleanField,
	EnumField,
	NumberField,
	PasswordField,
	StringField,
} from "./FieldRenderers";
import { type ConfigSource, SourceBadge } from "./SourceBadge";

export interface SchemaFieldProps {
	fieldPath: string;
	label: string;
	labelVi?: string;
	description?: string;
	descriptionVi?: string;
	schema: {
		type?: string | string[];
		enum?: unknown[];
		minimum?: number;
		maximum?: number;
		default?: unknown;
		description?: string;
	};
	value: unknown;
	source: ConfigSource;
	onChange: (value: unknown) => void;
	disabled?: boolean;
}

/** Determine which field renderer to use based on schema */
function getFieldType(schema: SchemaFieldProps["schema"], fieldPath: string): string {
	// Special handling for password fields
	if (fieldPath.includes("passphrase") || fieldPath.includes("password")) {
		return "password";
	}

	// Handle enum first (before type check)
	if (schema.enum && schema.enum.length > 0) {
		return "enum";
	}

	// Handle type (can be string or array)
	const type = Array.isArray(schema.type)
		? schema.type.find((t) => t !== "null") || "string"
		: schema.type || "string";

	switch (type) {
		case "boolean":
			return "boolean";
		case "integer":
		case "number":
			return "number";
		case "array":
			return "array";
		case "object":
			return "object";
		default:
			return "string";
	}
}

export const SchemaField: React.FC<SchemaFieldProps> = ({
	fieldPath,
	label,
	labelVi,
	description,
	descriptionVi,
	schema,
	value,
	source,
	onChange,
	disabled,
}) => {
	const { lang } = useI18n();
	const fieldType = getFieldType(schema, fieldPath);

	const displayLabel = lang === "vi" && labelVi ? labelVi : label;
	const displayDescription = lang === "vi" && descriptionVi ? descriptionVi : description;

	// Render appropriate field component
	const renderField = () => {
		const props = { value, onChange, schema, disabled };

		switch (fieldType) {
			case "boolean":
				return <BooleanField {...props} />;
			case "number":
				return <NumberField {...props} />;
			case "enum":
				return <EnumField {...props} />;
			case "array":
				return <ArrayField {...props} />;
			case "password":
				return <PasswordField {...props} />;
			case "object":
				// Objects are handled by SchemaSection recursively
				return null;
			default:
				return <StringField {...props} />;
		}
	};

	// Don't render object types here (they're sections)
	if (fieldType === "object") {
		return null;
	}

	return (
		<div className="py-3 border-b border-dash-border/50 last:border-b-0">
			<div className="flex items-start justify-between gap-4">
				<div className="flex-1 min-w-0">
					{/* Label row */}
					<div className="flex items-center gap-2 mb-1">
						<span className="text-sm font-medium text-dash-text">{displayLabel}</span>
						<SourceBadge source={source} />
					</div>

					{/* Description */}
					{displayDescription && (
						<p className="text-xs text-dash-text-muted mb-2 leading-relaxed">
							{displayDescription}
						</p>
					)}

					{/* Field path (for debugging/power users) */}
					<p className="text-[10px] text-dash-text-muted/50 font-mono mb-2">{fieldPath}</p>
				</div>

				{/* Field input - right aligned for booleans, full width for others */}
				<div className={fieldType === "boolean" ? "shrink-0" : "w-1/2 max-w-xs"}>
					{renderField()}
				</div>
			</div>
		</div>
	);
};
