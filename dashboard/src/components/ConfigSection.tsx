import type { TracedValue } from "../api/config";
import { SourceBadge } from "./SourceBadge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface ConfigSectionProps {
	title: string;
	fields: Array<{
		key: string;
		label: string;
		traced?: TracedValue;
		pendingValue?: unknown;
	}>;
	onFieldChange: (key: string, value: string) => void;
}

export function ConfigSection({ title, fields, onFieldChange }: ConfigSectionProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-lg">{title}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{fields.map(({ key, label, traced, pendingValue }) => {
					const currentValue =
						pendingValue !== undefined
							? String(pendingValue)
							: traced?.value !== undefined
								? String(traced.value)
								: "";

					const hasChange = pendingValue !== undefined && pendingValue !== traced?.value;

					return (
						<div key={key} className="space-y-2">
							<div className="flex items-center justify-between">
								<Label htmlFor={key}>{label}</Label>
								{traced && <SourceBadge source={traced.source} />}
							</div>
							<Input
								id={key}
								value={currentValue}
								onChange={(e) => onFieldChange(key, e.target.value)}
								className={hasChange ? "border-yellow-400 bg-yellow-50" : ""}
							/>
							{hasChange && (
								<p className="text-xs text-yellow-600">Changed from: {String(traced?.value)}</p>
							)}
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}
