#!/usr/bin/env node

/**
 * Sync UK branded foods from FatSecret into Supabase ingredient_catalog.
 *
 * Usage:
 *   node scripts/sync-fatsecret-uk.mjs \
 *     --supabase-url "https://<project>.supabase.co" \
 *     --supabase-service-key "<service-role-key>" \
 *     --fatsecret-client-id "<client-id>" \
 *     --fatsecret-client-secret "<client-secret>" \
 *     --dry-run
 *
 * Notes:
 * - Requires a FatSecret account/app that can access GB localization.
 * - Designed for branded-supermarket coverage (Tesco, Sainsbury's, Morrisons, Asda, M&S).
 */

import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const FATSECRET_TOKEN_URL = "https://oauth.fatsecret.com/connect/token";
const FATSECRET_API_URL = "https://platform.fatsecret.com/rest/server.api";

const DEFAULT_TARGETS = ["tesco", "sainsbury", "morrisons", "asda", "m&s", "marks and spencer"];
const DEFAULT_QUERIES = [
  "tesco chicken",
  "tesco yogurt",
  "sainsbury chicken",
  "sainsbury yogurt",
  "morrisons chicken",
  "morrisons yogurt",
  "asda chicken",
  "asda yogurt",
  "m&s chicken",
  "m&s yogurt",
  "tesco finest",
  "sainsbury taste the difference",
  "morrisons the best",
  "asda extra special",
  "m&s food",
];

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeTarget(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  if (normalized === "m s" || normalized === "ms") {
    return "marks and spencer";
  }
  return normalized;
}

function toNumber(value) {
  if (value == null) return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function fnv1a32(text) {
  let hash = 0x811c9dc5;
  const input = String(text);
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function parseWeightFromDescription(description) {
  const text = String(description ?? "").toLowerCase();
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*g\b/);
  if (!match) return null;
  return toNumber(match[1]);
}

function extractServingWeight(serving) {
  const metricAmount = toNumber(serving.metric_serving_amount);
  const metricUnit = normalizeText(serving.metric_serving_unit);
  if (metricAmount && metricAmount > 0 && (metricUnit === "g" || metricUnit === "gram" || metricUnit === "grams")) {
    return metricAmount;
  }
  return parseWeightFromDescription(serving.serving_description);
}

function calcMacroCompleteness(serving) {
  const keys = ["calories", "protein", "carbohydrate", "fat", "fiber"];
  return keys.reduce((acc, key) => acc + (toNumber(serving[key]) != null ? 1 : 0), 0);
}

function pickBestServing(servings) {
  let best = null;
  let bestScore = -Infinity;

  for (const serving of servings) {
    const grams = extractServingWeight(serving);
    if (!grams || grams <= 0) continue;
    const calories = toNumber(serving.calories);
    const protein = toNumber(serving.protein);
    const carbs = toNumber(serving.carbohydrate);
    const fat = toNumber(serving.fat);
    const fiber = toNumber(serving.fiber);

    const hasAnyMacro = [calories, protein, carbs, fat, fiber].some((v) => v != null);
    if (!hasAnyMacro) continue;

    let score = 0;
    score += calcMacroCompleteness(serving) * 10;
    score -= Math.abs(grams - 100) * 0.15;
    if (Math.abs(grams - 100) < 0.001) score += 25;
    if (String(serving.metric_serving_unit ?? "").toLowerCase() === "g") score += 10;

    if (score > bestScore) {
      bestScore = score;
      best = { serving, grams };
    }
  }

  return best;
}

function buildPortions(servings) {
  const result = [];
  const seen = new Set();

  const push = (label, gramWeight) => {
    const key = `${normalizeText(label)}|${gramWeight.toFixed(3)}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ label, gramWeight });
  };

  push("100 g", 100);
  for (const serving of servings) {
    const grams = extractServingWeight(serving);
    if (!grams || grams <= 0) continue;
    const label = String(serving.serving_description ?? `${grams} g`).trim() || `${grams} g`;
    push(label, grams);
  }

  return result;
}

function derivePer100(serving, grams) {
  const factor = 100 / grams;
  const caloriesRaw = toNumber(serving.calories);
  const proteinRaw = toNumber(serving.protein);
  const carbsRaw = toNumber(serving.carbohydrate);
  const fatRaw = toNumber(serving.fat);
  const fiberRaw = toNumber(serving.fiber);

  const protein = proteinRaw != null ? proteinRaw * factor : null;
  const carbs = carbsRaw != null ? carbsRaw * factor : null;
  const fat = fatRaw != null ? fatRaw * factor : null;
  const fiber = fiberRaw != null ? fiberRaw * factor : null;
  let calories = caloriesRaw != null ? caloriesRaw * factor : null;

  if (calories == null && (protein != null || carbs != null || fat != null)) {
    calories = (protein ?? 0) * 4 + (carbs ?? 0) * 4 + (fat ?? 0) * 9;
  }

  return {
    calories,
    protein,
    carbs,
    fat,
    fiber,
  };
}

function parseFatSecretError(payload) {
  const err = payload?.error;
  if (!err) return null;
  const code = err.code ?? err.error_code ?? "";
  const message = err.message ?? err.error_message ?? "Unknown FatSecret API error";
  return { code: String(code), message: String(message) };
}

async function getOAuthToken(clientId, clientSecret, scopeCandidates) {
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const attempts = [];

  for (const scope of scopeCandidates) {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      scope,
    });

    const response = await fetch(FATSECRET_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const text = await response.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // ignore; handled below
    }

    if (response.ok && parsed?.access_token) {
      return { accessToken: parsed.access_token, scope };
    }

    attempts.push({
      scope,
      status: response.status,
      body: parsed?.error_description ?? parsed?.error ?? text.slice(0, 500),
    });
  }

  throw new Error(
    `Unable to obtain FatSecret OAuth token. Attempts: ${JSON.stringify(attempts, null, 2)}`
  );
}

async function callFatSecret(accessToken, methodName, params = {}) {
  const payload = new URLSearchParams({
    method: methodName,
    format: "json",
    ...Object.fromEntries(
      Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([key, value]) => [key, String(value)])
    ),
  });

  const response = await fetch(FATSECRET_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload.toString(),
  });

  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`FatSecret non-JSON response for ${methodName}: ${text.slice(0, 500)}`);
  }

  const fatErr = parseFatSecretError(parsed);
  if (!response.ok || fatErr) {
    const suffix = fatErr ? `code=${fatErr.code} message=${fatErr.message}` : `status=${response.status}`;
    throw new Error(`FatSecret ${methodName} failed (${suffix})`);
  }

  return parsed;
}

async function callFatSecretWithFallback(accessToken, methods, params = {}) {
  const errors = [];
  for (const methodName of methods) {
    try {
      const payload = await callFatSecret(accessToken, methodName, params);
      return { methodName, payload };
    } catch (error) {
      errors.push(`${methodName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(errors.join(" | "));
}

function matchesTargets(value, targets) {
  const normalized = normalizeText(value);
  return targets.some((target) => {
    const re = new RegExp(`(^| )${escapeRegExp(target)}( |$)`);
    return re.test(normalized);
  });
}

function inferBrand(food, targets) {
  const explicit = String(food.brand_name ?? "").trim();
  if (explicit) return explicit;

  const text = normalizeText(`${food.food_name ?? ""} ${food.food_description ?? ""}`);
  const found = targets.find((target) => text.includes(target));
  if (!found) return null;
  if (found === "m&s") return "M&S";
  if (found === "marks and spencer") return "Marks & Spencer";
  return found
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

async function fetchSearchRows(accessToken, { query, maxPages, pageSize, region, language }) {
  const rows = [];

  for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
    const { payload } = await callFatSecretWithFallback(
      accessToken,
      ["foods.search.v5", "foods.search.v4", "foods.search.v3", "foods.search.v2", "foods.search"],
      {
        search_expression: query,
        page_number: pageNumber,
        max_results: pageSize,
        food_type: "brand",
        region,
        language,
      }
    );

    const root = payload.foods_search ?? payload.foods ?? payload;
    const foods = ensureArray(root?.results?.food ?? root?.food);
    if (foods.length === 0) break;
    rows.push(...foods);

    const totalResults = Number(root?.total_results ?? 0);
    const current = (pageNumber + 1) * pageSize;
    if (totalResults > 0 && current >= totalResults) break;
    if (foods.length < pageSize) break;
  }

  return rows;
}

async function fetchFoodDetail(accessToken, foodId, region, language) {
  const { payload } = await callFatSecretWithFallback(
    accessToken,
    ["food.get.v4", "food.get.v3", "food.get.v2", "food.get"],
    {
      food_id: foodId,
      region,
      language,
    }
  );
  return payload.food ?? payload;
}

function toCatalogRow(detail, targets) {
  const sourceRef = String(detail.food_id ?? "").trim();
  if (!sourceRef) {
    return { row: null, skipReason: "missing_source_ref" };
  }

  const servings = ensureArray(detail?.servings?.serving ?? detail?.serving);
  if (servings.length === 0) {
    return { row: null, skipReason: "missing_servings" };
  }

  const best = pickBestServing(servings);
  if (!best) {
    return { row: null, skipReason: "missing_gram_based_nutrition" };
  }

  const per100 = derivePer100(best.serving, best.grams);
  if (
    per100.calories == null &&
    per100.protein == null &&
    per100.carbs == null &&
    per100.fat == null &&
    per100.fiber == null
  ) {
    return { row: null, skipReason: "empty_macros" };
  }

  const sourceIdNumber = Number(sourceRef);
  const numericId = Number.isFinite(sourceIdNumber) && sourceIdNumber > 0
    ? sourceIdNumber
    : fnv1a32(sourceRef);
  const fdcId = 9_000_000_000 + numericId;

  const name = String(detail.food_name ?? "").trim();
  if (!name) {
    return { row: null, skipReason: "missing_name" };
  }

  const brand = inferBrand(detail, targets);
  const nutrients = {
    calories: per100.calories != null ? Number(per100.calories.toFixed(4)) : undefined,
    protein: per100.protein != null ? Number(per100.protein.toFixed(4)) : undefined,
    carbohydrate: per100.carbs != null ? Number(per100.carbs.toFixed(4)) : undefined,
    totalFat: per100.fat != null ? Number(per100.fat.toFixed(4)) : undefined,
    fiber: per100.fiber != null ? Number(per100.fiber.toFixed(4)) : undefined,
  };

  const sanitizedNutrients = Object.fromEntries(
    Object.entries(nutrients).filter(([, value]) => value != null)
  );

  return {
    row: {
      id: `fatsecret_uk:${sourceRef}`,
      source: "fatsecret_uk",
      source_ref: sourceRef,
      fdc_id: fdcId,
      name,
      category: brand ?? "UK Branded",
      data_type: "fatsecret_uk_branded",
      calories: per100.calories != null ? Number(per100.calories.toFixed(4)) : null,
      protein_g: per100.protein != null ? Number(per100.protein.toFixed(4)) : null,
      carbs_g: per100.carbs != null ? Number(per100.carbs.toFixed(4)) : null,
      fat_g: per100.fat != null ? Number(per100.fat.toFixed(4)) : null,
      fiber_g: per100.fiber != null ? Number(per100.fiber.toFixed(4)) : null,
      nutrients: sanitizedNutrients,
      portions: buildPortions(servings),
    },
    skipReason: null,
  };
}

async function upsertRows(rows, { supabaseUrl, serviceKey, anonKey, chunkSize }) {
  const client = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
      },
    },
  });

  let uploaded = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await client.from("ingredient_catalog").upsert(chunk, {
      onConflict: "source,source_ref",
      ignoreDuplicates: false,
    });
    if (error) {
      throw new Error(
        `Supabase upsert failed at chunk ${Math.floor(i / chunkSize) + 1}: ${error.message ?? JSON.stringify(error)}`
      );
    }
    uploaded += chunk.length;
    console.log(`[upload] ${uploaded}/${rows.length}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const fatsecretClientId = String(args["fatsecret-client-id"] ?? process.env.FATSECRET_CLIENT_ID ?? "");
  const fatsecretClientSecret = String(args["fatsecret-client-secret"] ?? process.env.FATSECRET_CLIENT_SECRET ?? "");
  const supabaseUrl = String(args["supabase-url"] ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const supabaseServiceKey = String(args["supabase-service-key"] ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  const supabaseAnonKey = String(
    args["supabase-api-key"] ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? supabaseServiceKey
  );

  const dryRun = Boolean(args["dry-run"]);
  const maxPages = Number(args["max-pages"] ?? 3);
  const pageSize = Number(args["page-size"] ?? 50);
  const maxFoods = Number(args["max-foods"] ?? 1000);
  const chunkSize = Number(args["chunk-size"] ?? 250);
  const region = String(args.region ?? "GB");
  const language = String(args.language ?? "en");
  const outJson = args["out-json"] ? String(args["out-json"]) : "";
  const allowAllSupermarkets = Boolean(args["allow-all-supermarkets"]);

  const targets = String(args["supermarket-targets"] ?? DEFAULT_TARGETS.join(","))
    .split(",")
    .map((x) => normalizeTarget(x))
    .filter(Boolean);
  const uniqueTargets = [...new Set(targets)];
  const queries = String(args.queries ?? DEFAULT_QUERIES.join(","))
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  if (!fatsecretClientId || !fatsecretClientSecret) {
    throw new Error("Missing FatSecret credentials. Set FATSECRET_CLIENT_ID and FATSECRET_CLIENT_SECRET.");
  }
  if (!dryRun && (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey)) {
    throw new Error("Missing Supabase credentials for upload.");
  }

  const scopeCandidates = [
    args.scope ? String(args.scope) : "",
    process.env.FATSECRET_SCOPE ?? "",
    "premier basic",
    "premier",
    "basic",
  ]
    .map((x) => x.trim())
    .filter(Boolean);

  console.log(`[init] region=${region} language=${language} dryRun=${dryRun}`);
  console.log(`[init] targets=${uniqueTargets.join(", ")}`);
  console.log(`[init] queries=${queries.length}`);

  const { accessToken, scope } = await getOAuthToken(fatsecretClientId, fatsecretClientSecret, scopeCandidates);
  console.log(`[oauth] token acquired with scope="${scope}"`);

  try {
    await callFatSecretWithFallback(
      accessToken,
      ["food_categories.get.v2", "food_categories.get"],
      { region, language }
    );
    console.log("[preflight] food_categories preflight OK");
  } catch (error) {
    throw new Error(`[preflight] failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const discoveredById = new Map();
  let totalDiscoveredRaw = 0;

  for (const query of queries) {
    const rows = await fetchSearchRows(accessToken, {
      query,
      maxPages,
      pageSize,
      region,
      language,
    });

    totalDiscoveredRaw += rows.length;
    for (const food of rows) {
      const foodId = String(food.food_id ?? "").trim();
      if (!foodId) continue;

      const searchable = `${food.food_name ?? ""} ${food.brand_name ?? ""} ${food.food_description ?? ""}`;
      const foodType = normalizeText(food.food_type);
      if (foodType && foodType !== "brand") {
        continue;
      }

      if (!allowAllSupermarkets && uniqueTargets.length > 0 && !matchesTargets(searchable, uniqueTargets)) {
        continue;
      }

      if (!discoveredById.has(foodId)) {
        discoveredById.set(foodId, food);
      }
    }
    console.log(`[search] "${query}" -> raw=${rows.length} unique=${discoveredById.size}`);
  }

  const discovered = [...discoveredById.values()];
  const capApplied = discovered.length > maxFoods;
  const selected = discovered.slice(0, maxFoods);

  const stats = {
    total_discovered_raw: totalDiscoveredRaw,
    total_discovered_unique_after_filters: discovered.length,
    total_selected_for_detail_fetch: selected.length,
    total_fetched_details: 0,
    usable_rows: 0,
    skipped_rows: 0,
    skipped_by_reason: {},
    cap_applied: capApplied,
    max_foods: maxFoods,
  };

  const rows = [];
  for (const food of selected) {
    const foodId = String(food.food_id ?? "").trim();
    if (!foodId) {
      stats.skipped_rows += 1;
      stats.skipped_by_reason.missing_food_id = (stats.skipped_by_reason.missing_food_id ?? 0) + 1;
      continue;
    }

    let detail;
    try {
      detail = await fetchFoodDetail(accessToken, foodId, region, language);
      stats.total_fetched_details += 1;
    } catch (error) {
      stats.skipped_rows += 1;
      stats.skipped_by_reason.detail_fetch_failed = (stats.skipped_by_reason.detail_fetch_failed ?? 0) + 1;
      console.warn(`[detail] ${foodId} failed: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    const { row, skipReason } = toCatalogRow(detail, uniqueTargets);
    if (!row || skipReason) {
      stats.skipped_rows += 1;
      stats.skipped_by_reason[skipReason ?? "unknown"] = (stats.skipped_by_reason[skipReason ?? "unknown"] ?? 0) + 1;
      continue;
    }

    rows.push(row);
    stats.usable_rows += 1;
  }

  console.log("[coverage]");
  console.log(JSON.stringify(stats, null, 2));

  if (outJson) {
    await writeFile(outJson, JSON.stringify(rows, null, 2), "utf-8");
    console.log(`[output] wrote ${rows.length} rows to ${outJson}`);
  }

  if (dryRun) {
    console.log("[done] dry-run mode enabled, skipping Supabase upload.");
    return;
  }

  await upsertRows(rows, {
    supabaseUrl,
    serviceKey: supabaseServiceKey,
    anonKey: supabaseAnonKey,
    chunkSize,
  });
  console.log(`[done] uploaded ${rows.length} fatsecret_uk rows to ingredient_catalog`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
