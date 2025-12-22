import { AlertCircle, Check, Loader2 } from "lucide-react";
import type { TracedValue } from "../api/config";
import { SourceBadge } from "./SourceBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export interface FormField {
	key: string;
	label: string;
	type?: "text" | "number" | "boolean" | "select";
	description?: string;
	placeholder?: string;
	options?: string[];
	traced?: TracedValue;
	pendingValue?: unknown;
	validationError?: string;
	isValid?: boolean;
}

interface ConfigSectionProps {
	title: string;
	description?: string;
	fields: FormField[];
	onFieldChange: (key: string, value: unknown) => void;
	validating?: boolean;
}

export function ConfigSection({
	title,
	description,
	fields,
	onFieldChange,
	validating,
}: ConfigSectionProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-lg flex items-center gap-2">
					{title}
					{validating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
				</CardTitle>
				{description && <CardDescription>{description}</CardDescription>}
			</CardHeader>
			<CardContent className="space-y-4">
				{fields.map((field) => (
					<ConfigField key={field.key} field={field} onFieldChange={onFieldChange} />
				))}
			</CardContent>
		</Card>
	);
}

interface ConfigFieldProps {
	field: FormField;
	onFieldChange: (key: string, value: unknown) => void;
}

function ConfigField({ field, onFieldChange }: ConfigFieldProps) {
	const {
		key,
		label,
		type = "text",
		description,
		placeholder,
		options,
		traced,
		pendingValue,
		validationError,
		isValid,
	} = field;

	const currentValue =
		pendingValue !== undefined
			? pendingValue
			: traced?.value !== undefined
				? traced.value
				: type === "boolean"
					? false
					: "";

	const hasChange = pendingValue !== undefined && pendingValue !== traced?.value;
	const hasError = !!validationError;
	const showValid = hasChange && isValid !== false && !hasError;

	// Determine input border class
	let borderClass = "";
	if (hasError) {
		borderClass = "border-red-500 bg-red-50 focus:ring-red-500";
	} else if (showValid) {
		borderClass = "border-green-500 bg-green-50";
	} else if (hasChange) {
		borderClass = "border-yellow-400 bg-yellow-50";
	}

	const handleChange = (value: unknown) => {
		onFieldChange(key, value);
	};

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<Label htmlFor={key} className="flex items-center gap-2" title={description}>
					{label}
					{hasError && <AlertCircle className="h-4 w-4 text-red-500" />}
					{showValid && <Check className="h-4 w-4 text-green-500" />}
				</Label>
				{traced && <SourceBadge source={traced.source} />}
			</div>

			{type === "select" && options ? (
				<select
					id={key}
					value={String(currentValue)}
					onChange={(e) => handleChange(e.target.value)}
					className={`w-full border rounded px-3 py-2 text-sm ${borderClass || "border-gray-300"}`}
				>
					<option value="">Select...</option>
					{options.map((opt) => (
						<option key={opt} value={opt}>
							{opt}
						</option>
					))}
				</select>
			) : type === "boolean" ? (
				<div className="flex items-center gap-2">
					<input
						type="checkbox"
						id={key}
						checked={Boolean(currentValue)}
						onChange={(e) => handleChange(e.target.checked)}
						className={`h-4 w-4 rounded ${hasChange ? "accent-yellow-400" : ""}`}
					/>
					<span className="text-sm text-gray-600">{description || `Enable ${label}`}</span>
				</div>
			) : type === "number" ? (
				<Input
					id={key}
					type="number"
					value={String(currentValue)}
					onChange={(e) => handleChange(Number(e.target.value))}
					placeholder={placeholder}
					className={borderClass}
				/>
			) : (
				<Input
					id={key}
					type="text"
					value={String(currentValue)}
					onChange={(e) => handleChange(e.target.value)}
					placeholder={placeholder}
					className={borderClass}
				/>
			)}

			{hasError && <p className="text-xs text-red-600">{validationError}</p>}
			{hasChange && !hasError && (
				<p className="text-xs text-yellow-600">
					Changed from: {traced?.value !== undefined ? String(traced.value) : "(empty)"}
				</p>
			)}
		</div>
	);
}
