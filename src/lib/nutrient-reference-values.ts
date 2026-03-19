/**
 * UK/EU Nutrient Reference Values (NRV) used for %RDA display.
 * Values align with retained EU food information rules (per adult reference intake).
 */
export const UK_EU_NRV_BY_KEY: Record<string, number> = {
  calcium: 800,
  iron: 14,
  potassium: 2000,
  magnesium: 375,
  phosphorus: 700,
  zinc: 10,
  copper: 1,
  manganese: 2,
  selenium: 55,

  vitaminA: 800,
  vitaminD: 5,
  vitaminE: 12,
  vitaminC: 80,
  thiamin: 1.1,
  riboflavin: 1.4,
  niacin: 16,
  pantothenicAcid: 6,
  vitaminB6: 1.4,
  biotin: 50,
  folate: 200,
  vitaminB12: 2.5,
  vitaminK: 75,
};

// EFSA adults UL values (Version 11, Aug 2025 summary report).
// Only nutrients with a clear UL in the tracked form are included.
export const EFSA_ADULT_UL_BY_KEY: Record<string, number> = {
  calcium: 2500,
  zinc: 25,
  copper: 5,
  selenium: 255,
  vitaminA: 3000,
  vitaminD: 100,
  vitaminE: 300,
  vitaminB6: 12,
};

export function getNrvByNutrientKey(nutrientKey: string): number | null {
  const nrv = UK_EU_NRV_BY_KEY[nutrientKey];
  if (!Number.isFinite(nrv) || nrv <= 0) return null;
  return nrv;
}

export function getUlByNutrientKey(nutrientKey: string): number | null {
  const ul = EFSA_ADULT_UL_BY_KEY[nutrientKey];
  if (!Number.isFinite(ul) || ul <= 0) return null;
  return ul;
}

export function getPercentRda(nutrientKey: string, value: number): number | null {
  const nrv = getNrvByNutrientKey(nutrientKey);
  if (nrv == null || !Number.isFinite(value) || value <= 0) return null;
  return (value / nrv) * 100;
}

export function formatPercentRdaInline(percent: number): string {
  if (!Number.isFinite(percent) || percent <= 0) return "0%";
  if (percent < 1) return "<1%";
  if (percent < 10) return `${percent.toFixed(1)}%`;
  return `${Math.round(percent)}%`;
}

export function formatPercentRda(
  nutrientKey: string,
  value: number
): string | null {
  const percent = getPercentRda(nutrientKey, value);
  if (percent == null) return null;
  return `${formatPercentRdaInline(percent)} RDA`;
}
