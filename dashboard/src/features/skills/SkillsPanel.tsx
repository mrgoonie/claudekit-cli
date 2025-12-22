import { Zap, Check } from "lucide-react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useSkills } from "./hooks/useSkills";

export function SkillsPanel() {
	const { skills, loading, error } = useSkills();

	if (loading) {
		return (
			<Card>
				<CardContent className="py-4 text-center text-muted-foreground">
					Loading skills...
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card>
				<CardContent className="py-4 text-center text-destructive">
					{error}
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-sm font-medium flex items-center gap-2">
					<Zap className="h-4 w-4" />
					Skills ({skills.length} available)
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2 max-h-48 overflow-y-auto">
				{skills.slice(0, 10).map((skill) => (
					<div key={skill.id} className="flex items-start gap-2 text-sm">
						<Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
						<div className="min-w-0">
							<div className="font-medium">{skill.name}</div>
							<div className="text-muted-foreground text-xs line-clamp-1">
								{skill.description}
							</div>
						</div>
					</div>
				))}
				{skills.length === 0 && (
					<div className="text-muted-foreground text-sm text-center py-2">
						No skills available
					</div>
				)}
			</CardContent>
		</Card>
	);
}
