// ==========================================
// Exercise Library Types
// ==========================================

export const MODALITY_OPTIONS = [
  "Cardio",
  "Conditioning",
  "Mobility",
  "Myofascial Release",
  "Power",
  "Skill",
  "Strength",
] as const;

export type Modality = (typeof MODALITY_OPTIONS)[number];

export const MUSCLE_GROUP_OPTIONS = [
  "Biceps",
  "Chest",
  "Core",
  "Forearms",
  "Full Body",
  "Glutes",
  "Hamstrings",
  "Hip & Groin",
  "Lower Back",
  "Lower Body",
  "Lower Leg",
  "Mid Back",
  "Quads",
  "Shoulders",
  "Triceps",
  "Upper Back & Neck",
  "Upper Body",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUP_OPTIONS)[number];

export const MOVEMENT_PATTERN_OPTIONS = [
  "Lower Body Push",
  "Lower Body Hinge",
  "Carry",
  "Upper Pull",
  "Upper Push",
  "Lower Pull",
  "Lower Push",
  "Full Body",
  "Olympic",
  "Gymnastic",
] as const;

export type MovementPattern = (typeof MOVEMENT_PATTERN_OPTIONS)[number];

export const TRACKING_FIELD_OPTIONS = [
  "Time",
  "Distance",
  "Reps",
  "%1RM",
  "Weight",
  "RPE",
  "Cal",
] as const;

export type TrackingField = (typeof TRACKING_FIELD_OPTIONS)[number];

// ==========================================
// Set Type System (per-exercise tracking)
// ==========================================

export interface SetTypeColumn {
  key: string;
  label: string;
  type: "num" | "text";
}

export const SET_TYPE_OPTIONS: Record<string, { label: string; columns: SetTypeColumn[] }> = {
  "Weight/Reps/RPE": {
    label: "Weight / Reps / RPE",
    columns: [
      { key: "weight", label: "Weight", type: "num" },
      { key: "min_reps", label: "Min Reps", type: "num" },
      { key: "max_reps", label: "Max Reps", type: "num" },
      { key: "rpe", label: "RPE", type: "num" },
    ],
  },
  "Cal/RPE": {
    label: "Cal / RPE",
    columns: [
      { key: "calories", label: "Cal", type: "num" },
      { key: "rpe", label: "RPE", type: "num" },
    ],
  },
  "Time": {
    label: "Time",
    columns: [
      { key: "duration", label: "Duration", type: "text" },
    ],
  },
  "Weight/Reps/%1RM": {
    label: "Weight / Reps / %1RM",
    columns: [
      { key: "weight", label: "Weight", type: "num" },
      { key: "min_reps", label: "Min Reps", type: "num" },
      { key: "max_reps", label: "Max Reps", type: "num" },
      { key: "pct_1rm", label: "%1RM", type: "num" },
    ],
  },
  "Distance/RPE": {
    label: "Distance / RPE",
    columns: [
      { key: "distance", label: "Distance", type: "text" },
      { key: "rpe", label: "RPE", type: "num" },
    ],
  },
  "Time/Weight/RPE": {
    label: "Time / Weight / RPE",
    columns: [
      { key: "duration", label: "Duration", type: "text" },
      { key: "weight", label: "Weight", type: "num" },
      { key: "rpe", label: "RPE", type: "num" },
    ],
  },
  "Free Text": {
    label: "Free Text (Whiteboard)",
    columns: [],
  },
};

export type SetType = keyof typeof SET_TYPE_OPTIONS;

export interface Exercise {
  id: number;
  coach_id: string | null;
  name: string;
  primary_muscle_group: string;
  muscle_groups: string[];
  modality: Modality;
  movement_patterns: string[];
  video_url: string | null;
  thumbnail_url: string | null;
  instructions: string | null;
  default_note: string | null;
  default_reps_min: number | null;
  default_reps_max: number | null;
  default_rpe: number | null;
  default_rest_seconds: number;
  default_tracking_fields: string[];
  alternate_exercise_ids: number[];
  is_global: boolean;
  created_at: string;
}

// ==========================================
// Program Types
// ==========================================

export interface Program {
  id: number;
  coach_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  program_phases?: ProgramPhase[];
}

export interface ProgramPhase {
  id: number;
  program_id: number;
  name: string;
  weeks: number;
  focus: string | null;
  description: string | null;
  sort_order: number;
  phase_workouts?: PhaseWorkout[];
}

export interface PhaseWorkout {
  id: number;
  phase_id: number;
  name: string;
  sort_order: number;
  scheduled_weekday?: number | null; // 1=Sun ... 7=Sat
  workout_sections?: WorkoutSection[];
  workout_exercises?: WorkoutExercise[];
}

export interface WorkoutSection {
  id: number;
  workout_id: number;
  name: string;
  notes: string | null;
  sort_order: number;
}

export interface WorkoutExercise {
  id: number;
  workout_id: number;
  section_id: number | null;
  exercise_id: number | null;
  name: string;
  muscle_group: string | null;
  sets: number;
  weight: number;
  min_reps: number;
  max_reps: number;
  rest_seconds: number;
  notes: string | null;
  sort_order: number;
}

// ==========================================
// Client Types
// ==========================================

export interface Client {
  id: string;
  full_name: string;
  avatar_initials: string | null;
  email: string | null;
  tag: string | null;
  current_weight: number | null;
  current_phase: string | null;
  compliance_pct: number;
  streak_days: number;
}

// ==========================================
// Form Types
// ==========================================

export const FORM_QUESTION_TYPES = [
  "section_header",
  "short_text",
  "long_text",
  "number",
  "number_scale",
  "single_choice",
  "slider",
  "yes_no",
  "multiple_choice",
  "metrics",
  "star_rating",
  "signature_draw",
  "signature_caption",
] as const;

export type FormQuestionType = (typeof FORM_QUESTION_TYPES)[number];

export const FORM_QUESTION_TYPE_META: Record<
  FormQuestionType,
  { label: string; description: string; icon: string }
> = {
  section_header:    { label: "Section Header",   description: "Display-only heading and helper text", icon: "Heading1" },
  short_text:        { label: "Short Text",       description: "Single-line text input",          icon: "Type" },
  long_text:         { label: "Long Text",        description: "Multi-line text area",            icon: "AlignLeft" },
  number:            { label: "Number",           description: "Numeric input",                   icon: "Hash" },
  number_scale:      { label: "Number Scale",     description: "1–10 numbered scale",             icon: "Hash" },
  single_choice:     { label: "Single Choice",    description: "Select one from a list",          icon: "CircleDot" },
  slider:            { label: "Slider",           description: "Configurable min / max slider",   icon: "SlidersHorizontal" },
  yes_no:            { label: "Yes / No",         description: "Boolean yes or no toggle",        icon: "ToggleLeft" },
  multiple_choice:   { label: "Multiple Choice",  description: "Select from a list of options",   icon: "ListChecks" },
  metrics:           { label: "Metrics",          description: "Body measurement input fields",   icon: "Ruler" },
  star_rating:       { label: "Star Rating",      description: "1–5 star rating",                 icon: "Star" },
  signature_draw:    { label: "Drawn Signature",        description: "Drawn signature capture field",   icon: "PenTool" },
  signature_caption: { label: "Typed Signature (Legacy)", description: "Confirmation text input field",   icon: "PenTool" },
};

export const FORM_TYPE_OPTIONS = ["check_in", "custom", "review", "onboarding", "nutrition_intake"] as const;
export type FormType = (typeof FORM_TYPE_OPTIONS)[number];

export const FORM_TYPE_META: Record<
  FormType,
  { label: string; description: string; color: string; bgColor: string }
> = {
  check_in: {
    label: "Check-In",
    description: "Regular check-in forms for tracking client progress and feedback",
    color: "text-accent",
    bgColor: "bg-accent/15",
  },
  custom: {
    label: "Custom",
    description: "Custom standalone forms for specific purposes",
    color: "text-success",
    bgColor: "bg-success/15",
  },
  review: {
    label: "Review",
    description: "Quarterly or monthly review forms for in-depth assessments",
    color: "text-warning",
    bgColor: "bg-warning/15",
  },
  onboarding: {
    label: "Onboarding",
    description: "New client intake questionnaire covering goals, health, and training background",
    color: "text-blue-600",
    bgColor: "bg-blue-500/15",
  },
  nutrition_intake: {
    label: "Nutrition",
    description: "Comprehensive nutrition and dietary assessment for meal plan creation",
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/15",
  },
};

export type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export interface FormSchedule {
  days: DayOfWeek[];
  time: string;
}

export interface ChoiceOption {
  id: number;
  text: string;
  sortOrder: number;
}

export interface MetricField {
  id: number;
  label: string;
  unit: string;
  fieldKey: string;
}

export interface MetricsConfig {
  id: number;
  fields: MetricField[];
}

export interface FormQuestion {
  id: number;
  questionText: string;
  questionType: FormQuestionType;
  sortOrder: number;
  isRequired: boolean;
  choices: ChoiceOption[] | null;
  allowsMultipleSelection: boolean;
  metricsConfig: MetricsConfig | null;
  sliderMin: number | null;
  sliderMax: number | null;
  sliderStep: number | null;
  placeholder: string | null;
}

export interface FormTemplate {
  id: number;
  coachId: string;
  name: string;
  formType: FormType;
  questions: FormQuestion[];
  schedule: FormSchedule | null;
  assignedClientIds: string[];
  createdAt: string;
  displayDays: number | null;
  autoAssignOnSignup: boolean;
}

export interface FormSubmission {
  id: number;
  templateId: number;
  templateName: string;
  clientId: string;
  clientName: string;
  submittedAt: string;
  reviewed: boolean;
  answers: FormAnswer[];
}

export interface FormAnswer {
  id: number;
  questionId: number;
  answerText: string;
  selectedChoiceIds: number[] | null;
  numericValue: number | null;
  boolValue: boolean | null;
  metricsValues: Record<string, string> | null;
}

export type CheckInHistoryStatus = "completed" | "missed" | "pending";
export type CheckInTimelineTag = "upcoming" | "due" | "overdue" | "none";

export interface ClientCheckInTemplate {
  id: number;
  name: string;
  formType: FormType;
  questions: FormQuestion[];
}

export interface ClientCheckInHistoryItem {
  assignmentId: string;
  templateId: number;
  templateName: string;
  formType: FormType;
  dueDate: string | null;
  assignedAt: string;
  status: CheckInHistoryStatus;
  timelineTag: CheckInTimelineTag;
  responseId: number | null;
  submittedAt: string | null;
  reviewed: boolean;
  answers: FormAnswer[];
}

// ==========================================
// Messaging Types
// ==========================================

export interface Conversation {
  id: string;
  clientId: string;
  clientName: string;
  clientInitials: string;
  lastMessage: string;
  lastMessageAt: string;
  lastMessageSender: "coach" | "client";
  unreadCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: "coach" | "client";
  content: string;
  imagePath?: string | null;
  imageUrl?: string | null;
  sentAt: string;
  isRead: boolean;
}

// ==========================================
// Notifications + Settings Types
// ==========================================

export type NotificationKind =
  | "message_received"
  | "workout_assigned"
  | "workout_updated"
  | "form_due"
  | "task_due"
  | "meal_plan_published"
  | "insight_published"
  | "form_submitted"
  | "task_completed"
  | "workout_completed"
  | "checkin_submitted"
  | "curriculum_week_started"
  | "curriculum_content_unlocked"
  | "curriculum_at_risk";

export type NotificationPayload = Record<string, unknown>;

export interface NotificationItem {
  id: number;
  recipientId: string;
  actorId: string | null;
  kind: NotificationKind;
  dedupeKey: string;
  payload: NotificationPayload;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export type NotificationPrefs = Record<NotificationKind, boolean>;

export interface UserSettings {
  userId: string;
  notificationPrefs: NotificationPrefs;
  appPrefs: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AccountProfile {
  userId: string;
  email: string;
  fullName: string;
  avatarInitials: string;
}

// ==========================================
// Client Dashboard Types
// ==========================================

export type ClientPanelType = "chat" | "tasks" | "checkins" | "notes" | "info" | null;

export interface Task {
  id: string;
  clientId: string;
  title: string;
  completed: boolean;
  completedAt?: string | null;
  dueDate: string | null;
  owner: "coach" | "client";
  isWeeklyFocus: boolean;
  createdAt: string;
}

export interface CoachNote {
  id: string;
  clientId: string;
  content: string;
  createdAt: string;
}

export interface ClientExtendedInfo {
  clientId: string;
  height_cm: number | null;
  weight_kg: number | null;
  age: number | null;
  gender: "male" | "female" | "other" | null;
  phone: string | null;
  activity_level: string | null;
  training_days_per_week: number | null;
  bmr: number | null;
  tdee: number | null;
  pal: number | null;
  recommended_kcal: number | null;
  goal_type: string | null;
  onboarding_submission_id: number | null;
  onboarding_qa: { question: string; answer: string }[];
  nutrition_qa: { question: string; answer: string }[];
}

export interface RoadmapPhaseBlock {
  id: string;
  name: string;
  color: string;
  description: string;
}

export interface RoadmapWeekNote {
  week: number;
  text: string;
}

export interface RoadmapEvent {
  id: string;
  name: string;
  color: string;
  startWeek: number;
  lengthWeeks: number;
  notes: string;
}

export interface RoadmapStat {
  id: string;
  label: string;
  unit: string;
  isDefault: boolean;
}

export interface RoadmapStatEntry {
  statId: string;
  week: number;
  value: string;
}

export interface ClientRoadmap {
  clientId: string;
  year: number;
  phases: RoadmapPhaseBlock[];
  phaseAssignments: Record<number, string>;
  weekNotes: RoadmapWeekNote[];
  events: RoadmapEvent[];
  stats: RoadmapStat[];
  statEntries: RoadmapStatEntry[];
}

// ==========================================
// Client Sub-Page Navigation
// ==========================================

export type ClientSubTab = "overview" | "workouts" | "nutrition" | "progress" | "roadmap";

// ==========================================
// Client Program Assignment Types
// ==========================================

export type ClientProgramStatus = "active" | "inactive";

export type ClientWorkoutView = "list" | "phases" | "builder";
export type PlannerInsightView = "sessions" | "split_matrix" | "load_heatmap";
export type PlannerSplitMatrixMode = "movement" | "muscle";

export interface SetData {
  id: number;
  set_number: number;
  weight: number;
  min_reps: number;
  max_reps: number;
  rest_seconds: number;
  done: boolean;
  [key: string]: number | string | boolean;
}

export interface WorkoutExerciseWithSets extends WorkoutExercise {
  expanded: boolean;
  section_index: number;
  set_data: SetData[];
  tracking_type: SetType;
  alternate_exercise_ids: number[];
  whiteboard_video_urls?: string[];
}

export interface WorkoutSectionTemplateExercise {
  id: number;
  template_id: number;
  sort_order: number;
  exercise_id: number | null;
  name: string;
  muscle_group: string | null;
  tracking_type: SetType;
  sets: number;
  weight: number;
  min_reps: number;
  max_reps: number;
  rest_seconds: number;
  pct_1rm: number;
  rpe: number;
  calories: number;
  duration: string;
  distance: string;
  notes: string | null;
  set_data: SetData[];
  whiteboard_video_urls: string[];
}

export interface WorkoutSectionTemplate {
  id: number;
  coach_id: string;
  name: string;
  category: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  exercises: WorkoutSectionTemplateExercise[];
}

export interface PhaseWorkoutWithSections extends PhaseWorkout {
  workout_sections: WorkoutSection[];
  exercises: WorkoutExerciseWithSets[];
}

export interface ProgramPhaseWithWorkouts extends ProgramPhase {
  workouts: PhaseWorkoutWithSections[];
}

export interface ProgramWithPhases extends Program {
  phases: ProgramPhaseWithWorkouts[];
}

export interface ClientProgram {
  id: string;
  clientId: string;
  programId: number;
  status: "active" | "inactive";
  assignedAt: string;
  /** ISO date string (YYYY-MM-DD) — when the program starts; drives phase date computation */
  startDate: string;
  programData: ProgramWithPhases;
  /** Real Supabase assignment ID — used for DB operations while `id` stays stable for UI references */
  assignmentDbId?: string;
}

// ==========================================
// Nutrition Types
// ==========================================

export interface MealItem {
  id: string;
  name: string;
  amount: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Meal {
  id: string;
  name: string;
  time: string;
  items: MealItem[];
}

export interface MealPlan {
  id: string;
  clientId: string;
  name: string;
  status: "active" | "draft";
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  meals: Meal[];
  createdAt: string;
}

// ==========================================
// Progress Types
// ==========================================

export interface MetricConfig {
  id: string;
  clientId: string;
  name: string;
  unit: string;
  color: string;
  source: "healthkit" | "manual";
  healthkitKey: string | null;
  isActive: boolean;
  category: string | null;
  dailyTarget: number | null;
}

export interface MetricEntry {
  id: string;
  metricId: string;
  value: number;
  date: string;
  source: "healthkit" | "manual";
}

// Available Apple Health metrics that coaches can toggle per client
export interface AvailableHealthMetric {
  key: string;
  name: string;
  unit: string;
  category: "body" | "activity" | "heart" | "sleep" | "nutrition";
  defaultTarget?: number;
}

export const AVAILABLE_HEALTH_METRICS: AvailableHealthMetric[] = [
  // Body Measurements
  { key: "bodyMass", name: "Body Mass", unit: "kg", category: "body" },
  { key: "bodyFatPercentage", name: "Body Fat", unit: "%", category: "body" },
  { key: "bodyMassIndex", name: "BMI", unit: "", category: "body" },
  // Activity
  { key: "stepCount", name: "Steps", unit: "steps", category: "activity", defaultTarget: 7000 },
  { key: "distanceWalkingRunning", name: "Distance", unit: "km", category: "activity" },
  { key: "activeEnergyBurned", name: "Active Energy", unit: "kcal", category: "activity" },
  { key: "basalEnergyBurned", name: "Basal Energy", unit: "kcal", category: "activity" },
  { key: "appleExerciseTime", name: "Exercise Time", unit: "min", category: "activity" },
  // Heart & Vitals
  { key: "heartRate", name: "Heart Rate", unit: "bpm", category: "heart" },
  { key: "restingHeartRate", name: "Resting HR", unit: "bpm", category: "heart" },
  { key: "heartRateVariabilitySDNN", name: "HRV", unit: "ms", category: "heart" },
  { key: "bloodPressureSystolic", name: "BP Systolic", unit: "mmHg", category: "heart" },
  { key: "bloodPressureDiastolic", name: "BP Diastolic", unit: "mmHg", category: "heart" },
  { key: "respiratoryRate", name: "Respiratory Rate", unit: "brpm", category: "heart" },
  { key: "oxygenSaturation", name: "SpO2", unit: "%", category: "heart" },
  { key: "vo2Max", name: "VO2 Max", unit: "mL/kg/min", category: "heart" },
  // Sleep
  { key: "sleepDuration", name: "Sleep Duration", unit: "hrs", category: "sleep", defaultTarget: 7.5 },
  { key: "sleepDeep", name: "Deep Sleep", unit: "hrs", category: "sleep" },
  { key: "sleepCore", name: "Core Sleep", unit: "hrs", category: "sleep" },
  { key: "sleepREM", name: "REM Sleep", unit: "hrs", category: "sleep" },
  // Nutrition
  { key: "dietaryEnergyConsumed", name: "Calories In", unit: "kcal", category: "nutrition" },
  { key: "dietaryProtein", name: "Protein", unit: "g", category: "nutrition" },
  { key: "dietaryCarbohydrates", name: "Carbs", unit: "g", category: "nutrition" },
  { key: "dietaryFatTotal", name: "Fat", unit: "g", category: "nutrition" },
];

export const HEALTH_METRIC_CATEGORIES: { key: string; label: string }[] = [
  { key: "body", label: "Body Measurements" },
  { key: "activity", label: "Activity" },
  { key: "heart", label: "Heart & Vitals" },
  { key: "sleep", label: "Sleep" },
  { key: "nutrition", label: "Nutrition" },
];

export interface SessionLog {
  id: string;
  clientId: string;
  templateName: string;
  sectionName: string;
  rating: number;
  note: string;
  completedAt: string;
}

export interface ExercisePerformanceEntry {
  id: string;
  clientId: string;
  exerciseName: string;
  date: string;
  weight: number;
  reps: number;
  estimatedOneRM: number;
  totalVolume: number;
}

// ==========================================
// Ingredient Database Types
// ==========================================

export type NutrientGroup = "general" | "macro" | "lipid" | "mineral" | "vitamin";

export interface NutrientGroupMeta {
  key: NutrientGroup;
  label: string;
  color: string;
}

export const NUTRIENT_GROUPS: NutrientGroupMeta[] = [
  { key: "general", label: "General", color: "#6b7280" },
  { key: "macro", label: "Macronutrients", color: "#B8860B" },
  { key: "lipid", label: "Lipids", color: "#d97706" },
  { key: "mineral", label: "Minerals", color: "#059669" },
  { key: "vitamin", label: "Vitamins", color: "#7c3aed" },
];

// ==========================================
// Recipe Types
// ==========================================

export interface RecipeIngredient {
  id: string;
  fdcId: number;
  name: string;
  portionIndex: number;
  portionLabel: string;
  quantity: number;
  gramWeight: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type RecipeCategory =
  | "Breakfast"
  | "Lunch"
  | "Dinner"
  | "Snack"
  | "Pre-Workout"
  | "Post-Workout"
  | "Dessert"
  | "Beverage"
  | "Other";

export const RECIPE_CATEGORIES: RecipeCategory[] = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snack",
  "Pre-Workout",
  "Post-Workout",
  "Dessert",
  "Beverage",
  "Other",
];

export interface Recipe {
  id: string;
  name: string;
  category: RecipeCategory;
  description: string;
  imageUrl: string | null;
  ingredients: RecipeIngredient[];
  servings: number;
  prepTimeMinutes: number | null;
  instructions: string | null;
  tags: string[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  perServingCalories: number;
  perServingProtein: number;
  perServingCarbs: number;
  perServingFat: number;
  createdAt: string;
}

// ==========================================
// Meal Plan Builder Types
// ==========================================

export const MACRO_SPLIT_PRESETS = {
  "Default 30/40/30": { protein: 30, carbs: 40, fat: 30 },
  "High Protein (P40/C40/F20)": { protein: 40, carbs: 40, fat: 20 },
  "Low Carb (P50/C25/F25)": { protein: 50, carbs: 25, fat: 25 },
  "Muscle Gain (P30/C50/F20)": { protein: 30, carbs: 50, fat: 20 },
  "Balanced (P40/C30/F30)": { protein: 40, carbs: 30, fat: 30 },
} as const;

export type MacroSplitPreset = keyof typeof MACRO_SPLIT_PRESETS;

export interface MacroSplit {
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealSlotConfig {
  id: string;
  name: string;
  caloriePercentage: number;
  sortOrder: number;
  enabled: boolean;
}

export interface DayType {
  id: string;
  name: string;
  targetCalories: number;
  macroSplit: MacroSplit;
  macroSplitPreset: MacroSplitPreset | "Custom";
  targetProteinGrams: number;
  targetCarbsGrams: number;
  targetFatGrams: number;
  mealSlots: MealSlotConfig[];
}

export interface MealOption {
  id: string;
  optionNumber: number;
  type: "recipe" | "ingredients";
  recipeId: string | null;
  recipeServings: number;
  /** Recipe/option display name (persisted to DB for Supabase-hydrated plans) */
  name?: string | null;
  /** Image URL (persisted to DB) */
  imageUrl?: string | null;
  /** Preparation instructions (persisted to DB) */
  instructions?: string | null;
  ingredients: RecipeIngredient[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export interface PlanMeal {
  id: string;
  dayTypeId: string;
  mealSlotId: string;
  options: MealOption[];
}

export interface MealPlanTemplate {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  status: "draft" | "active" | "template";
  clientId: string | null;
  maxOptionsPerMeal: number;
  dayTypes: DayType[];
  planMeals: PlanMeal[];
  createdAt: string;
  updatedAt: string;
}

export const SUPPLEMENT_TEMPLATE_FREQUENCIES = [
  "daily",
  "bi_daily",
  "every_other_day",
  "as_prescribed",
] as const;

export type SupplementTemplateFrequency = (typeof SUPPLEMENT_TEMPLATE_FREQUENCIES)[number];

export const SUPPLEMENT_PRESCRIPTION_FREQUENCIES = [
  "daily",
  "bi_daily",
  "every_other_day",
  "as_prescribed",
  "pre_workout",
  "any",
] as const;

export type SupplementPrescriptionFrequency = (typeof SUPPLEMENT_PRESCRIPTION_FREQUENCIES)[number];

export interface SupplementTemplate {
  id: string;
  coachId: string;
  name: string;
  dosageFrequency: SupplementTemplateFrequency;
  timing: string;
  purchaseUrl: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientSupplementPrescription {
  id: string;
  clientId: string;
  supplementTemplateId: string;
  supplementName: string;
  dosage: string;
  dosageFrequency: SupplementPrescriptionFrequency;
  timing: string;
  purchaseUrl: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplementAdherenceLog {
  id: string;
  clientId: string;
  clientSupplementPrescriptionId: string;
  date: string;
  taken: boolean;
  takenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NutritionDailyNote {
  id: string;
  clientId: string;
  date: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface NutritionDayStatus {
  id: string;
  clientId: string;
  date: string;
  status: "complete" | "incomplete";
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// Food Log Entry Types
// ==========================================

export interface FoodLogEntry {
  id: string;
  clientId: string;
  date: string;
  mealSlotName: string;
  foodName: string;
  fdcId: number | null;
  servingSize: string | null;
  servingMultiplier: number;
  gramWeight: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  micronutrients: Record<string, number>;
  source: string;
  loggedAt: string;
}

export type FoodLogViewMode = "day" | "week" | "month";

export type ComplianceLevel = "green" | "orange" | "red";

// ==========================================
// Workout Log Types
// ==========================================

export interface SetLogEntry {
  setNumber: number;
  weight: number;
  reps: number;
  rpe: number | null;
  completed: boolean;
}

export interface ExerciseLogEntry {
  id: string;
  exerciseName: string;
  summary: string;
  sortOrder: number;
  notes: string | null;
  setLogs: SetLogEntry[];
}

export interface WorkoutLogEntry {
  id: string;
  clientId: string;
  workoutName: string;
  date: string;
  durationMinutes: number | null;
  totalVolume: number | null;
  srpe: number | null;
  notes: string | null;
  completed: boolean;
  rating: number | null;
  ratingEnergy: number | null;
  ratingPump: number | null;
  exerciseLogs: ExerciseLogEntry[];
}

// ==========================================
// Vault Types
// ==========================================

export type VaultSection = "resources" | "courses";
export type VaultItemType = "pdf" | "video" | "image" | "link";

export interface VaultFolder {
  id: string;
  coachId: string;
  parentId: string | null;
  section: VaultSection;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  sortOrder: number;
  dripEnabled: boolean;
  dripIntervalDays: number | null;
  createdAt: string;
  isLocked?: boolean;
  unlockAt?: string | null;
  unlockWeek?: number | null;
  // Derived (not stored in DB)
  itemCount?: number;
  subfolderCount?: number;
}

export interface VaultItem {
  id: string;
  folderId: string;
  coachId: string;
  title: string;
  description: string | null;
  itemType: VaultItemType;
  fileUrl: string | null;
  externalUrl: string | null;
  thumbnailUrl: string | null;
  fileSize: number | null;
  sortOrder: number;
  createdAt: string;
  isLocked?: boolean;
  unlockAt?: string | null;
  unlockWeek?: number | null;
  // Client-side only: original storage path before signed URL resolution
  storagePath?: string | null;
}

export type CurriculumStatus = "draft" | "active" | "paused" | "completed" | "cancelled";
export type CourseAutomationProgramMode = "off" | "evergreen" | "cohort_date";

export type CurriculumTouchpointKind =
  | "unlock_content"
  | "kickoff_message"
  | "nudge_message"
  | "recap_message"
  | "assign_quiz"
  | "assign_action_tasks"
  | "assign_reflection";

export interface CurriculumProgram {
  id: number;
  coachId: string;
  courseFolderId: number;
  name: string;
  durationWeeks: number;
  isActive: boolean;
  programMode: CourseAutomationProgramMode;
  cohortStartDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CurriculumWeek {
  id: number;
  programId: number;
  weekNumber: number;
  themeTitle: string;
  focusOutcome: string | null;
  lectureFolderId: number | null;
  summaryPrompt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CurriculumTouchpoint {
  id: number;
  weekId: number;
  kind: CurriculumTouchpointKind;
  dayOffset: number;
  localTime: string;
  payloadJson: Record<string, unknown>;
  isRequired: boolean;
  isEnabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CurriculumEnrollment {
  id: number;
  clientId: string;
  coachId: string;
  programId: number;
  startDate: string;
  timezone: string;
  status: CurriculumStatus;
  pausedFrom: string | null;
  resumeOn: string | null;
  currentWeekCache: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientCurriculumDashboard {
  enrollmentId: number;
  programId: number;
  programName: string;
  weekNumber: number;
  weekThemeTitle: string;
  focusOutcome: string | null;
  lectureFolderId: number | null;
  weekStartDate: string;
  completionPct: number;
  quizScore: number | null;
  actionCompletionPct: number | null;
  resourceCompletionPct: number | null;
  reflectionDone: boolean;
  competencyScore: number | null;
  outcomeStatus: string;
  nextDueAtUtc: string | null;
  atRisk: boolean;
}

export interface CoachCurriculumOverviewItem {
  enrollmentId: number;
  clientId: string;
  clientName: string;
  programId: number;
  programName: string;
  enrollmentStatus: CurriculumStatus;
  currentWeek: number;
  competencyScore: number | null;
  outcomeStatus: string;
  nextDueAtUtc: string | null;
  lastDeliveryAtUtc: string | null;
  atRisk: boolean;
}

export interface CourseWeekPlanRow {
  id: number;
  programId: number;
  weekNumber: number;
  themeTitle: string;
  focusOutcome: string | null;
  lectureFolderId: number | null;
  summaryPrompt: string | null;
  touchpoints: CurriculumTouchpoint[];
}

export interface CourseAutomationEnrollmentRow extends CoachCurriculumOverviewItem {}

export interface CourseAutomationSummary {
  program: CurriculumProgram | null;
  weeks: CourseWeekPlanRow[];
  enrollments: CourseAutomationEnrollmentRow[];
}

export type InsightCadenceUnit = "days" | "weeks";

export interface CoachInsight {
  id: string;
  coachId: string;
  title: string;
  body: string;
  tags: string[];
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CoachInsightSettings {
  coachId: string;
  cadenceUnit: InsightCadenceUnit;
  cadenceValue: number;
  updatedAt: string;
}

// ==========================================
// Activity Session Types
// ==========================================

export interface ActivitySession {
  id: string;
  clientId: string;
  activityType: string;
  activityTypeRaw: number;
  startDate: string;
  endDate: string;
  durationSeconds: number;
  caloriesBurned: number | null;
  distanceMeters: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  minHeartRate: number | null;
  hrSamples: { t: number; bpm: number }[] | null;
  hrZoneSeconds: Record<string, number> | null;
  effortRating: number | null;
  srpe: number | null;
  sourceName: string | null;
  createdAt: string;
}
