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

export function formatPercentRda(
  nutrientKey: string,
  value: number
): string | null {
  const nrv = UK_EU_NRV_BY_KEY[nutrientKey];
  if (!Number.isFinite(nrv) || nrv <= 0 || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  const percent = (value / nrv) * 100;
  if (percent < 1) return "<1% RDA";
  if (percent < 10) return `${percent.toFixed(1)}% RDA`;
  return `${Math.round(percent)}% RDA`;
}
