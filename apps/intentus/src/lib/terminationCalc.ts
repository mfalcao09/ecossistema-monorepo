/**
 * Calculate proportional termination penalty for a lease contract.
 * Standard Brazilian formula: (monthly_value × 3) × (remaining_months / total_months)
 * The "3 months rent" penalty is the most common in Brazil, proportional to remaining time.
 */
export function calculateTerminationPenalty(params: {
  monthlyValue: number;
  startDate: string;
  endDate: string;
  noticeDate: string;
  penaltyMonths?: number; // Default 3
}): {
  totalContractMonths: number;
  elapsedMonths: number;
  remainingMonths: number;
  fullPenalty: number;
  proportionalPenalty: number;
} {
  const { monthlyValue, startDate, endDate, noticeDate, penaltyMonths = 3 } = params;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const notice = new Date(noticeDate);

  const totalContractMonths = Math.max(1, monthDiff(start, end));
  const elapsedMonths = Math.max(0, monthDiff(start, notice));
  const remainingMonths = Math.max(0, totalContractMonths - elapsedMonths);

  const fullPenalty = monthlyValue * penaltyMonths;
  const proportionalPenalty = Math.round(
    (fullPenalty * remainingMonths / totalContractMonths) * 100
  ) / 100;

  return {
    totalContractMonths,
    elapsedMonths,
    remainingMonths,
    fullPenalty,
    proportionalPenalty,
  };
}

function monthDiff(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

/**
 * Calculate pro-rata rent for partial month occupation.
 * @param monthlyValue - full monthly rent
 * @param occupiedDays - days occupied in the month
 * @param daysInMonth - total days in the month (default 30)
 */
export function calculateProRataRent(monthlyValue: number, occupiedDays: number, daysInMonth = 30): number {
  return Math.round((monthlyValue / daysInMonth) * occupiedDays * 100) / 100;
}

/**
 * Calculate pro-rata condo fee for partial month.
 */
export function calculateProRataCondo(condoValue: number, occupiedDays: number, daysInMonth = 30): number {
  return Math.round((condoValue / daysInMonth) * occupiedDays * 100) / 100;
}

/**
 * ISS/PIS/COFINS tax rates for real estate service companies (Lucro Presumido - most common)
 */
export const SERVICE_TAX_RATES = {
  iss: 5.0,        // ISS (municipal) - varies 2-5%, using 5% as max
  pis: 0.65,       // PIS
  cofins: 3.0,     // COFINS
  irpj: 4.80,      // IRPJ (32% presunção × 15%)
  csll: 2.88,      // CSLL (32% presunção × 9%)
};

export function calculateServiceTaxes(ownRevenue: number) {
  const taxes = Object.entries(SERVICE_TAX_RATES).map(([key, rate]) => ({
    tax: key.toUpperCase(),
    rate,
    value: Math.round(ownRevenue * rate / 100 * 100) / 100,
  }));

  const totalTax = taxes.reduce((s, t) => s + t.value, 0);
  const netRevenue = Math.round((ownRevenue - totalTax) * 100) / 100;

  return { taxes, totalTax: Math.round(totalTax * 100) / 100, netRevenue };
}
