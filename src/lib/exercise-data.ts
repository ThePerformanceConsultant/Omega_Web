// Temporary local exercise data parsed from CSV
// This will be replaced by Supabase queries once connected

import { Exercise } from "./types";

function extractYouTubeId(url: string): string | null {
  if (!url || url === "No link found" || url.includes("instagram.com")) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function getThumbnail(url: string | null): string | null {
  if (!url) return null;
  const id = extractYouTubeId(url);
  if (!id) return null;
  return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
}

function normalizeVideoUrl(url: string): string | null {
  if (!url || url === "No link found") return null;
  if (url.includes("instagram.com")) return null;
  if (!url.includes("youtube.com") && !url.includes("youtu.be")) return null;

  const id = extractYouTubeId(url);
  if (!id) return null;
  return `https://www.youtube.com/watch?v=${id}`;
}

const CSV_MUSCLE_MAP: Record<string, string> = {
  "Abs/Core": "Core",
  "Adductors": "Hip & Groin",
  "Adductors ": "Hip & Groin",
  "Back": "Mid Back",
  "Upper Back": "Upper Back & Neck",
  "Biceps": "Biceps",
  "Calves": "Lower Leg",
  "Chest": "Chest",
  "Shoulders": "Shoulders",
  "Forearms": "Forearms",
  "Glutes": "Glutes",
  "Full Body": "Full Body",
  "Hamstrings": "Hamstrings",
  "Quads": "Quads",
  "Rotator Cuff": "Shoulders",
  "Triceps": "Triceps",
  "Lower Back": "Lower Back",
};

function mapMuscle(csv: string): string {
  return CSV_MUSCLE_MAP[csv.trim()] || csv.trim();
}

// Raw CSV data parsed into exercises
const RAW_EXERCISES: Array<{
  name: string;
  url: string;
  repsMin: number;
  repsMax: number;
  rpe: number;
  rest: number;
  primary: string;
  others: string;
  fn: string;
  notes: string;
}> = [
  { name: "Crunches", url: "", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Abs/Core", others: "", fn: "Strength", notes: "" },
  { name: "Dragon Flag", url: "", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Abs/Core", others: "", fn: "Strength", notes: "" },
  { name: "Landmine Twists", url: "", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Abs/Core", others: "", fn: "Strength", notes: "" },
  { name: "Parallel Bar Leg Raises", url: "", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Abs/Core", others: "", fn: "Strength", notes: "" },
  { name: "Toes To Bar", url: "", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Abs/Core", others: "", fn: "Strength", notes: "" },
  { name: "Bag Pull-throughs", url: "", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Abs/Core", others: "", fn: "Strength", notes: "" },
  { name: "Hanging Leg Raises", url: "https://www.youtube.com/watch?v=7FwGZ8qY5OU", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Abs/Core", others: "", fn: "Strength", notes: "" },
  { name: "Dead Bug", url: "https://www.youtube.com/watch?v=MCVX9wRd_h0", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Abs/Core", others: "", fn: "Strength", notes: "" },
  { name: "Paloff Press", url: "https://www.youtube.com/watch?v=gHGLwQGvtxg", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Abs/Core", others: "", fn: "Strength", notes: "" },
  { name: "V-Sit Up", url: "https://www.youtube.com/watch?v=NxkukiEoh3g", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Abs/Core", others: "", fn: "Strength", notes: "" },
  { name: "L-Sits", url: "https://www.youtube.com/watch?v=WHi1bvZLwlw", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Abs/Core", others: "", fn: "Strength", notes: "" },
  { name: "Bird Dog", url: "https://www.youtube.com/watch?v=wgOuR7YrwtM", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Abs/Core", others: "", fn: "Strength", notes: "" },
  { name: "Cable Crunches", url: "https://www.youtube.com/watch?v=6GMKPQVERzw", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Abs/Core", others: "", fn: "Strength", notes: "" },
  { name: "Seated Leg Raises", url: "https://youtube.com/shorts/KDbFKEScp1M", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Abs/Core", others: "", fn: "Strength", notes: "" },
  { name: "Plank Shoulder Taps", url: "https://www.youtube.com/watch?v=C6At19Q9i2Q", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Abs/Core", others: "", fn: "Strength", notes: "" },
  { name: "RKC Planks", url: "https://www.youtube.com/watch?v=6TKktamzq4o", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Abs/Core", others: "", fn: "Strength", notes: "" },
  { name: "Adductor Machine", url: "https://www.youtube.com/watch?v=zMoa6dEUYnA", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Adductors", others: "", fn: "Strength", notes: "" },
  { name: "Copenhagen Raise", url: "https://www.youtube.com/watch?v=0Cwk_wwL6uM", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Adductors", others: "", fn: "Strength", notes: "" },
  { name: "Cossack Squat", url: "https://www.youtube.com/watch?v=LeftjeTkSts", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Adductors", others: "Quads, Glutes", fn: "Strength", notes: "" },
  { name: "Pull Ups", url: "https://www.youtube.com/watch?v=iWpoegdfgtc", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Back", others: "", fn: "Strength", notes: "" },
  { name: "Pull Ups (Assisted)", url: "https://www.youtube.com/watch?v=ZHllQTJf7eA", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Back", others: "", fn: "Strength", notes: "" },
  { name: "Lat Pulldown (Overhand)", url: "https://www.youtube.com/watch?v=EUIri47Epcg", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Back", others: "", fn: "Strength", notes: "" },
  { name: "Lat Pulldown (Neutral)", url: "https://www.youtube.com/watch?v=--utaPT7XYQ", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Back", others: "", fn: "Strength", notes: "" },
  { name: "Lat Pulldown (Underhand)", url: "https://www.youtube.com/watch?v=VprlTxpB1rk", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Back", others: "", fn: "Strength", notes: "" },
  { name: "Lat Pulldown (Close Grip)", url: "https://www.youtube.com/watch?v=8hzVLzu-RJk", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Back", others: "", fn: "Strength", notes: "" },
  { name: "Lat Pulldown (Cable - S.Arm)", url: "https://www.youtube.com/shorts/3bTQqNAWFu8", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Back", others: "", fn: "Strength", notes: "" },
  { name: "Straight Arm Pulldown", url: "https://www.youtube.com/watch?v=G9uNaXGTJ4w", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Back", others: "", fn: "Strength", notes: "" },
  { name: "Cable Pullover", url: "https://www.youtube.com/watch?v=qruEQa3wu5w", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Back", others: "", fn: "Strength", notes: "" },
  { name: "Pullover Machine", url: "https://www.youtube.com/watch?v=oxpAl14EYyc", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Back", others: "", fn: "Strength", notes: "" },
  { name: "Dumbbell Pullover", url: "https://www.youtube.com/watch?v=FK4rHfWKEac", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Back", others: "", fn: "Strength", notes: "" },
  { name: "Barbell Row", url: "https://www.youtube.com/watch?v=6FZHJGzMFEc", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Back", others: "", fn: "Strength", notes: "" },
  { name: "Underhand Barbell Row", url: "https://www.youtube.com/watch?v=H260SUUyJBM", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Back", others: "", fn: "Strength", notes: "" },
  { name: "Pendlay Row", url: "https://youtube.com/shorts/zW2TjKDnHeo", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Back", others: "", fn: "Strength", notes: "" },
  { name: "T-Bar Row", url: "https://www.youtube.com/watch?v=yPis7nlbqdY", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Back", others: "", fn: "Strength", notes: "" },
  { name: "Meadows Row", url: "https://www.youtube.com/watch?v=sRRQgK8Fm44", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Back", others: "", fn: "Strength", notes: "" },
  { name: "Dumbbell Row (S.Arm)", url: "https://www.youtube.com/watch?v=DMo3HJoawrU", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Back", others: "", fn: "Strength", notes: "" },
  { name: "Seal Row", url: "https://www.youtube.com/watch?v=4H2ItXwUTp8", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Back", others: "", fn: "Strength", notes: "" },
  { name: "Chest Supported Dumbbell Row", url: "https://youtube.com/shorts/g8FJvfwqbtY", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Back", others: "", fn: "Strength", notes: "" },
  { name: "Inverted Row", url: "https://www.youtube.com/watch?v=KOaCM1HMwU0", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Back", others: "", fn: "Strength", notes: "" },
  { name: "Seated Row", url: "https://youtube.com/shorts/IdQb3mzBGX0", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Back", others: "", fn: "Strength", notes: "" },
  { name: "Barbell Bench Press", url: "https://www.youtube.com/watch?v=gMgvBspQ9lk", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Chest", others: "", fn: "Strength", notes: "" },
  { name: "Barbell Bench Press (Incline)", url: "https://www.youtube.com/watch?v=lJ2o89kcnxY", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Chest", others: "", fn: "Strength", notes: "" },
  { name: "Barbell Bench Press (Decline)", url: "https://www.youtube.com/watch?v=LfyQBUKR8SE", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Chest", others: "", fn: "Strength", notes: "" },
  { name: "Dumbbell Bench Press", url: "https://youtube.com/shorts/G9irZU_Wt7c", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Chest", others: "", fn: "Strength", notes: "" },
  { name: "Dumbbell Bench Press (Incline)", url: "https://youtube.com/shorts/GeGLszyVIDg", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Chest", others: "", fn: "Strength", notes: "" },
  { name: "Cable Fly (Flat)", url: "https://www.youtube.com/watch?v=m2VICOCWDA0", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Chest", others: "", fn: "Strength", notes: "" },
  { name: "Cable Fly (Incline)", url: "https://www.youtube.com/watch?v=LGDCjwO-hFg", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Chest", others: "", fn: "Strength", notes: "" },
  { name: "Pec Deck", url: "https://www.youtube.com/watch?v=FDay9wFe5uE", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Chest", others: "", fn: "Strength", notes: "" },
  { name: "Back Squat", url: "https://youtube.com/shorts/YVSE_EMUYqM", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Quads", others: "Glutes", fn: "Strength", notes: "" },
  { name: "Front Squat", url: "https://youtube.com/shorts/0qtAT5QUKTw", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Quads", others: "Glutes", fn: "Strength", notes: "" },
  { name: "Hack Squat", url: "https://youtube.com/shorts/edVP3HpVZUY", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Quads", others: "Glutes", fn: "Strength", notes: "" },
  { name: "Leg Extension", url: "https://www.youtube.com/watch?v=m0FOpMEgero", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Quads", others: "", fn: "Strength", notes: "" },
  { name: "Bulgarian Split Squat", url: "https://youtube.com/shorts/67BOceB4hfg", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Quads", others: "Glutes", fn: "Strength", notes: "" },
  { name: "Walking Lunges", url: "https://www.youtube.com/watch?v=_meXEWq5MOQ", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Quads", others: "Glutes", fn: "Strength", notes: "" },
  { name: "Deadlift", url: "https://youtube.com/shorts/_u6vsvyR5FA", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Full Body", others: "", fn: "Strength", notes: "" },
  { name: "Romanian Deadlift", url: "https://youtube.com/shorts/U7MDmuDQ7rE", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Hamstrings", others: "Glutes, Lower Back", fn: "Strength", notes: "" },
  { name: "Seated Leg Curl", url: "https://www.youtube.com/watch?v=Orxowest56U", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Hamstrings", others: "", fn: "Strength", notes: "" },
  { name: "Lying Leg Curl", url: "https://www.youtube.com/watch?v=n5WDXD_mpVY", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Hamstrings", others: "", fn: "Strength", notes: "" },
  { name: "Nordic Curl", url: "https://www.youtube.com/watch?v=kFSnvwvc5ac", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Hamstrings", others: "Glutes, Lower Back", fn: "Strength", notes: "" },
  { name: "Hip Thrust", url: "https://youtube.com/shorts/97ZG3oUvhUI", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Glutes", others: "", fn: "Strength", notes: "" },
  { name: "Glute Bridge", url: "https://www.youtube.com/watch?v=FMyg_gsA0mI", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Glutes", others: "", fn: "Strength", notes: "" },
  { name: "Cable Glute Kickback", url: "https://www.youtube.com/shorts/lbTLm-Z49R8", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Glutes", others: "", fn: "Strength", notes: "" },
  { name: "Abductor Machine", url: "https://www.youtube.com/watch?v=bwGZyWBXyb0", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Glutes", others: "", fn: "Strength", notes: "" },
  { name: "Seated Military Press", url: "https://www.youtube.com/watch?v=HzIiNhHhhtA", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Shoulders", others: "", fn: "Strength", notes: "" },
  { name: "Standing Military Press", url: "https://www.youtube.com/watch?v=G2qpTG1Eh40", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Shoulders", others: "", fn: "Strength", notes: "" },
  { name: "Arnold Press (Seated)", url: "https://www.youtube.com/watch?v=6Z15_WdXmVw", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Shoulders", others: "", fn: "Strength", notes: "" },
  { name: "Dumbbell Lateral Raise", url: "https://www.youtube.com/watch?v=OuG1smZTsQQ", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Shoulders", others: "", fn: "Strength", notes: "" },
  { name: "Lateral Raise Machine", url: "https://www.youtube.com/watch?v=0o07iGKUarI", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Shoulders", others: "", fn: "Strength", notes: "" },
  { name: "Cable Upright Row", url: "https://www.youtube.com/watch?v=qr3ziolhjvQ", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Shoulders", others: "", fn: "Strength", notes: "" },
  { name: "Face Pull", url: "https://www.youtube.com/watch?v=-MODnZdnmAQ", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Upper Back", others: "", fn: "Strength", notes: "" },
  { name: "Reverse Fly Machine", url: "https://www.youtube.com/watch?v=5YK4bgzXDp0", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Upper Back", others: "", fn: "Strength", notes: "" },
  { name: "Dumbbell Bicep Curl", url: "https://www.youtube.com/watch?v=HnHuhf4hEWY", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Biceps", others: "", fn: "Strength", notes: "" },
  { name: "Barbell Curl", url: "https://www.youtube.com/watch?v=BVrlItPBX8M", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Biceps", others: "", fn: "Strength", notes: "" },
  { name: "Preacher Curl", url: "https://www.youtube.com/watch?v=sxA__DoLsgo", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Biceps", others: "", fn: "Strength", notes: "" },
  { name: "Cable Bicep Curl", url: "https://www.youtube.com/watch?v=rfRdD5PKrko", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Biceps", others: "", fn: "Strength", notes: "" },
  { name: "Chin Ups", url: "https://www.youtube.com/watch?v=mRy9m2Q9_1I", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Back", others: "", fn: "Strength", notes: "" },
  { name: "Tricep Rope Pushdown", url: "", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Triceps", others: "", fn: "Strength", notes: "" },
  { name: "Close Grip Bench Press", url: "", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Triceps", others: "", fn: "Strength", notes: "" },
  { name: "Dips", url: "", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Chest", others: "Triceps", fn: "Strength", notes: "" },
  { name: "Standing Calf Raise", url: "https://www.youtube.com/watch?v=1lKjFPrYqf0", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Calves", others: "", fn: "Strength", notes: "" },
  { name: "Seated Calf Raise", url: "https://www.youtube.com/watch?v=71lLP3aglGQ", repsMin: 6, repsMax: 15, rpe: 9.5, rest: 90, primary: "Calves", others: "", fn: "Strength", notes: "" },
];

// Build full exercise objects from raw data
let nextId = 1;
const seen = new Set<string>();

export const EXERCISES: Exercise[] = RAW_EXERCISES.filter((ex) => {
  if (!ex.name || seen.has(ex.name)) return false;
  seen.add(ex.name);
  return true;
}).map((ex) => {
  const videoUrl = normalizeVideoUrl(ex.url);
  const primaryMapped = mapMuscle(ex.primary);
  const otherMuscles = ex.others
    ? ex.others
        .split(",")
        .map((s) => mapMuscle(s))
        .filter(Boolean)
    : [];
  const muscleGroups = [primaryMapped, ...otherMuscles].slice(0, 3);
  const modality = ex.fn === "Prehab/Mobility" ? "Mobility" : (ex.fn as Exercise["modality"]) || "Strength";

  return {
    id: nextId++,
    coach_id: null,
    name: ex.name,
    primary_muscle_group: primaryMapped,
    muscle_groups: muscleGroups,
    modality,
    movement_patterns: [],
    video_url: videoUrl,
    thumbnail_url: getThumbnail(videoUrl),
    instructions: null,
    default_note: null,
    default_reps_min: ex.repsMin,
    default_reps_max: ex.repsMax,
    default_rpe: ex.rpe,
    default_rest_seconds: ex.rest,
    default_tracking_fields: modality === "Mobility" ? ["Reps", "Weight"] : ["Reps", "Weight", "RPE"],
    alternate_exercise_ids: [],
    is_global: true,
    created_at: new Date().toISOString(),
  };
});
