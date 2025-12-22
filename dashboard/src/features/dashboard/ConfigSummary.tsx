import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

interface ConfigSummaryProps {
	config: Record<string, unknown>;
}

export function ConfigSummary({ config }: ConfigSummaryProps) {
	const docsConfig = config.docs as Record<string, unknown> | undefined;
	const plansConfig = config.plans as Record<string, unknown> | undefined;

	const keyValues = [
		{ key: "kit", label: "Kit", value: config.kit || "-" },
		{ key: "docs", label: "Docs", value: docsConfig?.dir || "-" },
		{ key: "plans", label: "Plans", value: plansConfig?.dir || "-" },
	];

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-sm font-medium">Config</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				{keyValues.map(({ key, label, value }) => (
					<div key={key} className="flex justify-between text-sm">
						<span className="text-muted-foreground">{label}</span>
						<span className="font-mono">{String(value)}</span>
					</div>
				))}
			</CardContent>
		</Card>
	);
}
