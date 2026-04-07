/**
 * SystemPage — home page showing system health, versions, env, and hook diagnostics.
 * Replaces the stats-based DashboardPage as the index route (/).
 * Fetches global metadata to power the SystemDashboard component.
 */
import type React from "react";
import { useEffect, useState } from "react";
import SystemDashboard from "../components/system-dashboard";
import { fetchGlobalMetadata } from "../services/api";

const SystemPage: React.FC = () => {
	const [metadata, setMetadata] = useState<Record<string, unknown>>({});

	useEffect(() => {
		fetchGlobalMetadata()
			.then(setMetadata)
			.catch(() => setMetadata({}));
	}, []);

	return (
		<div className="h-full overflow-y-auto">
			<SystemDashboard metadata={metadata} />
		</div>
	);
};

export default SystemPage;
