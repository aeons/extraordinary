import { describe, expect, it } from "vite-plus/test";
import { TAX_DEDUCTION_RATE, calculateMortgage } from "./mortgage";

describe("TAX_DEDUCTION_RATE", () => {
  it("is 26%", () => {
    expect(TAX_DEDUCTION_RATE).toBe(0.26);
  });
});

describe("calculateMortgage", () => {
  // payment includes the fee; at bondRate 100 the net cash equals the debt reduction.
  // payment=201_500, fee=1_500, bondRate=100 → netCash=200_000 → debtReduction=200_000.
  const baseInput = {
    remainingAmount: 2_000_000,
    remainingYears: 20,
    interestRate: 4,
    contributionRate: 0.6,
    payment: 201_500,
    bondRate: 100,
    fee: 1_500,
  };

  it("reduces the remaining amount by the debt reduction", () => {
    const result = calculateMortgage(baseInput);
    expect(result.newRemainingAmount).toBe(baseInput.remainingAmount - result.debtReduction);
  });

  it("subtracts the fee before calculating debt reduction", () => {
    const result = calculateMortgage(baseInput);
    // netCash = payment - fee; debtReduction = netCash * 100 / bondRate
    const expectedDebtReduction = ((baseInput.payment - baseInput.fee) * 100) / baseInput.bondRate;
    expect(result.debtReduction).toBeCloseTo(expectedDebtReduction, 6);
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

  it("saves more interest with same-payment option than same-term option", () => {
    const result = calculateMortgage(baseInput);
    expect(result.totalInterestSavedSamePayment).toBeGreaterThan(result.totalInterestSavedSameTerm);
  });

  it("reduces annual interest after the extraordinary payment", () => {
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

  it("handles zero payment (no change)", () => {
    const result = calculateMortgage({ ...baseInput, payment: 0, fee: 0 });
    expect(result.debtReduction).toBe(0);
    expect(result.newRemainingAmount).toBe(baseInput.remainingAmount);
    expect(result.quarterlyPaymentSaving).toBeCloseTo(0, 6);
    expect(result.quartersSaved).toBe(0);
  });

  it("clamps new remaining amount to zero when payment exceeds balance", () => {
    const result = calculateMortgage({ ...baseInput, payment: 3_000_000, fee: 0 });
    expect(result.newRemainingAmount).toBe(0);
    expect(result.newQuarterlyPaymentSameTerm).toBe(0);
    expect(result.newAnnualInterest).toBe(0);
  });

  it("works with zero interest rate", () => {
    const result = calculateMortgage({
      ...baseInput,
      interestRate: 0,
      contributionRate: 0,
      payment: 200_000,
      fee: 0,
    });
    expect(result.newRemainingAmount).toBe(1_800_000);
    // With zero combined rate, quarterly payment = principal / quarters
    const nQuarters = baseInput.remainingYears * 4;
    expect(result.currentQuarterlyPayment).toBeCloseTo(baseInput.remainingAmount / nQuarters, 4);
    expect(result.newQuarterlyPaymentSameTerm).toBeCloseTo(1_800_000 / nQuarters, 4);
  });

  it("returns sensible values for a small loan near end of term", () => {
    // payment=10_200, fee=200, bondRate=100 → netCash=10_000 → debtReduction=10_000
    const result = calculateMortgage({
      remainingAmount: 50_000,
      remainingYears: 1,
      interestRate: 3,
      contributionRate: 0.5,
      payment: 10_200,
      bondRate: 100,
      fee: 200,
    });
    expect(result.newRemainingAmount).toBe(40_000);
    expect(result.debtReduction).toBe(10_000);
    expect(result.quarterlyPaymentSaving).toBeGreaterThan(0);
  });

  describe("bond rate", () => {
    it("bond rate below par amplifies debt reduction (pay less, reduce more)", () => {
      // bondRate 95: paying 95 DKK reduces debt by 100 DKK
      // payment=95_000, fee=0, bondRate=95 → netCash=95_000 → debtReduction=100_000
      const result = calculateMortgage({ ...baseInput, payment: 95_000, bondRate: 95, fee: 0 });
      expect(result.debtReduction).toBeCloseTo(100_000, 4);
    });

    it("bond rate above par reduces debt reduction (pay more, reduce less)", () => {
      // bondRate 105: paying 105 DKK reduces debt by 100 DKK
      // payment=105_000, fee=0, bondRate=105 → netCash=105_000 → debtReduction≈100_000
      const result = calculateMortgage({ ...baseInput, payment: 105_000, bondRate: 105, fee: 0 });
      expect(result.debtReduction).toBeCloseTo(100_000, 4);
    });

    it("bond rate 100 (at par) gives debtReduction equal to net cash", () => {
      const result = calculateMortgage({ ...baseInput, payment: 200_000, bondRate: 100, fee: 0 });
      expect(result.debtReduction).toBeCloseTo(200_000, 6);
    });

    it("fee is subtracted from payment before applying bond rate", () => {
      // payment=200_000, fee=5_000, bondRate=95 → netCash=195_000 → debtReduction=205_263.16
      const result = calculateMortgage({
        ...baseInput,
        payment: 200_000,
        bondRate: 95,
        fee: 5_000,
      });
      expect(result.debtReduction).toBeCloseTo((195_000 * 100) / 95, 4);
    });

    it("lower bond rate leads to larger debt reduction for the same cash outlay", () => {
      const atPar = calculateMortgage({ ...baseInput, payment: 200_000, bondRate: 100, fee: 0 });
      const belowPar = calculateMortgage({ ...baseInput, payment: 200_000, bondRate: 90, fee: 0 });
      expect(belowPar.debtReduction).toBeGreaterThan(atPar.debtReduction);
    });

    it("bondRateSavings is zero at par (bond rate 100)", () => {
      const result = calculateMortgage({ ...baseInput, payment: 200_000, bondRate: 100, fee: 0 });
      expect(result.bondRateSavings).toBeCloseTo(0, 6);
    });

    it("bondRateSavings is positive when bond rate is below par", () => {
      // bondRate 95: pay 95_000, reduce debt by 100_000 → savings = 5_000
      const result = calculateMortgage({ ...baseInput, payment: 95_000, bondRate: 95, fee: 0 });
      expect(result.bondRateSavings).toBeCloseTo(100_000 - 95_000, 4);
    });

    it("bondRateSavings is negative when bond rate is above par", () => {
      // bondRate 105: pay 105_000, reduce debt by ~100_000 → savings ≈ -5_000
      const result = calculateMortgage({ ...baseInput, payment: 105_000, bondRate: 105, fee: 0 });
      expect(result.bondRateSavings).toBeLessThan(0);
      expect(result.bondRateSavings).toBeCloseTo((105_000 * 100) / 105 - 105_000, 4);
    });

    it("bondRateSavings equals debtReduction minus net cash", () => {
      const result = calculateMortgage({ ...baseInput, payment: 200_000, bondRate: 95, fee: 5_000 });
      const netCash = 200_000 - 5_000;
      expect(result.bondRateSavings).toBeCloseTo(result.debtReduction - netCash, 6);
    });
  });
});
