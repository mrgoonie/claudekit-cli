/**
 * FieldRenderers - Type-specific form field components
 * Renders string, number, boolean, enum, and array fields
 */
import type React from "react";
import { useState } from "react";

export interface FieldRendererProps {
	value: unknown;
	onChange: (value: unknown) => void;
	schema: {
		type?: string | string[];
		enum?: unknown[];
		minimum?: number;
		maximum?: number;
		default?: unknown;
		description?: string;
	};
	disabled?: boolean;
}

/** Text input for string fields */
export const StringField: React.FC<FieldRendererProps> = ({ value, onChange, disabled }) => {
	return (
		<input
			type="text"
			value={(value as string) ?? ""}
			onChange={(e) => onChange(e.target.value || null)}
			disabled={disabled}
			className="w-full px-3 py-2 text-sm bg-dash-bg border border-dash-border rounded-lg
				text-dash-text placeholder-dash-text-muted
				focus:outline-none focus:ring-2 focus:ring-dash-accent/50 focus:border-dash-accent
				disabled:opacity-50 disabled:cursor-not-allowed
				transition-colors"
			placeholder="Enter value..."
		/>
	);
};

/** Number input for integer/number fields */
export const NumberField: React.FC<FieldRendererProps> = ({
	value,
	onChange,
	schema,
	disabled,
}) => {
	return (
		<input
			type="number"
			value={value !== null && value !== undefined ? String(value) : ""}
			onChange={(e) => {
				const val = e.target.value;
				if (val === "") {
					onChange(null);
				} else {
					const num = schema.type === "integer" ? Number.parseInt(val, 10) : Number.parseFloat(val);
					if (!Number.isNaN(num)) onChange(num);
				}
			}}
			min={schema.minimum}
			max={schema.maximum}
			disabled={disabled}
			className="w-full px-3 py-2 text-sm bg-dash-bg border border-dash-border rounded-lg
				text-dash-text placeholder-dash-text-muted
				focus:outline-none focus:ring-2 focus:ring-dash-accent/50 focus:border-dash-accent
				disabled:opacity-50 disabled:cursor-not-allowed
				transition-colors"
		/>
	);
};

/** Toggle switch for boolean fields */
export const BooleanField: React.FC<FieldRendererProps> = ({ value, onChange, disabled }) => {
	const isChecked = value === true;

	return (
		<button
			type="button"
			role="switch"
			aria-checked={isChecked}
			onClick={() => onChange(!isChecked)}
			disabled={disabled}
			className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
				focus:outline-none focus:ring-2 focus:ring-dash-accent/50
				disabled:opacity-50 disabled:cursor-not-allowed
				${isChecked ? "bg-dash-accent" : "bg-dash-border"}`}
		>
			<span
				className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform
					${isChecked ? "translate-x-6" : "translate-x-1"}`}
			/>
		</button>
	);
};

/** Select dropdown for enum fields */
export const EnumField: React.FC<FieldRendererProps> = ({ value, onChange, schema, disabled }) => {
	const options = schema.enum || [];

	return (
		<select
			value={value !== null && value !== undefined ? String(value) : ""}
			onChange={(e) => {
				const val = e.target.value;
				// Try to preserve original type (number vs string)
				if (val === "") {
					onChange(null);
				} else if (options.includes(Number(val))) {
					onChange(Number(val));
				} else {
					onChange(val);
				}
			}}
			disabled={disabled}
			className="w-full px-3 py-2 text-sm bg-dash-bg border border-dash-border rounded-lg
				text-dash-text
				focus:outline-none focus:ring-2 focus:ring-dash-accent/50 focus:border-dash-accent
				disabled:opacity-50 disabled:cursor-not-allowed
				transition-colors appearance-none cursor-pointer"
		>
			<option value="">-- Select --</option>
			{options.map((opt) => (
				<option key={String(opt)} value={String(opt)}>
					{String(opt)}
				</option>
			))}
		</select>
	);
};

/** Array editor for array fields (simple string arrays) */
export const ArrayField: React.FC<FieldRendererProps> = ({ value, onChange, disabled }) => {
	const items = Array.isArray(value) ? value : [];
	const [newItem, setNewItem] = useState("");

	const addItem = () => {
		if (newItem.trim()) {
			onChange([...items, newItem.trim()]);
			setNewItem("");
		}
	};

	const removeItem = (index: number) => {
		const updated = items.filter((_, i) => i !== index);
		onChange(updated.length > 0 ? updated : []);
	};

	return (
		<div className="space-y-2">
			{/* Existing items */}
			<div className="flex flex-wrap gap-1.5">
				{items.map((item, index) => (
					<span
						key={index}
						className="inline-flex items-center gap-1 px-2 py-1 bg-dash-bg border border-dash-border rounded text-xs text-dash-text"
					>
						{String(item)}
						{!disabled && (
							<button
								type="button"
								onClick={() => removeItem(index)}
								className="text-dash-text-muted hover:text-red-500 transition-colors"
							>
								<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</button>
						)}
					</span>
				))}
			</div>

			{/* Add new item */}
			{!disabled && (
				<div className="flex gap-2">
					<input
						type="text"
						value={newItem}
						onChange={(e) => setNewItem(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								addItem();
							}
						}}
						placeholder="Add item..."
						className="flex-1 px-2 py-1 text-xs bg-dash-bg border border-dash-border rounded
							text-dash-text placeholder-dash-text-muted
							focus:outline-none focus:ring-1 focus:ring-dash-accent/50"
					/>
					<button
						type="button"
						onClick={addItem}
						className="px-2 py-1 text-xs bg-dash-accent text-white rounded hover:bg-dash-accent-hover transition-colors"
					>
						+
					</button>
				</div>
			)}
		</div>
	);
};

/** Password field for sensitive strings */
export const PasswordField: React.FC<FieldRendererProps> = ({ value, onChange, disabled }) => {
	const [show, setShow] = useState(false);

	return (
		<div className="relative">
			<input
				type={show ? "text" : "password"}
				value={(value as string) ?? ""}
				onChange={(e) => onChange(e.target.value || null)}
				disabled={disabled}
				className="w-full px-3 py-2 pr-10 text-sm bg-dash-bg border border-dash-border rounded-lg
					text-dash-text placeholder-dash-text-muted
					focus:outline-none focus:ring-2 focus:ring-dash-accent/50 focus:border-dash-accent
					disabled:opacity-50 disabled:cursor-not-allowed
					transition-colors"
				placeholder="Enter passphrase..."
			/>
			<button
				type="button"
				onClick={() => setShow(!show)}
				className="absolute right-2 top-1/2 -translate-y-1/2 text-dash-text-muted hover:text-dash-text transition-colors"
			>
				{show ? (
					<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
						/>
					</svg>
				) : (
					<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
						/>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
						/>
					</svg>
				)}
			</button>
		</div>
	);
};
