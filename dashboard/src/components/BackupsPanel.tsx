import { useCallback, useEffect, useState } from "react";
import { fetchBackups, restoreBackup } from "../api/config";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface BackupsPanelProps {
	scope: "global" | "local";
	onRestore: () => void;
}

export function BackupsPanel({ scope, onRestore }: BackupsPanelProps) {
	const [backups, setBackups] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [restoring, setRestoring] = useState<string | null>(null);
	const [confirmFilename, setConfirmFilename] = useState<string | null>(null);

	const loadBackups = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await fetchBackups(scope);
			setBackups(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load backups");
		} finally {
			setLoading(false);
		}
	}, [scope]);

	useEffect(() => {
		loadBackups();
	}, [loadBackups]);

	const handleRestore = async (filename: string) => {
		if (confirmFilename !== filename) {
			setConfirmFilename(filename);
			return;
		}

		setRestoring(filename);
		setConfirmFilename(null);
		try {
			await restoreBackup(scope, filename);
			onRestore();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to restore backup");
		} finally {
			setRestoring(null);
		}
	};

	const cancelConfirm = () => {
		setConfirmFilename(null);
	};

	const formatTimestamp = (filename: string): string => {
		// Extract timestamp from filename like "settings.json.1734567890123.bak"
		const match = filename.match(/\.(\d{13})\.bak$/);
		if (match) {
			const timestamp = parseInt(match[1], 10);
			return new Date(timestamp).toLocaleString();
		}
		return filename;
	};

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-lg flex items-center justify-between">
					<span>Backups ({scope})</span>
					<Button
						variant="ghost"
						size="sm"
						onClick={loadBackups}
						disabled={loading}
					>
						{loading ? "Loading..." : "Refresh"}
					</Button>
				</CardTitle>
			</CardHeader>
			<CardContent>
				{error && (
					<p className="text-red-500 text-sm mb-3">{error}</p>
				)}

				{!loading && backups.length === 0 && (
					<p className="text-gray-500 text-sm">No backups available</p>
				)}

				{backups.length > 0 && (
					<div className="space-y-2 max-h-64 overflow-y-auto">
						{backups.map((filename) => (
							<div
								key={filename}
								className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md text-sm"
							>
								<div className="flex-1 min-w-0 mr-3">
									<p className="font-mono text-xs text-gray-600 truncate" title={filename}>
										{filename}
									</p>
									<p className="text-xs text-gray-400">
										{formatTimestamp(filename)}
									</p>
								</div>
								<div className="flex gap-2">
									{confirmFilename === filename ? (
										<>
											<Button
												variant="destructive"
												size="sm"
												onClick={() => handleRestore(filename)}
												disabled={restoring === filename}
											>
												{restoring === filename ? "Restoring..." : "Confirm"}
											</Button>
											<Button
												variant="outline"
												size="sm"
												onClick={cancelConfirm}
												disabled={restoring === filename}
											>
												Cancel
											</Button>
										</>
									) : (
										<Button
											variant="outline"
											size="sm"
											onClick={() => handleRestore(filename)}
											disabled={restoring !== null}
										>
											Restore
										</Button>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
