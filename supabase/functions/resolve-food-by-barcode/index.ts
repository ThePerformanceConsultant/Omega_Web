import { createClient } from "npm:@supabase/supabase-js@2";

type FatSecretError = {
  code?: number | string;
  message?: string;
  error_code?: number | string;
  error_message?: string;
};

type FatSecretServing = {
  serving_id?: string;
  serving_description?: string;
  metric_serving_amount?: string | number;
  metric_serving_unit?: string;
  calories?: string | number;
  protein?: string | number;
  carbohydrate?: string | number;
  fat?: string | number;
  fiber?: string | number;
  [key: string]: unknown;
};

type FatSecretFood = {
  food_id?: string;
  food_name?: string;
  brand_name?: string;
  food_type?: string;
  servings?: { serving?: FatSecretServing | FatSecretServing[] };
  serving?: FatSecretServing | FatSecretServing[];
  [key: string]: unknown;
};

type BarcodeRequest = {
  barcode?: string;
  region?: string;
  language?: string;
};

type ResolvedFoodPayload = {
  name: string;
  brandName: string | null;
  servingSize: string;
  baseServingGrams: number;
  packetServingLabel: string | null;
  packetServingGrams: number | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  micronutrients: Record<string, number>;
  portions: Array<{ label: string; gramWeight: number }>;
};

type BarcodeResponse =
  | {
      found: false;
      barcode: string;
      source: "fatsecret";
      errorCode: string;
      errorMessage: string;
    }
  | {
      found: true;
      barcode: string;
      source: "fatsecret";
      foodId: string;
      servingId: string | null;
      fetchedAt: string;
      expiresAt: string;
      food: ResolvedFoodPayload;
    };

const FATSECRET_TOKEN_URL = "https://oauth.fatsecret.com/connect/token";
const FATSECRET_API_URL = "https://platform.fatsecret.com/rest/server.api";
const CACHE_MAX_AGE_HOURS = 24;

let tokenCache: { token: string; expiresAtMs: number } | null = null;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeBarcode(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/\D+/g, "");
  if (digits.length < 8 || digits.length > 14) return null;
  if (digits.length <= 13) return digits.padStart(13, "0");
  return digits;
}

function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseWeightFromDescription(description: unknown): number | null {
  const text = String(description ?? "").toLowerCase();
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*g\b/);
  if (!match) return null;
  return toNumber(match[1]);
}

function extractServingWeight(serving: FatSecretServing): number | null {
  const metricAmount = toNumber(serving.metric_serving_amount);
  const metricUnit = normalizeText(serving.metric_serving_unit);
  if (metricAmount && metricAmount > 0) {
    if (metricUnit === "g" || metricUnit === "gram" || metricUnit === "grams") return metricAmount;
    // For liquids FatSecret often uses ml; we treat this as gram-equivalent for app serving math.
    if (metricUnit === "ml") return metricAmount;
  }
  return parseWeightFromDescription(serving.serving_description);
}

function macroCompleteness(serving: FatSecretServing): number {
  const keys = ["calories", "protein", "carbohydrate", "fat", "fiber"];
  return keys.reduce((acc, key) => acc + (toNumber(serving[key]) != null ? 1 : 0), 0);
}

function pickBestServing(servings: FatSecretServing[]): { serving: FatSecretServing; grams: number } | null {
  let best: { serving: FatSecretServing; grams: number } | null = null;
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
    score += macroCompleteness(serving) * 10;
    score -= Math.abs(grams - 100) * 0.15;
    if (Math.abs(grams - 100) < 0.001) score += 25;
    if (normalizeText(serving.metric_serving_unit) === "g") score += 10;

    if (score > bestScore) {
      best = { serving, grams };
      bestScore = score;
    }
  }

  return best;
}

function derivePer100(serving: FatSecretServing, grams: number) {
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
    calories: calories ?? 0,
    protein: protein ?? 0,
    carbs: carbs ?? 0,
    fat: fat ?? 0,
    fiber: fiber ?? 0,
  };
}

function buildPortions(servings: FatSecretServing[]): Array<{ label: string; gramWeight: number }> {
  const portions: Array<{ label: string; gramWeight: number }> = [{ label: "100 g", gramWeight: 100 }];
  const seen = new Set(["100 g|100"]);

  for (const serving of servings) {
    const grams = extractServingWeight(serving);
    if (!grams || grams <= 0) continue;
    const label = String(serving.serving_description ?? `${grams} g`).trim() || `${grams} g`;
    const key = `${normalizeText(label)}|${grams.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    portions.push({ label, gramWeight: Number(grams.toFixed(4)) });
  }

  return portions;
}

function selectPacketPortion(
  portions: Array<{ label: string; gramWeight: number }>,
  baseServingGrams: number
): { label: string; gramWeight: number } | null {
  const keywords = [
    "portion",
    "pack",
    "packet",
    "pot",
    "bottle",
    "can",
    "bar",
    "sandwich",
    "wrap",
    "tub",
    "pouch",
    "sachet",
    "stick",
    "cookie",
    "biscuit",
    "slice",
    "piece",
    "bun",
    "roll",
    "cup",
    "jar",
    "carton",
  ];
  const nonBase = portions.filter((p) => Math.abs(p.gramWeight - baseServingGrams) >= 0.001);
  if (!nonBase.length) return null;

  const explicit = nonBase.find((p) => {
    const normalized = normalizeText(p.label);
    return keywords.some((keyword) => normalized.includes(keyword));
  });
  if (explicit) return explicit;
  if (nonBase.length === 1) return nonBase[0];
  return null;
}

function buildResolvedFood(food: FatSecretFood): {
  servingId: string | null;
  payload: ResolvedFoodPayload;
} {
  const servings = ensureArray(food?.servings?.serving ?? food?.serving);
  const best = pickBestServing(servings);
  if (!best) {
    throw new Error("No gram-based nutrition serving found");
  }

  const per100 = derivePer100(best.serving, best.grams);
  const portions = buildPortions(servings);
  const basePortion = portions.find((p) => Math.abs(p.gramWeight - 100) < 0.001) ?? portions[0];
  const packetPortion = selectPacketPortion(portions, basePortion.gramWeight);

  const macroKeys = new Set(["calories", "protein", "carbohydrate", "fat", "fiber"]);
  const micronutrients: Record<string, number> = {};
  for (const [key, rawValue] of Object.entries(best.serving)) {
    if (macroKeys.has(key)) continue;
    const value = toNumber(rawValue);
    if (value == null || value <= 0) continue;
    micronutrients[key] = Number((value * (100 / best.grams)).toFixed(4));
  }

  return {
    servingId: String(best.serving.serving_id ?? "").trim() || null,
    payload: {
      name: String(food.food_name ?? "").trim() || "Unknown Food",
      brandName: String(food.brand_name ?? "").trim() || null,
      servingSize: basePortion?.label ?? "100 g",
      baseServingGrams: Number((basePortion?.gramWeight ?? 100).toFixed(4)),
      packetServingLabel: packetPortion?.label ?? null,
      packetServingGrams: packetPortion?.gramWeight ?? null,
      calories: Number(per100.calories.toFixed(4)),
      proteinG: Number(per100.protein.toFixed(4)),
      carbsG: Number(per100.carbs.toFixed(4)),
      fatG: Number(per100.fat.toFixed(4)),
      fiberG: Number(per100.fiber.toFixed(4)),
      micronutrients,
      portions,
    },
  };
}

function parseFatSecretError(payload: unknown): FatSecretError | null {
  const err = (payload as { error?: FatSecretError })?.error;
  return err ?? null;
}

async function getFatSecretToken(clientId: string, clientSecret: string, scope: string): Promise<string> {
  const nowMs = Date.now();
  if (tokenCache && tokenCache.expiresAtMs - nowMs > 60_000) {
    return tokenCache.token;
  }

  const authHeader = btoa(`${clientId}:${clientSecret}`);
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

  const raw = await response.text();
  const parsed = JSON.parse(raw) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!response.ok || !parsed.access_token) {
    throw new Error(parsed.error_description ?? parsed.error ?? raw.slice(0, 300));
  }

  const expiresIn = Number(parsed.expires_in ?? 3600);
  tokenCache = {
    token: parsed.access_token,
    expiresAtMs: nowMs + expiresIn * 1000,
  };
  return parsed.access_token;
}

async function callFatSecret(
  accessToken: string,
  methodName: string,
  params: Record<string, string>
): Promise<Record<string, unknown>> {
  const payload = new URLSearchParams({
    method: methodName,
    format: "json",
    ...params,
  });

  const response = await fetch(FATSECRET_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload.toString(),
  });

  const raw = await response.text();
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const err = parseFatSecretError(parsed);
  if (!response.ok || err) {
    const code = String(err?.code ?? "http_error");
    const message = String(err?.message ?? err?.error_message ?? raw.slice(0, 200));
    throw new Error(`${methodName}: code=${code} message=${message}`);
  }

  return parsed;
}

async function callFatSecretWithFallback(
  accessToken: string,
  methods: string[],
  params: Record<string, string>
): Promise<Record<string, unknown>> {
  const errors: string[] = [];
  for (const methodName of methods) {
    try {
      return await callFatSecret(accessToken, methodName, params);
    } catch (error) {
      errors.push(`${methodName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(errors.join(" | "));
}

function plus24HoursIso(now = new Date()): string {
  return new Date(now.getTime() + CACHE_MAX_AGE_HOURS * 60 * 60 * 1000).toISOString();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok");
  }

  try {
    if (request.method !== "POST") {
      return jsonResponse(405, { error: "Method not allowed" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const fatsecretClientId = Deno.env.get("FATSECRET_CLIENT_ID");
    const fatsecretClientSecret = Deno.env.get("FATSECRET_CLIENT_SECRET");
    const fatsecretScope = Deno.env.get("FATSECRET_SCOPE") ?? "premier barcode basic";

    if (!supabaseUrl || !supabaseAnon || !supabaseService) {
      return jsonResponse(500, { error: "Supabase environment is not configured" });
    }
    if (!fatsecretClientId || !fatsecretClientSecret) {
      return jsonResponse(500, { error: "FatSecret credentials are not configured" });
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, { error: "Missing Authorization header" });
    }

    const authedClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const {
      data: { user },
      error: userError,
    } = await authedClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse(401, { error: "Invalid user session" });
    }

    const admin = createClient(supabaseUrl, supabaseService, {
      auth: { persistSession: false },
    });

    const body = (await request.json()) as BarcodeRequest;
    const barcode = normalizeBarcode(body?.barcode);
    if (!barcode) {
      return jsonResponse(400, { error: "Invalid barcode. Provide a 8-14 digit barcode." });
    }

    const region = String(body?.region ?? "GB");
    const language = String(body?.language ?? "en");

    await admin.rpc("purge_expired_fatsecret_food_cache").throwOnError().catch(() => null);

    const { data: existingMap } = await admin
      .from("fatsecret_barcode_map")
      .select("barcode, food_id, serving_id")
      .eq("barcode", barcode)
      .maybeSingle();

    if (existingMap?.food_id) {
      const { data: cached } = await admin
        .from("fatsecret_food_cache")
        .select("food_id, serving_id, payload, fetched_at, expires_at")
        .eq("food_id", existingMap.food_id)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (cached?.payload) {
        const response: BarcodeResponse = {
          found: true,
          barcode,
          source: "fatsecret",
          foodId: String(cached.food_id),
          servingId: cached.serving_id ? String(cached.serving_id) : null,
          fetchedAt: String(cached.fetched_at),
          expiresAt: String(cached.expires_at),
          food: cached.payload as ResolvedFoodPayload,
        };
        return jsonResponse(200, response);
      }
    }

    const accessToken = await getFatSecretToken(fatsecretClientId, fatsecretClientSecret, fatsecretScope);

    let food: FatSecretFood | null = null;
    let foodId = "";
    let servingId: string | null = null;

    if (existingMap?.food_id) {
      const detail = await callFatSecretWithFallback(
        accessToken,
        ["food.get.v5", "food.get.v4", "food.get.v3", "food.get.v2", "food.get"],
        {
          food_id: String(existingMap.food_id),
          region,
          language,
        }
      );
      food = (detail.food ?? detail) as FatSecretFood;
      foodId = String(food.food_id ?? existingMap.food_id);
    } else {
      const found = await callFatSecretWithFallback(
        accessToken,
        ["food.find_id_for_barcode.v2"],
        {
          barcode,
          region,
          language,
        }
      );
      food = (found.food ?? found) as FatSecretFood;
      foodId = String(food.food_id ?? "").trim();
      if (!foodId) {
        const response: BarcodeResponse = {
          found: false,
          barcode,
          source: "fatsecret",
          errorCode: "211",
          errorMessage: "No food item detected",
        };
        return jsonResponse(200, response);
      }
    }

    const resolved = buildResolvedFood(food);
    servingId = resolved.servingId;
    const fetchedAt = new Date().toISOString();
    const expiresAt = plus24HoursIso();

    await admin
      .from("fatsecret_barcode_map")
      .upsert(
        {
          barcode,
          source: "fatsecret",
          food_id: foodId,
          serving_id: servingId,
          updated_at: fetchedAt,
        },
        { onConflict: "barcode" }
      )
      .throwOnError();

    await admin
      .from("fatsecret_food_cache")
      .upsert(
        {
          food_id: foodId,
          serving_id: servingId,
          payload: resolved.payload,
          fetched_at: fetchedAt,
          expires_at: expiresAt,
          updated_at: fetchedAt,
        },
        { onConflict: "food_id" }
      )
      .throwOnError();

    const response: BarcodeResponse = {
      found: true,
      barcode,
      source: "fatsecret",
      foodId,
      servingId,
      fetchedAt,
      expiresAt,
      food: resolved.payload,
    };
    return jsonResponse(200, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse(500, { error: message });
  }
});
