/**
 * Parse USDA Foundation Foods CSV data and generate a TypeScript module.
 *
 * Usage:  node scripts/parse-usda.mjs
 *
 * Input:  ../files/Food Databases/USDA/FoodData_Central_foundation_food_csv_2025-12-18/*.csv
 * Output: src/lib/ingredient-data.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

// ── Paths ──────────────────────────────────────────────────────────────────
const DATA_DIR = join(
  import.meta.dirname,
  "../../files/Food Databases/USDA/FoodData_Central_foundation_food_csv_2025-12-18"
);
const OUT_FILE = join(import.meta.dirname, "../src/lib/ingredient-data.ts");

// ── CSV parser (handles quoted fields with commas) ─────────────────────────
function parseCSV(filePath) {
  const raw = readFileSync(filePath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];

  const headers = parseLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function parseLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

// ── Load all CSV files ─────────────────────────────────────────────────────
console.log("Loading CSV files...");
const foodRows = parseCSV(join(DATA_DIR, "food.csv"));
const foundationRows = parseCSV(join(DATA_DIR, "foundation_food.csv"));
const categoryRows = parseCSV(join(DATA_DIR, "food_category.csv"));
const nutrientDefRows = parseCSV(join(DATA_DIR, "nutrient.csv"));
const foodNutrientRows = parseCSV(join(DATA_DIR, "food_nutrient.csv"));
const portionRows = parseCSV(join(DATA_DIR, "food_portion.csv"));
const measureUnitRows = parseCSV(join(DATA_DIR, "measure_unit.csv"));

console.log(`  food.csv:           ${foodRows.length} rows`);
console.log(`  foundation_food.csv: ${foundationRows.length} rows`);
console.log(`  food_category.csv:  ${categoryRows.length} rows`);
console.log(`  nutrient.csv:       ${nutrientDefRows.length} rows`);
console.log(`  food_nutrient.csv:  ${foodNutrientRows.length} rows`);
console.log(`  food_portion.csv:   ${portionRows.length} rows`);
console.log(`  measure_unit.csv:   ${measureUnitRows.length} rows`);

// ── Build lookup maps ──────────────────────────────────────────────────────
const foundationFdcIds = new Set(foundationRows.map((r) => r.fdc_id));
const categoryMap = new Map(categoryRows.map((r) => [r.id, r.description]));
const measureUnitMap = new Map(measureUnitRows.map((r) => [r.id, r.name]));

// Nutrient definitions we care about (nutrient_id → key/unit/label)
const NUTRIENT_MAP = {
  // Energy
  "1008": { key: "calories", label: "Calories", unit: "kcal", group: "general" },
  "2047": { key: "calories_atwater", label: "Calories (Atwater General)", unit: "kcal", group: "general" },

  // Macros
  "1003": { key: "protein", label: "Protein", unit: "g", group: "macro" },
  "1004": { key: "totalFat", label: "Total Fat", unit: "g", group: "macro" },
  "1005": { key: "carbohydrate", label: "Carbohydrate", unit: "g", group: "macro" },
  "1079": { key: "fiber", label: "Dietary Fiber", unit: "g", group: "macro" },
  "2000": { key: "totalSugars", label: "Total Sugars", unit: "g", group: "macro" },
  "1063": { key: "totalSugarsAlt", label: "Sugars, Total", unit: "g", group: "macro" },
  "1051": { key: "water", label: "Water", unit: "g", group: "general" },
  "1007": { key: "ash", label: "Ash", unit: "g", group: "general" },
  "1018": { key: "alcohol", label: "Alcohol", unit: "g", group: "general" },

  // Fats breakdown
  "1258": { key: "saturatedFat", label: "Saturated Fat", unit: "g", group: "lipid" },
  "1292": { key: "monounsaturatedFat", label: "Monounsaturated Fat", unit: "g", group: "lipid" },
  "1293": { key: "polyunsaturatedFat", label: "Polyunsaturated Fat", unit: "g", group: "lipid" },
  "1257": { key: "transFat", label: "Trans Fat", unit: "g", group: "lipid" },
  "1253": { key: "cholesterol", label: "Cholesterol", unit: "mg", group: "lipid" },

  // Omega fatty acids
  "1404": { key: "omega3ALA", label: "Omega-3 ALA", unit: "g", group: "lipid" },
  "1278": { key: "omega3EPA", label: "Omega-3 EPA", unit: "g", group: "lipid" },
  "1272": { key: "omega3DHA", label: "Omega-3 DHA", unit: "g", group: "lipid" },
  "1316": { key: "omega6LA", label: "Omega-6 Linoleic", unit: "g", group: "lipid" },

  // Minerals
  "1087": { key: "calcium", label: "Calcium", unit: "mg", group: "mineral" },
  "1089": { key: "iron", label: "Iron", unit: "mg", group: "mineral" },
  "1090": { key: "magnesium", label: "Magnesium", unit: "mg", group: "mineral" },
  "1091": { key: "phosphorus", label: "Phosphorus", unit: "mg", group: "mineral" },
  "1092": { key: "potassium", label: "Potassium", unit: "mg", group: "mineral" },
  "1093": { key: "sodium", label: "Sodium", unit: "mg", group: "mineral" },
  "1095": { key: "zinc", label: "Zinc", unit: "mg", group: "mineral" },
  "1098": { key: "copper", label: "Copper", unit: "mg", group: "mineral" },
  "1101": { key: "manganese", label: "Manganese", unit: "mg", group: "mineral" },
  "1103": { key: "selenium", label: "Selenium", unit: "µg", group: "mineral" },

  // Vitamins
  "1106": { key: "vitaminA", label: "Vitamin A (RAE)", unit: "µg", group: "vitamin" },
  "1162": { key: "vitaminC", label: "Vitamin C", unit: "mg", group: "vitamin" },
  "1114": { key: "vitaminD", label: "Vitamin D (D2+D3)", unit: "µg", group: "vitamin" },
  "1109": { key: "vitaminE", label: "Vitamin E", unit: "mg", group: "vitamin" },
  "1185": { key: "vitaminK", label: "Vitamin K", unit: "µg", group: "vitamin" },
  "1165": { key: "thiamin", label: "Thiamin (B1)", unit: "mg", group: "vitamin" },
  "1166": { key: "riboflavin", label: "Riboflavin (B2)", unit: "mg", group: "vitamin" },
  "1167": { key: "niacin", label: "Niacin (B3)", unit: "mg", group: "vitamin" },
  "1170": { key: "pantothenicAcid", label: "Pantothenic Acid (B5)", unit: "mg", group: "vitamin" },
  "1175": { key: "vitaminB6", label: "Vitamin B6", unit: "mg", group: "vitamin" },
  "1176": { key: "biotin", label: "Biotin (B7)", unit: "µg", group: "vitamin" },
  "1177": { key: "folate", label: "Folate", unit: "µg", group: "vitamin" },
  "1190": { key: "folateDFE", label: "Folate (DFE)", unit: "µg", group: "vitamin" },
  "1178": { key: "vitaminB12", label: "Vitamin B12", unit: "µg", group: "vitamin" },
  "1180": { key: "choline", label: "Choline", unit: "mg", group: "vitamin" },
};

const nutrientIds = new Set(Object.keys(NUTRIENT_MAP));

// ── Process foods ──────────────────────────────────────────────────────────
console.log("\nProcessing foundation foods...");

// Get unique foundation food fdc_ids
// food.csv has sample_food, sub_sample_food, market_acquisition types
// foundation_food.csv gives us the canonical fdc_ids
// But food.csv may not have all foundation_food fdc_ids as data_type "foundation_food"
// Let's find unique sample foods that are foundation foods
const foundationFoodRows = foodRows.filter((f) => foundationFdcIds.has(f.fdc_id));
console.log(`  Foundation food entries in food.csv: ${foundationFoodRows.length}`);

// Many foods in food.csv are sub_samples of the same food. We want the sample_food entries.
// foundation_food.csv has the fdc_ids — let's check what data_types they are
const dtCounts = {};
for (const f of foundationFoodRows) {
  dtCounts[f.data_type] = (dtCounts[f.data_type] || 0) + 1;
}
console.log("  Data types:", dtCounts);

// If most are sub_sample_food, we need to find the parent sample foods
// Let's check foundation_food.csv fdc_ids directly
const sampleFoodRows = foodRows.filter((f) => f.data_type === "sample_food");
console.log(`  Sample food entries: ${sampleFoodRows.length}`);

// Get all foods — we want UNIQUE foods. Foundation_food.csv links to food.csv.
// But we actually need the nutrient data which may only exist on sample_food or sub_sample entries.
// Let's use foundation_food.csv entries, and for each get the nutrient data.
// Actually the food_nutrient.csv has nutrient values directly keyed by fdc_id.

// Strategy: use the foundation_food fdc_ids, get their descriptions from food.csv,
// then get nutrients from food_nutrient.csv
const foodMap = new Map(foodRows.map((r) => [r.fdc_id, r]));

// Build nutrient lookup: fdc_id → { nutrientId → amount }
console.log("  Building nutrient index (this may take a moment)...");
const nutrientsByFood = new Map();
for (const nr of foodNutrientRows) {
  if (!nutrientIds.has(nr.nutrient_id)) continue;
  if (!foundationFdcIds.has(nr.fdc_id)) continue;

  if (!nutrientsByFood.has(nr.fdc_id)) {
    nutrientsByFood.set(nr.fdc_id, {});
  }
  const amount = parseFloat(nr.amount);
  if (!isNaN(amount)) {
    const nDef = NUTRIENT_MAP[nr.nutrient_id];
    const existing = nutrientsByFood.get(nr.fdc_id);
    // Don't overwrite if we already have a value for this key
    if (!(nDef.key in existing)) {
      existing[nDef.key] = amount;
    }
  }
}
console.log(`  Foods with nutrients: ${nutrientsByFood.size}`);

// Build portions lookup: fdc_id → [{ amount, unitName, gramWeight, description }]
const portionsByFood = new Map();
for (const pr of portionRows) {
  if (!foundationFdcIds.has(pr.fdc_id)) continue;

  if (!portionsByFood.has(pr.fdc_id)) {
    portionsByFood.set(pr.fdc_id, []);
  }

  const unitName = measureUnitMap.get(pr.measure_unit_id) || "";
  const gramWeight = parseFloat(pr.gram_weight);
  const amount = parseFloat(pr.amount) || 1;

  if (!isNaN(gramWeight) && gramWeight > 0) {
    // Build a readable label
    let label = "";
    if (pr.portion_description) {
      label = pr.portion_description;
    } else if (unitName && unitName !== "undetermined") {
      label = amount !== 1 ? `${amount} ${unitName}` : unitName;
    } else {
      label = `${gramWeight}g`;
    }

    portionsByFood.get(pr.fdc_id).push({
      label,
      gramWeight: Math.round(gramWeight * 10) / 10,
    });
  }
}

// ── Build final ingredient list ────────────────────────────────────────────
console.log("\nBuilding ingredient list...");

const ingredients = [];
for (const fr of foundationRows) {
  const fdcId = fr.fdc_id;
  const food = foodMap.get(fdcId);
  if (!food) continue;

  const nutrients = nutrientsByFood.get(fdcId) || {};

  // Use Atwater calories if regular not available
  let calories = nutrients.calories ?? nutrients.calories_atwater ?? null;
  delete nutrients.calories_atwater;
  if (calories !== null && calories !== undefined) {
    nutrients.calories = Math.round(calories * 10) / 10;
  }

  // Merge totalSugarsAlt into totalSugars
  if (!nutrients.totalSugars && nutrients.totalSugarsAlt) {
    nutrients.totalSugars = nutrients.totalSugarsAlt;
  }
  delete nutrients.totalSugarsAlt;

  // Get category
  const categoryName = categoryMap.get(food.food_category_id) || "Uncategorized";

  // Get portions — add "100g" as the default base
  const portions = [{ label: "100 g", gramWeight: 100 }];
  const foodPortions = portionsByFood.get(fdcId) || [];

  // Deduplicate portions by label
  const seenLabels = new Set(["100 g"]);
  for (const p of foodPortions) {
    if (!seenLabels.has(p.label)) {
      seenLabels.add(p.label);
      portions.push(p);
    }
  }

  // Clean up description — capitalize properly
  let name = food.description;

  // Round nutrient values for compact storage
  const cleanNutrients = {};
  for (const [key, val] of Object.entries(nutrients)) {
    if (val !== null && val !== undefined && !isNaN(val)) {
      // Round to reasonable precision
      cleanNutrients[key] = Math.round(val * 1000) / 1000;
    }
  }

  ingredients.push({
    fdcId: parseInt(fdcId),
    name,
    category: categoryName,
    nutrients: cleanNutrients,
    portions,
  });
}

// Sort by name
ingredients.sort((a, b) => a.name.localeCompare(b.name));

console.log(`  Total ingredients: ${ingredients.length}`);

// Stats
const withCalories = ingredients.filter((i) => i.nutrients.calories != null).length;
const withProtein = ingredients.filter((i) => i.nutrients.protein != null).length;
const withPortions = ingredients.filter((i) => i.portions.length > 1).length;
console.log(`  With calories: ${withCalories}`);
console.log(`  With protein: ${withProtein}`);
console.log(`  With custom portions: ${withPortions}`);

// Category distribution
const catCounts = {};
for (const i of ingredients) {
  catCounts[i.category] = (catCounts[i.category] || 0) + 1;
}
console.log("  Categories:", catCounts);

// ── Generate TypeScript output ─────────────────────────────────────────────
console.log("\nGenerating TypeScript...");

// Build the nutrient definition constant
const nutrientDefs = [];
for (const [id, def] of Object.entries(NUTRIENT_MAP)) {
  if (def.key === "calories_atwater" || def.key === "totalSugarsAlt") continue;
  nutrientDefs.push(def);
}
// Deduplicate by key
const seenKeys = new Set();
const uniqueNutrientDefs = [];
for (const def of nutrientDefs) {
  if (!seenKeys.has(def.key)) {
    seenKeys.add(def.key);
    uniqueNutrientDefs.push(def);
  }
}

const tsOutput = `// ============================================================
// AUTO-GENERATED — Do not edit manually.
// Generated from USDA FoodData Central Foundation Foods
// Source: FoodData_Central_foundation_food_csv_2025-12-18
// Run:    node scripts/parse-usda.mjs
// ============================================================

export interface USDANutrientDef {
  key: string;
  label: string;
  unit: string;
  group: "general" | "macro" | "lipid" | "mineral" | "vitamin";
}

export interface USDAIngredientPortion {
  label: string;
  gramWeight: number;
}

export interface USDAIngredient {
  fdcId: number;
  name: string;
  category: string;
  /** Nutrient values per 100 g */
  nutrients: Record<string, number>;
  /** Available portion sizes (first is always "100 g") */
  portions: USDAIngredientPortion[];
}

/** All tracked nutrient definitions, ordered by display priority */
export const NUTRIENT_DEFINITIONS: USDANutrientDef[] = ${JSON.stringify(uniqueNutrientDefs, null, 2)};

/** All unique food categories in the dataset */
export const INGREDIENT_CATEGORIES: string[] = ${JSON.stringify(
  [...new Set(ingredients.map((i) => i.category))].sort(),
  null,
  2
)};

/** ${ingredients.length} USDA Foundation Foods with nutrient data per 100 g */
export const USDA_INGREDIENTS: USDAIngredient[] = ${JSON.stringify(ingredients)};
`;

writeFileSync(OUT_FILE, tsOutput, "utf-8");
const sizeKB = Math.round(readFileSync(OUT_FILE).length / 1024);
console.log(`\nDone! Wrote ${OUT_FILE} (${sizeKB} KB)`);
console.log(`  ${ingredients.length} ingredients`);
console.log(`  ${uniqueNutrientDefs.length} nutrient definitions`);
