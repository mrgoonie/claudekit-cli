/**
 * SystemPage — home page showing system health, versions, env, hook diagnostics,
 * and settings.json editor in a resizable 2-column layout.
 * Uses the same panel sizing as GlobalConfigPage for consistent resize behavior.
 */
import type React from "react";
import { useEffect, useState } from "react";
import ResizeHandle from "../components/ResizeHandle";
import SystemDashboard from "../components/system-dashboard";
import SystemSettingsJsonCard from "../components/system-settings-json-card";
import { usePanelSizes } from "../hooks/use-panel-sizes-for-resizable-columns";
import { fetchGlobalMetadata } from "../services/api";

const SystemPage: React.FC = () => {
	const [metadata, setMetadata] = useState<Record<string, unknown>>({});

	// Same panel sizing as the original GlobalConfigPage System tab
	const { sizes, isDragging, startDrag } = usePanelSizes({
		storageKey: "claudekit-global-system-panels",
		defaultSizes: [70, 30],
		minSizes: [45, 20],
	});

	useEffect(() => {
		void fetchGlobalMetadata()
			.then(setMetadata)
			.catch(() => setMetadata({}));
	}, []);

	return (
		<div className="h-full flex min-h-0">
			{/* Left: System Dashboard */}
			<div style={{ width: `${sizes[0]}%` }} className="min-w-0 h-full overflow-auto pr-1">
				<SystemDashboard metadata={metadata} />
			</div>

			{/* Resize handle */}
			<ResizeHandle
				direction="horizontal"
				isDragging={isDragging}
				onMouseDown={(e) => startDrag(0, e)}
			/>

			{/* Right: Settings JSON */}
			<div style={{ width: `${sizes[1]}%` }} className="min-w-0 h-full overflow-hidden">
				<SystemSettingsJsonCard />
			</div>
		</div>
	);
};

export default SystemPage;
