/**
 * SystemPage — home page showing system health, versions, env, hook diagnostics,
 * and settings.json editor in a resizable 2-column layout.
 * Replaces the stats-based DashboardPage as the index route (/).
 * Mirrors the GlobalConfigPage System tab layout with resizable panels.
 */
import type React from "react";
import { useEffect, useState } from "react";
import ResizeHandle from "../components/ResizeHandle";
import SystemDashboard from "../components/system-dashboard";
import SystemSettingsJsonCard from "../components/system-settings-json-card";
import { useResizable } from "../hooks/useResizable";
import { fetchGlobalMetadata } from "../services/api";

const SystemPage: React.FC = () => {
	const [metadata, setMetadata] = useState<Record<string, unknown>>({});

	const { size, isDragging, startDrag } = useResizable({
		storageKey: "ck-system-panel-width",
		defaultSize: 70, // percentage — left panel gets 70%
		minSize: 40,
		maxSize: 85,
	});

	useEffect(() => {
		fetchGlobalMetadata()
			.then(setMetadata)
			.catch(() => setMetadata({}));
	}, []);

	return (
		<div className="h-full flex min-h-0">
			{/* Left: System Dashboard */}
			<div style={{ width: `${size}%` }} className="min-w-0 h-full overflow-auto">
				<SystemDashboard metadata={metadata} />
			</div>

			{/* Resize handle */}
			<ResizeHandle direction="horizontal" isDragging={isDragging} onMouseDown={startDrag} />

			{/* Right: Settings JSON */}
			<div style={{ width: `${100 - size}%` }} className="min-w-0 h-full overflow-hidden">
				<SystemSettingsJsonCard />
			</div>
		</div>
	);
};

export default SystemPage;
