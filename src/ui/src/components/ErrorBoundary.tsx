import type React from "react";
import { Component, type ReactNode } from "react";
import { I18nContext } from "../i18n";

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
			const isServerError = this.state.error?.name === "ServerUnavailableError";

			return (
				<I18nContext.Consumer>
					{(i18n) => (
						<div className="flex h-screen items-center justify-center bg-dash-bg">
							<div className="text-center space-y-4 max-w-md px-6">
								{isServerError ? (
									<>
										<div className="w-16 h-16 mx-auto rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-3xl">
											🔌
										</div>
										<h1 className="text-2xl font-bold text-orange-500">
											{i18n?.t("serverNotRunning") ?? "Server Not Running"}
										</h1>
										<p className="text-dash-text-secondary">
											{i18n?.t("startServerMessage") ??
												"The Config UI requires the backend server to be running."}
										</p>
										<div className="bg-dash-surface border border-dash-border rounded-lg p-4">
											<p className="text-xs text-dash-text-muted uppercase tracking-widest mb-2 font-bold">
												{i18n?.t("runThisCommand") ?? "Run this command"}
											</p>
											<code className="block text-sm text-dash-accent font-mono bg-dash-bg px-3 py-2 rounded border border-dash-border">
												ck config
											</code>
										</div>
										<button
											onClick={() => window.location.reload()}
											className="px-6 py-2 bg-dash-accent text-dash-bg rounded-lg font-bold hover:bg-dash-accent-hover transition-colors"
										>
											{i18n?.t("tryAgain") ?? "Try Again"}
										</button>
									</>
								) : (
									<>
										<h1 className="text-2xl font-bold text-red-500">
											{i18n?.t("somethingWentWrong") ?? "Something went wrong"}
										</h1>
										<p className="text-dash-text-muted">{this.state.error?.message}</p>
										<button
											onClick={() => window.location.reload()}
											className="px-4 py-2 bg-dash-accent text-white rounded-md hover:opacity-90"
										>
											{i18n?.t("reloadApp") ?? "Reload App"}
										</button>
									</>
								)}
							</div>
						</div>
					)}
				</I18nContext.Consumer>
			);
		}
		return this.props.children;
	}
}
