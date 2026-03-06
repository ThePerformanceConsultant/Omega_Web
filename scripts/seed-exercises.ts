/**
 * One-time seed script to insert exercises from exercise-data.ts into Supabase.
 * Run with: npx tsx scripts/seed-exercises.ts
 *
 * Uses upsert keyed on name for idempotency — safe to run multiple times.
 */

import { createClient } from "@supabase/supabase-js";

// Import the parsed exercises from the data file
// We need to use a relative path from the scripts directory
import { EXERCISES } from "../src/lib/exercise-data";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seed() {
  console.log(`Seeding ${EXERCISES.length} exercises...`);

  // Insert in batches of 50 to avoid request size limits
  const BATCH_SIZE = 50;
  let inserted = 0;

  for (let i = 0; i < EXERCISES.length; i += BATCH_SIZE) {
    const batch = EXERCISES.slice(i, i + BATCH_SIZE).map((ex) => ({
      // Omit id so Postgres auto-generates
      coach_id: null,
      name: ex.name,
      primary_muscle_group: ex.primary_muscle_group,
      muscle_groups: ex.muscle_groups,
      modality: ex.modality,
      movement_patterns: ex.movement_patterns,
      video_url: ex.video_url,
      thumbnail_url: ex.thumbnail_url,
      instructions: ex.instructions,
      default_note: ex.default_note,
      default_reps_min: ex.default_reps_min,
      default_reps_max: ex.default_reps_max,
      default_rpe: ex.default_rpe,
      default_rest_seconds: ex.default_rest_seconds,
      default_tracking_fields: ex.default_tracking_fields,
      alternate_exercise_ids: ex.alternate_exercise_ids,
      is_global: true,
    }));

    const { error } = await supabase.from("exercises").upsert(batch, {
      onConflict: "name",
    });

    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`  Batch ${i / BATCH_SIZE + 1}: ${batch.length} exercises upserted`);
    }
  }

  console.log(`Done! ${inserted} exercises seeded.`);
}

seed().catch(console.error);
