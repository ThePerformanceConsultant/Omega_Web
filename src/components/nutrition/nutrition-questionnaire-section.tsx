"use client";

import { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  User,
  Activity,
  Target,
  Heart,
  Utensils,
  Home,
  Clock,
  BookOpen,
  Calculator,
  Zap,
} from "lucide-react";
import type { NutritionOnboardingData } from "@/lib/nutrition-questionnaire-data";
import {
  calculateTDEEFromOnboarding,
  calculateAge,
  PAL_MULTIPLIERS,
} from "@/lib/nutrition-questionnaire-data";

// ── TDEE Calculator Card ──────────────────────────────────────────────────

interface TDEECalculatorCardProps {
  data: NutritionOnboardingData;
  currentWeight?: number;
  onApplyCalories?: (kcal: number) => void;
}

export function TDEECalculatorCard({
  data,
  currentWeight,
  onApplyCalories,
}: TDEECalculatorCardProps) {
  const [palOverride, setPalOverride] = useState<NutritionOnboardingData["activityLevel"] | null>(null);

  const result = useMemo(() => {
    const modifiedData = palOverride
      ? { ...data, activityLevel: palOverride }
      : data;
    return calculateTDEEFromOnboarding(modifiedData, currentWeight);
  }, [data, currentWeight, palOverride]);

  if (!result) return null;

  const age = calculateAge(data.dateOfBirth);
  const activeLevel = palOverride ?? data.activityLevel;

  return (
    <div className="rounded-xl border border-accent/20 bg-accent/[0.03] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-accent/10">
        <Calculator size={12} className="text-accent" />
        <span className="text-xs font-semibold text-foreground">
          TDEE Calculator
        </span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Input metrics */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Height", value: `${data.heightCm} cm` },
            { label: "Weight", value: `${currentWeight ?? data.weightKg} kg` },
            { label: "Age", value: `${age} y` },
            { label: "Gender", value: data.gender === "male" ? "Male" : data.gender === "female" ? "Female" : "Other" },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div className="text-[9px] text-muted">{item.label}</div>
              <div className="text-[11px] font-semibold text-foreground">{item.value}</div>
            </div>
          ))}
        </div>

        {/* PAL level selector */}
        <div>
          <label className="block text-[10px] text-muted mb-1">
            Activity Level (PAL)
          </label>
          <div className="relative">
            <select
              value={activeLevel}
              onChange={(e) =>
                setPalOverride(
                  e.target.value as NutritionOnboardingData["activityLevel"]
                )
              }
              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-black/10 text-xs text-foreground focus:outline-none focus:border-accent/50 appearance-none pr-7"
            >
              {Object.entries(PAL_MULTIPLIERS).map(([level, mult]) => (
                <option key={level} value={level}>
                  {level} (×{mult})
                </option>
              ))}
            </select>
            <ChevronDown
              size={10}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
          </div>
        </div>

        {/* Results */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-white border border-black/5 p-2 text-center">
            <div className="text-[9px] text-muted">BMR</div>
            <div className="text-sm font-bold text-foreground">
              {result.bmr}
            </div>
            <div className="text-[8px] text-muted">kcal</div>
          </div>
          <div className="rounded-lg bg-white border border-black/5 p-2 text-center">
            <div className="text-[9px] text-muted">PAL</div>
            <div className="text-sm font-bold text-accent">
              ×{result.pal.toFixed(2)}
            </div>
          </div>
          <div className="rounded-lg bg-accent/10 border border-accent/20 p-2 text-center">
            <div className="text-[9px] text-accent">TDEE</div>
            <div className="text-sm font-bold text-accent">
              {result.tdee}
            </div>
            <div className="text-[8px] text-accent">kcal</div>
          </div>
        </div>

        {/* Apply button */}
        {onApplyCalories && (
          <button
            onClick={() => onApplyCalories(result.tdee)}
            className="w-full py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-[10px] font-medium text-accent hover:bg-accent/15 transition-colors flex items-center justify-center gap-1.5"
          >
            <Zap size={10} /> Apply {result.tdee} kcal to plan
          </button>
        )}
      </div>
    </div>
  );
}

// ── Questionnaire Display Sections ────────────────────────────────────────

interface NutritionQuestionnaireSectionProps {
  data: NutritionOnboardingData;
  currentWeight?: number;
  onApplyCalories?: (kcal: number) => void;
}

export function NutritionQuestionnaireSection({
  data,
  currentWeight,
  onApplyCalories,
}: NutritionQuestionnaireSectionProps) {
  return (
    <div className="space-y-3">
      {/* TDEE Calculator — top position for coach workflow */}
      <TDEECalculatorCard
        data={data}
        currentWeight={currentWeight}
        onApplyCalories={onApplyCalories}
      />

      {/* Questionnaire sections */}
      <CollapsibleSection
        icon={<User size={12} className="text-blue-600" />}
        title="Personal"
        fields={[
          { label: "Date of Birth", value: data.dateOfBirth },
          { label: "Gender", value: data.gender },
          { label: "Height", value: `${data.heightCm} cm` },
          { label: "Weight", value: `${data.weightKg} kg` },
          { label: "Occupation", value: data.occupation },
        ]}
      />

      <CollapsibleSection
        icon={<Activity size={12} className="text-green-600" />}
        title="Activity"
        fields={[
          { label: "Activity Level", value: data.activityLevel },
          { label: "Daily Steps", value: data.dailyStepCount },
          { label: "Training Schedule", value: data.trainingDaysDescription },
          { label: "Training Style", value: data.trainingStyle },
          { label: "Competition Info", value: data.competitionInfo },
        ]}
      />

      <CollapsibleSection
        icon={<Target size={12} className="text-purple-600" />}
        title="Goals"
        fields={[
          { label: "Exercise Reasons", value: data.exerciseReasons.join(", ") },
          { label: "Primary Goal", value: data.primaryGoal },
          { label: "Motivation (1-10)", value: `${data.motivationLevel}` },
          { label: "6-Month Vision", value: data.sixMonthVision },
          { label: "Previous Coaching", value: data.previousCoachingExperience },
          { label: "Top 3 Goals", value: data.top3Goals.join(", ") },
        ]}
      />

      <CollapsibleSection
        icon={<Heart size={12} className="text-red-500" />}
        title="Health"
        fields={[
          { label: "Medical Conditions", value: data.medicalConditions },
          { label: "Medications", value: data.medications },
          { label: "Menstrual Cycle", value: data.menstrualCycle },
          { label: "Daily Water", value: `${data.dailyWaterLitres} L` },
        ]}
      />

      <CollapsibleSection
        icon={<Utensils size={12} className="text-amber-600" />}
        title="Dietary"
        fields={[
          { label: "Preferences", value: data.dietaryPreferences.join(", ") },
          { label: "Restrictions/Allergies", value: data.restrictionsAllergies },
          { label: "Favourite Foods", value: data.favouriteFoods },
          { label: "Least Favourite", value: data.leastFavouriteFoods },
          { label: "Preferred Cuisines", value: data.preferredCuisines.join(", ") },
        ]}
      />

      <CollapsibleSection
        icon={<Home size={12} className="text-teal-600" />}
        title="Lifestyle"
        fields={[
          { label: "Alcohol", value: data.alcoholFrequency },
          { label: "Off-Plan Frequency", value: data.offPlanFrequency },
          { label: "Snack Preference", value: data.snackPreference },
          { label: "Max Cooking Time", value: data.maxCookingTime },
          { label: "Meal Prep", value: data.mealPrepOptions.join(", ") },
          { label: "Variety Preference", value: data.varietyPreference },
        ]}
      />

      <CollapsibleSection
        icon={<Clock size={12} className="text-indigo-500" />}
        title="Appetite"
        fields={[
          { label: "Most Hungry", value: data.mostHungryTime },
          { label: "Least Hungry", value: data.leastHungryTime },
        ]}
      />

      <CollapsibleSection
        icon={<BookOpen size={12} className="text-rose-500" />}
        title="Current Eating"
        fields={[
          { label: "Typical Training Day", value: data.typicalTrainingDay },
          { label: "Workout Nutrition", value: data.workoutNutrition },
          { label: "Additional Notes", value: data.additionalNotes },
        ]}
      />
    </div>
  );
}

// ── Generic Collapsible Section ───────────────────────────────────────────

function CollapsibleSection({
  icon,
  title,
  fields,
}: {
  icon: React.ReactNode;
  title: string;
  fields: { label: string; value: string | null }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const validFields = fields.filter(
    (f) => f.value !== null && f.value !== undefined && f.value.trim() !== ""
  );

  if (validFields.length === 0) return null;

  return (
    <div className="rounded-xl border border-black/10 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-black/[0.02] transition-colors"
      >
        {expanded ? (
          <ChevronDown size={10} className="text-muted shrink-0" />
        ) : (
          <ChevronRight size={10} className="text-muted shrink-0" />
        )}
        {icon}
        <span className="text-[11px] font-semibold text-foreground flex-1 text-left">
          {title}
        </span>
        <span className="text-[9px] text-muted">
          {validFields.length} fields
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-1.5 border-t border-black/5">
          {validFields.map((field) => (
            <div key={field.label} className="flex items-start gap-2 py-0.5">
              <span className="text-[10px] text-muted w-28 shrink-0 pt-0.5">
                {field.label}
              </span>
              <span className="text-[10px] font-medium text-foreground leading-relaxed">
                {field.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
