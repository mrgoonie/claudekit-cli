import { LayoutDashboard, Settings, FileCode, Zap } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { useProject } from "../contexts/ProjectContext";
import { Link } from "@tanstack/react-router";

export function DashboardPage() {
	const { currentProject } = useProject();

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
				<p className="text-gray-500">
					Overview of {currentProject?.name ?? "your project"}
				</p>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium text-gray-500">
							Configuration
						</CardTitle>
						<Settings className="h-4 w-4 text-gray-400" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">2 files</div>
						<p className="text-xs text-gray-500">global + local</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium text-gray-500">
							Skills
						</CardTitle>
						<Zap className="h-4 w-4 text-gray-400" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">12</div>
						<p className="text-xs text-gray-500">available</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium text-gray-500">
							CLAUDE.md
						</CardTitle>
						<FileCode className="h-4 w-4 text-gray-400" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">1</div>
						<p className="text-xs text-gray-500">active</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium text-gray-500">
							Health
						</CardTitle>
						<LayoutDashboard className="h-4 w-4 text-gray-400" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-green-600">Good</div>
						<p className="text-xs text-gray-500">0 issues</p>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Quick Actions</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					<Link
						to="/config"
						className="block p-3 rounded-md border hover:bg-gray-50 transition-colors"
					>
						<div className="flex items-center gap-3">
							<Settings className="h-5 w-5 text-gray-400" />
							<div>
								<div className="font-medium">Edit Configuration</div>
								<div className="text-sm text-gray-500">
									Modify settings.json values
								</div>
							</div>
						</div>
					</Link>
				</CardContent>
			</Card>
		</div>
	);
}
