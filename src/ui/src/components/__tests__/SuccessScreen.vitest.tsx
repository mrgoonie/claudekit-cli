/**
 * Tests for SuccessScreen component
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KitType } from "../../types";
import SuccessScreen from "../SuccessScreen";

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
	useNavigate: () => mockNavigate,
}));

// Mock useI18n hook
vi.mock("../../i18n", () => ({
	useI18n: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				installSuccess: "Installation Complete!",
				installSuccessDesc: "You have successfully installed {kit}.",
				getStarted: "Get Started",
				goToDashboard: "Go to Dashboard",
				kitEngineerName: "ClaudeKit Engineer",
				kitMarketingName: "ClaudeKit Marketing",
			};
			return translations[key] || key;
		},
	}),
}));

describe("SuccessScreen", () => {
	const defaultProps = {
		kit: KitType.ENGINEER,
		onGetStarted: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Rendering", () => {
		it("renders with data-testid", () => {
			render(<SuccessScreen {...defaultProps} />);
			expect(screen.getByTestId("success-screen")).toBeInTheDocument();
		});

		it("renders success message", () => {
			render(<SuccessScreen {...defaultProps} />);
			expect(screen.getByText("Installation Complete!")).toBeInTheDocument();
		});

		it("renders success icon", () => {
			const { container } = render(<SuccessScreen {...defaultProps} />);
			const svg = container.querySelector("svg");
			expect(svg).toBeInTheDocument();
			expect(svg?.classList.contains("text-green-600")).toBe(true);
		});

		it("renders get started button", () => {
			render(<SuccessScreen {...defaultProps} />);
			expect(screen.getByTestId("get-started-btn")).toBeInTheDocument();
			expect(screen.getByText("Get Started")).toBeInTheDocument();
		});

		it("renders dashboard button", () => {
			render(<SuccessScreen {...defaultProps} />);
			expect(screen.getByTestId("dashboard-btn")).toBeInTheDocument();
			expect(screen.getByText("Go to Dashboard")).toBeInTheDocument();
		});
	});

	describe("Kit Name Display", () => {
		it("displays Engineer kit name when kit is ENGINEER", () => {
			render(<SuccessScreen {...defaultProps} kit={KitType.ENGINEER} />);
			expect(screen.getByText(/ClaudeKit Engineer/)).toBeInTheDocument();
		});

		it("displays Marketing kit name when kit is MARKETING", () => {
			render(<SuccessScreen {...defaultProps} kit={KitType.MARKETING} />);
			expect(screen.getByText(/ClaudeKit Marketing/)).toBeInTheDocument();
		});
	});

	describe("Callbacks", () => {
		it("calls onGetStarted when Get Started button is clicked", () => {
			const onGetStarted = vi.fn();
			render(<SuccessScreen {...defaultProps} onGetStarted={onGetStarted} />);
			fireEvent.click(screen.getByTestId("get-started-btn"));
			expect(onGetStarted).toHaveBeenCalledTimes(1);
		});

		it("navigates to dashboard when Dashboard button is clicked", () => {
			render(<SuccessScreen {...defaultProps} />);
			fireEvent.click(screen.getByTestId("dashboard-btn"));
			expect(mockNavigate).toHaveBeenCalledWith("/");
		});
	});

	describe("Edge Cases", () => {
		it("handles multiple Get Started clicks", () => {
			const onGetStarted = vi.fn();
			render(<SuccessScreen {...defaultProps} onGetStarted={onGetStarted} />);
			const btn = screen.getByTestId("get-started-btn");
			fireEvent.click(btn);
			fireEvent.click(btn);
			fireEvent.click(btn);
			expect(onGetStarted).toHaveBeenCalledTimes(3);
		});
	});
});
