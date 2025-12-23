import type React from "react";
import { Component, type ReactNode } from "react";

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	state: State = { hasError: false, error: null };

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, info: React.ErrorInfo) {
		console.error("App error:", error, info.componentStack);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="flex h-screen items-center justify-center bg-dash-bg">
					<div className="text-center space-y-4">
						<h1 className="text-2xl font-bold text-red-500">Something went wrong</h1>
						<p className="text-dash-text-muted">{this.state.error?.message}</p>
						<button
							onClick={() => window.location.reload()}
							className="px-4 py-2 bg-dash-accent text-white rounded-md hover:opacity-90"
						>
							Reload App
						</button>
					</div>
				</div>
			);
		}
		return this.props.children;
	}
}
