/**
 * Nutrition onboarding questionnaire data model, mock data, and TDEE calculator.
 * 36 questions spanning: personal, activity, goals, health, dietary, lifestyle, appetite, current eating.
 */

// ── Interface ─────────────────────────────────────────────────────────────

export interface NutritionOnboardingData {
  clientId: string;

  // Personal
  dateOfBirth: string; // ISO date
  gender: "male" | "female" | "other";
  heightCm: number;
  weightKg: number;
  occupation: string;

  // Activity
  activityLevel: "Sedentary" | "Lightly Active" | "Moderately Active" | "Very Active" | "Extremely Active";
  dailyStepCount: string; // range like "5000-8000"
  trainingDaysDescription: string;
  trainingStyle: string;
  competitionInfo: string | null;

  // Goals
  exerciseReasons: string[];
  primaryGoal: string;
  motivationLevel: number; // 1-10
  sixMonthVision: string;
  previousCoachingExperience: string | null;
  top3Goals: string[];

  // Health
  medicalConditions: string | null;
  medications: string | null;
  menstrualCycle: string | null; // only for females
  dailyWaterLitres: number;

  // Dietary
  dietaryPreferences: string[];
  restrictionsAllergies: string | null;
  favouriteFoods: string;
  leastFavouriteFoods: string;
  preferredCuisines: string[];

  // Lifestyle
  alcoholFrequency: string;
  offPlanFrequency: string;
  snackPreference: string;
  maxCookingTime: string;
  mealPrepOptions: string[];
  varietyPreference: string;

  // Appetite
  mostHungryTime: string;
  leastHungryTime: string;

  // Current Eating
  typicalTrainingDay: string;
  workoutNutrition: string;

  // Other
  additionalNotes: string | null;
}

// ── PAL multipliers for TDEE calculation ──────────────────────────────────

export const PAL_MULTIPLIERS: Record<NutritionOnboardingData["activityLevel"], number> = {
  "Sedentary": 1.2,
  "Lightly Active": 1.375,
  "Moderately Active": 1.55,
  "Very Active": 1.725,
  "Extremely Active": 1.9,
};

// ── TDEE calculator utilities ─────────────────────────────────────────────

/** Calculate age from ISO date of birth */
export function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/** Mifflin-St Jeor equation for BMR */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: "male" | "female" | "other"
): number {
  // For "other" gender, average of male and female
  const maleResult = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  const femaleResult = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  if (gender === "male") return Math.round(maleResult);
  if (gender === "female") return Math.round(femaleResult);
  return Math.round((maleResult + femaleResult) / 2);
}

/** Calculate TDEE from onboarding data */
export function calculateTDEEFromOnboarding(
  data: NutritionOnboardingData,
  currentWeight?: number
): { bmr: number; tdee: number; pal: number } | null {
  const weight = currentWeight ?? data.weightKg;
  if (!weight || !data.heightCm || !data.dateOfBirth || !data.gender) {
    return null;
  }

  const age = calculateAge(data.dateOfBirth);
  if (age <= 0 || age > 120) return null;

  const bmr = calculateBMR(weight, data.heightCm, age, data.gender);
  const pal = PAL_MULTIPLIERS[data.activityLevel] ?? 1.55;
  const tdee = Math.round(bmr * pal);

  return { bmr, tdee, pal };
}

