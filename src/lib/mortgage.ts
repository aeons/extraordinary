/**
 * Mortgage calculation utilities for Danish extraordinary payment calculator.
 *
 * Danish mortgages (realkreditlån) are annuity loans paid quarterly.
 * Payments consist of principal repayment, interest (rente), and contribution fee (bidrag).
 * Only the interest portion is tax-deductible (rentefradrag), not the contribution fee.
 */

/**
 * Approximate Danish tax deduction rate for mortgage interest (rentefradrag).
 * This rate applies to the interest deduction against personal income.
 * The rate is being gradually reduced; verify the current rate for your tax year.
 * Rate for 2025: ~26%.
 */
export const TAX_DEDUCTION_RATE = 0.26;

export interface MortgageInput {
  /** Remaining loan amount in DKK (Restgæld) */
  remainingAmount: number;
  /** Remaining loan duration in years (Restløbetid) */
  remainingYears: number;
  /** Annual interest rate in percent, e.g. 4 for 4% (Rente) */
  interestRate: number;
  /** Annual contribution rate (service fee) in percent, e.g. 0.6 for 0.6% (Bidragsrente) */
  contributionRate: number;
  /** Extraordinary payment amount in DKK (Ekstraordinær betaling) */
  extraPayment: number;
  /** Optional fee for the extraordinary payment in DKK (Gebyr) */
  fee: number;
}

export interface MortgageResult {
  /** New remaining amount after extraordinary payment */
  newRemainingAmount: number;
  /** Total cost of the extraordinary payment (extraPayment + fee) */
  totalCost: number;

  /** Current quarterly payment (principal + interest + bidrag) */
  currentQuarterlyPayment: number;
  /** Current annual interest paid (approximate, based on current balance) */
  currentAnnualInterest: number;
  /** Current annual tax deduction on interest */
  currentAnnualTaxDeduction: number;

  /** New quarterly payment with same remaining term */
  newQuarterlyPaymentSameTerm: number;
  /** Quarterly saving when keeping same remaining term */
  quarterlyPaymentSaving: number;
  /** Annual saving when keeping same remaining term */
  annualPaymentSaving: number;
  /** Total interest saved over loan lifetime (same term, lower payment) */
  totalInterestSavedSameTerm: number;

  /** New remaining quarters when keeping same payment amount */
  newRemainingQuartersSamePayment: number;
  /** Number of quarters by which the loan is shortened */
  quartersSaved: number;
  /** Years by which the loan is shortened */
  yearsSaved: number;
  /** Total interest saved over loan lifetime (same payment, shorter term) */
  totalInterestSavedSamePayment: number;

  /** New annual interest paid (approximate, based on new balance) */
  newAnnualInterest: number;
  /** New annual tax deduction */
  newAnnualTaxDeduction: number;
  /** Change in annual tax deduction (negative = reduced deduction) */
  taxDeductionChange: number;
}

/**
 * Computes the quarterly annuity payment for a loan using the combined rate
 * (interest + contribution rate).
 */
function quarterlyPayment(principal: number, quarterlyRate: number, nQuarters: number): number {
  if (principal <= 0) return 0;
  if (quarterlyRate === 0) return principal / nQuarters;
  return (principal * quarterlyRate) / (1 - Math.pow(1 + quarterlyRate, -nQuarters));
}

/**
 * Computes the total interest and contribution fees paid over the full life of an annuity loan.
 */
function totalCostOverLife(principal: number, quarterlyRate: number, nQuarters: number): number {
  const payment = quarterlyPayment(principal, quarterlyRate, nQuarters);
  return payment * nQuarters - principal;
}

/**
 * Computes the number of quarters needed to repay a loan at a given payment level.
 * Returns a fractional value; callers should ceil for practical use.
 */
function quartersNeeded(principal: number, quarterlyRate: number, payment: number): number {
  if (principal <= 0) return 0;
  if (quarterlyRate === 0) return principal / payment;
  // Solving: payment = principal * r / (1 - (1+r)^(-n))
  // => (1+r)^(-n) = 1 - principal * r / payment
  const factor = 1 - (principal * quarterlyRate) / payment;
  if (factor <= 0) return Infinity; // payment cannot cover interest; loan is unrepayable
  return -Math.log(factor) / Math.log(1 + quarterlyRate);
}

/**
 * Calculates the full impact of an extraordinary mortgage payment.
 * Loans are assumed to be quarterly-paid annuity loans (annuitetslån).
 */
export function calculateMortgage(input: MortgageInput): MortgageResult {
  const { remainingAmount, remainingYears, interestRate, contributionRate, extraPayment, fee } =
    input;

  const nQuarters = Math.round(remainingYears * 4);
  const quarterlyInterestRate = interestRate / 4 / 100;
  const quarterlyContributionRate = contributionRate / 4 / 100;
  const combinedQuarterlyRate = quarterlyInterestRate + quarterlyContributionRate;

  // ── Current loan ──────────────────────────────────────────────────────────
  const currentQPayment = quarterlyPayment(remainingAmount, combinedQuarterlyRate, nQuarters);
  const currentAnnualInterest = remainingAmount * quarterlyInterestRate * 4;
  const currentAnnualTaxDeduction = currentAnnualInterest * TAX_DEDUCTION_RATE;

  // ── After extraordinary payment ───────────────────────────────────────────
  const newRemainingAmount = Math.max(0, remainingAmount - extraPayment);
  const totalCost = extraPayment + fee;

  // Option 1: Same remaining term, lower quarterly payment
  const newQPaymentSameTerm = quarterlyPayment(
    newRemainingAmount,
    combinedQuarterlyRate,
    nQuarters,
  );
  const quarterlyPaymentSaving = currentQPayment - newQPaymentSameTerm;
  const annualPaymentSaving = quarterlyPaymentSaving * 4;

  const currentTotalCost = totalCostOverLife(remainingAmount, combinedQuarterlyRate, nQuarters);
  const newTotalCostSameTerm = totalCostOverLife(
    newRemainingAmount,
    combinedQuarterlyRate,
    nQuarters,
  );
  const totalInterestSavedSameTerm = currentTotalCost - newTotalCostSameTerm;

  // Option 2: Same payment, shorter remaining term
  const fractionalNewQuarters = quartersNeeded(
    newRemainingAmount,
    combinedQuarterlyRate,
    currentQPayment,
  );
  const isRepayable = isFinite(fractionalNewQuarters);
  const newRemainingQuartersSamePayment = isRepayable
    ? Math.ceil(fractionalNewQuarters)
    : nQuarters;
  const quartersSaved = isRepayable ? Math.max(0, nQuarters - newRemainingQuartersSamePayment) : 0;
  const yearsSaved = quartersSaved / 4;

  const newTotalCostSamePayment = totalCostOverLife(
    newRemainingAmount,
    combinedQuarterlyRate,
    newRemainingQuartersSamePayment,
  );
  const totalInterestSavedSamePayment = currentTotalCost - newTotalCostSamePayment;

  // ── Tax impact ────────────────────────────────────────────────────────────
  const newAnnualInterest = newRemainingAmount * quarterlyInterestRate * 4;
  const newAnnualTaxDeduction = newAnnualInterest * TAX_DEDUCTION_RATE;
  const taxDeductionChange = newAnnualTaxDeduction - currentAnnualTaxDeduction;

  return {
    newRemainingAmount,
    totalCost,
    currentQuarterlyPayment: currentQPayment,
    currentAnnualInterest,
    currentAnnualTaxDeduction,
    newQuarterlyPaymentSameTerm: newQPaymentSameTerm,
    quarterlyPaymentSaving,
    annualPaymentSaving,
    totalInterestSavedSameTerm,
    newRemainingQuartersSamePayment,
    quartersSaved,
    yearsSaved,
    totalInterestSavedSamePayment,
    newAnnualInterest,
    newAnnualTaxDeduction,
    taxDeductionChange,
  };
}
