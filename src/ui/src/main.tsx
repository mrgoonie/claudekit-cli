import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { I18nProvider } from "./i18n";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
	document.body.innerHTML =
		'<div style="padding:20px;color:red;">Fatal: Root element not found</div>';
	throw new Error("Root element #root not found");
}

ReactDOM.createRoot(rootElement).render(
	<React.StrictMode>
		<I18nProvider>
			<ErrorBoundary>
				<App />
			</ErrorBoundary>
		</I18nProvider>
	</React.StrictMode>,
);
