/**
 * Tests for InstallWizard component
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KitType } from "../../types";
import InstallWizard from "../InstallWizard";

// Mock useI18n hook
vi.mock("../../i18n", () => ({
	useI18n: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				stepChooseKit: "Choose Kit",
				stepConfigure: "Configure",
				stepInstall: "Install",
				back: "Back",
				next: "Next",
				install: "Install",
				kitEngineerName: "ClaudeKit Engineer",
				kitMarketingName: "ClaudeKit Marketing",
			};
			return translations[key] || key;
		},
	}),
}));

describe("InstallWizard", () => {
	const defaultProps = {
		selectedKit: KitType.ENGINEER,
		onKitSelect: vi.fn(),
		onInstall: vi.fn(),
		installing: false,
	};

	describe("Rendering", () => {
		it("renders with data-testid", () => {
			render(<InstallWizard {...defaultProps} />);
			expect(screen.getByTestId("install-wizard")).toBeInTheDocument();
		});

		it("renders all 3 step indicators", () => {
			render(<InstallWizard {...defaultProps} />);
			expect(screen.getByText("Choose Kit")).toBeInTheDocument();
			expect(screen.getByText("Configure")).toBeInTheDocument();
			expect(screen.getByText("Install")).toBeInTheDocument();
		});

		it("shows step 1 content initially", () => {
			render(<InstallWizard {...defaultProps} />);
			expect(screen.getByText(/Selected: ClaudeKit Engineer/)).toBeInTheDocument();
		});
	});

	describe("Navigation", () => {
		it("does not show Back button on step 1", () => {
			render(<InstallWizard {...defaultProps} />);
			expect(screen.queryByTestId("wizard-back")).not.toBeInTheDocument();
		});

		it("shows Next button on step 1 when kit selected", () => {
			render(<InstallWizard {...defaultProps} />);
			expect(screen.getByTestId("wizard-next")).toBeInTheDocument();
		});

		it("advances to step 2 when Next is clicked", () => {
			render(<InstallWizard {...defaultProps} />);
			fireEvent.click(screen.getByTestId("wizard-next"));
			// Step 2 shows configuration preview
			expect(screen.getByText("Configuration preview placeholder")).toBeInTheDocument();
		});

		it("shows Back button on step 2", () => {
			render(<InstallWizard {...defaultProps} />);
			fireEvent.click(screen.getByTestId("wizard-next")); // Go to step 2
			expect(screen.getByTestId("wizard-back")).toBeInTheDocument();
		});

		it("returns to step 1 when Back is clicked on step 2", () => {
			render(<InstallWizard {...defaultProps} />);
			fireEvent.click(screen.getByTestId("wizard-next")); // Go to step 2
			fireEvent.click(screen.getByTestId("wizard-back")); // Go back to step 1
			expect(screen.getByText(/Selected: ClaudeKit Engineer/)).toBeInTheDocument();
		});

		it("advances to step 3 from step 2", () => {
			render(<InstallWizard {...defaultProps} />);
			fireEvent.click(screen.getByTestId("wizard-next")); // Go to step 2
			fireEvent.click(screen.getByTestId("wizard-next")); // Go to step 3
			expect(screen.getByText("Ready to install")).toBeInTheDocument();
		});

		it("shows Install button on step 3", () => {
			render(<InstallWizard {...defaultProps} />);
			fireEvent.click(screen.getByTestId("wizard-next")); // Step 2
			fireEvent.click(screen.getByTestId("wizard-next")); // Step 3
			expect(screen.getByTestId("wizard-install")).toBeInTheDocument();
		});
	});

	describe("Callbacks", () => {
		it("calls onInstall when Install button is clicked", () => {
			const onInstall = vi.fn();
			render(<InstallWizard {...defaultProps} onInstall={onInstall} />);
			fireEvent.click(screen.getByTestId("wizard-next")); // Step 2
			fireEvent.click(screen.getByTestId("wizard-next")); // Step 3
			fireEvent.click(screen.getByTestId("wizard-install"));
			expect(onInstall).toHaveBeenCalledTimes(1);
		});

		it("disables Install button when installing is true", () => {
			render(<InstallWizard {...defaultProps} installing={true} />);
			fireEvent.click(screen.getByTestId("wizard-next")); // Step 2
			fireEvent.click(screen.getByTestId("wizard-next")); // Step 3
			expect(screen.getByTestId("wizard-install")).toBeDisabled();
		});

		it("shows Installing... text when installing", () => {
			render(<InstallWizard {...defaultProps} installing={true} />);
			fireEvent.click(screen.getByTestId("wizard-next")); // Step 2
			fireEvent.click(screen.getByTestId("wizard-next")); // Step 3
			expect(screen.getByText("Installing...")).toBeInTheDocument();
		});

		it("calls onKitSelect when switch kit button is clicked", () => {
			const onKitSelect = vi.fn();
			render(<InstallWizard {...defaultProps} onKitSelect={onKitSelect} />);
			const switchButton = screen.getByText(/Switch to ClaudeKit Marketing/);
			fireEvent.click(switchButton);
			expect(onKitSelect).toHaveBeenCalledWith(KitType.MARKETING);
		});
	});

	describe("Kit Selection", () => {
		it("shows Marketing kit switch option when Engineer selected", () => {
			render(<InstallWizard {...defaultProps} selectedKit={KitType.ENGINEER} />);
			expect(screen.getByText(/Switch to ClaudeKit Marketing/)).toBeInTheDocument();
		});

		it("shows Engineer kit switch option when Marketing selected", () => {
			render(<InstallWizard {...defaultProps} selectedKit={KitType.MARKETING} />);
			expect(screen.getByText(/Switch to ClaudeKit Engineer/)).toBeInTheDocument();
		});

		it("shows prompt when no kit selected", () => {
			render(<InstallWizard {...defaultProps} selectedKit={null} />);
			expect(screen.getByText("Please select a kit above")).toBeInTheDocument();
		});
	});
});
