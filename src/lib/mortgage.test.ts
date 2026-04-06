import { describe, expect, it } from "vite-plus/test";
import { TAX_DEDUCTION_RATE, calculateMortgage } from "./mortgage";

describe("TAX_DEDUCTION_RATE", () => {
  it("is 26%", () => {
    expect(TAX_DEDUCTION_RATE).toBe(0.26);
  });
});

describe("calculateMortgage", () => {
  const baseInput = {
    remainingAmount: 2_000_000,
    remainingYears: 20,
    interestRate: 4,
    contributionRate: 0.6,
    extraPayment: 200_000,
    fee: 1_500,
  };

  it("reduces the remaining amount by the extra payment", () => {
    const result = calculateMortgage(baseInput);
    expect(result.newRemainingAmount).toBe(baseInput.remainingAmount - baseInput.extraPayment);
  });

  it("includes the fee in the total cost", () => {
    const result = calculateMortgage(baseInput);
    expect(result.totalCost).toBe(baseInput.extraPayment + baseInput.fee);
  });

  it("lowers the quarterly payment when keeping the same term", () => {
    const result = calculateMortgage(baseInput);
    expect(result.newQuarterlyPaymentSameTerm).toBeLessThan(result.currentQuarterlyPayment);
  });

  it("reports a positive quarterly payment saving for same-term option", () => {
    const result = calculateMortgage(baseInput);
    expect(result.quarterlyPaymentSaving).toBeGreaterThan(0);
    expect(result.annualPaymentSaving).toBeCloseTo(result.quarterlyPaymentSaving * 4, 6);
  });

  it("saves interest over the loan lifetime (same-term option)", () => {
    const result = calculateMortgage(baseInput);
    expect(result.totalInterestSavedSameTerm).toBeGreaterThan(0);
  });

  it("shortens the loan term when keeping the same payment", () => {
    const result = calculateMortgage(baseInput);
    expect(result.quartersSaved).toBeGreaterThan(0);
    expect(result.yearsSaved).toBeCloseTo(result.quartersSaved / 4, 10);
    expect(result.newRemainingQuartersSamePayment).toBeLessThan(baseInput.remainingYears * 4);
  });

  it("saves interest over the loan lifetime (same-payment option)", () => {
    const result = calculateMortgage(baseInput);
    expect(result.totalInterestSavedSamePayment).toBeGreaterThan(0);
  });

  it("saving more interest with same-payment option than same-term option", () => {
    const result = calculateMortgage(baseInput);
    expect(result.totalInterestSavedSamePayment).toBeGreaterThan(result.totalInterestSavedSameTerm);
  });

  it("reduces annual interest after the extra payment", () => {
    const result = calculateMortgage(baseInput);
    expect(result.newAnnualInterest).toBeLessThan(result.currentAnnualInterest);
  });

  it("computes tax deductions at the configured rate", () => {
    const result = calculateMortgage(baseInput);
    expect(result.currentAnnualTaxDeduction).toBeCloseTo(
      result.currentAnnualInterest * TAX_DEDUCTION_RATE,
      6,
    );
    expect(result.newAnnualTaxDeduction).toBeCloseTo(
      result.newAnnualInterest * TAX_DEDUCTION_RATE,
      6,
    );
  });

  it("reports a negative tax deduction change (reduced deduction)", () => {
    const result = calculateMortgage(baseInput);
    expect(result.taxDeductionChange).toBeLessThan(0);
    expect(result.taxDeductionChange).toBeCloseTo(
      result.newAnnualTaxDeduction - result.currentAnnualTaxDeduction,
      6,
    );
  });

  it("handles zero extra payment (no change)", () => {
    const result = calculateMortgage({ ...baseInput, extraPayment: 0, fee: 0 });
    expect(result.newRemainingAmount).toBe(baseInput.remainingAmount);
    expect(result.totalCost).toBe(0);
    expect(result.quarterlyPaymentSaving).toBeCloseTo(0, 6);
    expect(result.quartersSaved).toBe(0);
  });

  it("clamps new remaining amount to zero when extra payment exceeds balance", () => {
    const result = calculateMortgage({ ...baseInput, extraPayment: 3_000_000 });
    expect(result.newRemainingAmount).toBe(0);
    expect(result.newQuarterlyPaymentSameTerm).toBe(0);
    expect(result.newAnnualInterest).toBe(0);
  });

  it("works with zero interest rate", () => {
    const result = calculateMortgage({
      ...baseInput,
      interestRate: 0,
      contributionRate: 0,
      extraPayment: 200_000,
      fee: 0,
    });
    expect(result.newRemainingAmount).toBe(1_800_000);
    // With zero combined rate, quarterly payment = principal / quarters
    const nQuarters = baseInput.remainingYears * 4;
    expect(result.currentQuarterlyPayment).toBeCloseTo(baseInput.remainingAmount / nQuarters, 4);
    expect(result.newQuarterlyPaymentSameTerm).toBeCloseTo(1_800_000 / nQuarters, 4);
  });

  it("returns sensible values for a small loan near end of term", () => {
    const result = calculateMortgage({
      remainingAmount: 50_000,
      remainingYears: 1,
      interestRate: 3,
      contributionRate: 0.5,
      extraPayment: 10_000,
      fee: 200,
    });
    expect(result.newRemainingAmount).toBe(40_000);
    expect(result.totalCost).toBe(10_200);
    expect(result.quarterlyPaymentSaving).toBeGreaterThan(0);
  });
});
