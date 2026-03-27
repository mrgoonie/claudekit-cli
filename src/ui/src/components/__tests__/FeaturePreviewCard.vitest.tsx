/**
 * Tests for FeaturePreviewCard component
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TranslationKey } from "../../i18n";
import FeaturePreviewCard from "../FeaturePreviewCard";

// Mock useI18n hook
vi.mock("../../i18n", () => ({
	useI18n: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				featureAgents: "AI Agents",
				featureAgentsDesc: "Specialized agents for different tasks",
				featureHooks: "Lifecycle Hooks",
				featureHooksDesc: "Customize Claude behavior",
			};
			return translations[key] || key;
		},
	}),
}));

describe("FeaturePreviewCard", () => {
	const defaultProps = {
		featureId: "agents",
		name: "featureAgents" as TranslationKey,
		description: "featureAgentsDesc" as TranslationKey,
		included: true,
	};

	describe("Rendering", () => {
		it("renders with correct data-testid", () => {
			render(<FeaturePreviewCard {...defaultProps} />);
			expect(screen.getByTestId("feature-card-agents")).toBeInTheDocument();
		});

		it("renders translated name and description", () => {
			render(<FeaturePreviewCard {...defaultProps} />);
			expect(screen.getByText("AI Agents")).toBeInTheDocument();
			expect(screen.getByText("Specialized agents for different tasks")).toBeInTheDocument();
		});

		it("shows check icon when included is true", () => {
			const { container } = render(<FeaturePreviewCard {...defaultProps} included={true} />);
			const svg = container.querySelector("svg");
			expect(svg).toBeInTheDocument();
			expect(svg?.querySelector("path[d*='M5 13l4 4L19 7']")).toBeInTheDocument();
		});

		it("shows X icon when included is false", () => {
			const { container } = render(<FeaturePreviewCard {...defaultProps} included={false} />);
			const svg = container.querySelector("svg");
			expect(svg).toBeInTheDocument();
			expect(svg?.querySelector("path[d*='M6 18L18 6M6 6l12 12']")).toBeInTheDocument();
		});
	});

	describe("Styling", () => {
		it("applies included styling when included is true", () => {
			render(<FeaturePreviewCard {...defaultProps} included={true} />);
			const card = screen.getByTestId("feature-card-agents");
			expect(card.className).toContain("border-[var(--dash-accent)]");
		});

		it("applies excluded styling when included is false", () => {
			render(<FeaturePreviewCard {...defaultProps} included={false} />);
			const card = screen.getByTestId("feature-card-agents");
			expect(card.className).toContain("opacity-50");
			expect(card.className).toContain("border-[var(--dash-border)]");
		});
	});

	describe("Edge Cases", () => {
		it("handles different feature IDs", () => {
			render(<FeaturePreviewCard {...defaultProps} featureId="custom-feature" />);
			expect(screen.getByTestId("feature-card-custom-feature")).toBeInTheDocument();
		});

		it("renders with hooks feature", () => {
			render(
				<FeaturePreviewCard
					featureId="hooks"
					name={"featureHooks" as TranslationKey}
					description={"featureHooksDesc" as TranslationKey}
					included={true}
				/>,
			);
			expect(screen.getByText("Lifecycle Hooks")).toBeInTheDocument();
		});
	});
});
