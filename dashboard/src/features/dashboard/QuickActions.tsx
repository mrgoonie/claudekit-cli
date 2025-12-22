import { Terminal, Code, Zap, Loader2, Play } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	openTerminal,
	openEditor,
	launchClaude,
	executeCcsCommand,
} from "@/api/actions";
import { useToast } from "@/hooks/useToast";

interface QuickActionsProps {
	projectPath: string;
}

export function QuickActions({ projectPath }: QuickActionsProps) {
	const [loading, setLoading] = useState<string | null>(null);
	const [ccsCommand, setCcsCommand] = useState("");
	const { toast } = useToast();

	const handleAction = async (action: "terminal" | "editor" | "claude") => {
		setLoading(action);
		try {
			if (action === "terminal") await openTerminal(projectPath);
			else if (action === "editor") await openEditor(projectPath);
			else await launchClaude(projectPath);
			toast({ title: `Opened ${action}`, variant: "default" });
		} catch (e) {
			toast({
				title: `Failed to open ${action}`,
				description: e instanceof Error ? e.message : "Unknown error",
				variant: "destructive",
			});
		} finally {
			setLoading(null);
		}
	};

	const handleCcsCommand = async (e: FormEvent) => {
		e.preventDefault();
		if (!ccsCommand.trim()) return;

		setLoading("ccs");
		try {
			const result = await executeCcsCommand(ccsCommand, projectPath);
			if (result.exitCode === 0) {
				toast({
					title: "Command executed",
					description: result.stdout.slice(0, 100) || "Success",
					variant: "default",
				});
			} else {
				toast({
					title: "Command failed",
					description: result.stderr.slice(0, 100) || `Exit code: ${result.exitCode}`,
					variant: "destructive",
				});
			}
			setCcsCommand("");
		} catch (e) {
			toast({
				title: "Failed to execute command",
				description: e instanceof Error ? e.message : "Unknown error",
				variant: "destructive",
			});
		} finally {
			setLoading(null);
		}
	};

	return (
		<div className="flex flex-wrap items-center gap-2">
			<Button
				variant="outline"
				size="sm"
				onClick={() => handleAction("terminal")}
				disabled={loading !== null}
			>
				{loading === "terminal" ? (
					<Loader2 className="h-4 w-4 animate-spin" />
				) : (
					<Terminal className="h-4 w-4" />
				)}
				<span className="ml-1">Terminal</span>
			</Button>
			<Button
				variant="outline"
				size="sm"
				onClick={() => handleAction("editor")}
				disabled={loading !== null}
			>
				{loading === "editor" ? (
					<Loader2 className="h-4 w-4 animate-spin" />
				) : (
					<Code className="h-4 w-4" />
				)}
				<span className="ml-1">Editor</span>
			</Button>
			<Button
				variant="outline"
				size="sm"
				onClick={() => handleAction("claude")}
				disabled={loading !== null}
			>
				{loading === "claude" ? (
					<Loader2 className="h-4 w-4 animate-spin" />
				) : (
					<Zap className="h-4 w-4" />
				)}
				<span className="ml-1">Claude</span>
			</Button>

			<form onSubmit={handleCcsCommand} className="flex items-center gap-1">
				<Input
					type="text"
					placeholder="ccs command..."
					value={ccsCommand}
					onChange={(e) => setCcsCommand(e.target.value)}
					disabled={loading !== null}
					className="h-9 w-40 text-sm"
				/>
				<Button
					type="submit"
					variant="outline"
					size="sm"
					disabled={loading !== null || !ccsCommand.trim()}
				>
					{loading === "ccs" ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Play className="h-4 w-4" />
					)}
				</Button>
			</form>
		</div>
	);
}
