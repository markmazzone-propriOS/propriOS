export type MortgageEstimate = {
  interestRate: number;
  monthlyPayment: number;
  principalAndInterest: number;
  propertyTax: number;
  homeInsurance: number;
  hoa?: number;
};

export function calculateMortgage(
  propertyPrice: number,
  downPaymentPercent: number = 20,
  interestRate: number,
  loanTermYears: number = 30,
  propertyTaxRate: number = 1.2,
  homeInsuranceRate: number = 0.35,
  hoaMonthly: number = 0
): MortgageEstimate {
  const downPayment = propertyPrice * (downPaymentPercent / 100);
  const loanAmount = propertyPrice - downPayment;
  const monthlyRate = interestRate / 100 / 12;
  const numberOfPayments = loanTermYears * 12;

  let principalAndInterest = 0;
  if (monthlyRate === 0) {
    principalAndInterest = loanAmount / numberOfPayments;
  } else {
    principalAndInterest =
      loanAmount *
      (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
      (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
  }

  const propertyTax = (propertyPrice * (propertyTaxRate / 100)) / 12;
  const homeInsurance = (propertyPrice * (homeInsuranceRate / 100)) / 12;

  const monthlyPayment = principalAndInterest + propertyTax + homeInsurance + hoaMonthly;

  return {
    interestRate,
    monthlyPayment: Math.round(monthlyPayment),
    principalAndInterest: Math.round(principalAndInterest),
    propertyTax: Math.round(propertyTax),
    homeInsurance: Math.round(homeInsurance),
    hoa: hoaMonthly > 0 ? hoaMonthly : undefined,
  };
}

export function getMortgageRange(
  propertyPrice: number,
  downPaymentPercent: number = 20,
  loanTermYears: number = 30
): {
  rate4: MortgageEstimate;
  rate5: MortgageEstimate;
  low: MortgageEstimate;
  mid: MortgageEstimate;
  high: MortgageEstimate
} {
  const rate4 = 4.0;
  const rate5 = 5.0;
  const lowRate = 6.0;
  const midRate = 7.0;
  const highRate = 8.0;

  return {
    rate4: calculateMortgage(propertyPrice, downPaymentPercent, rate4, loanTermYears),
    rate5: calculateMortgage(propertyPrice, downPaymentPercent, rate5, loanTermYears),
    low: calculateMortgage(propertyPrice, downPaymentPercent, lowRate, loanTermYears),
    mid: calculateMortgage(propertyPrice, downPaymentPercent, midRate, loanTermYears),
    high: calculateMortgage(propertyPrice, downPaymentPercent, highRate, loanTermYears),
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
