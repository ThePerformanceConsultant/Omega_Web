"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  UtensilsCrossed,
  Copy,
  Trash2,
  Pencil,
  MoreVertical,
  Utensils,
  UserPlus,
  Pill,
  ExternalLink,
  Clock3,
} from "lucide-react";
import {
  useMealPlans,
  mealPlanStore,
  createEmptyTemplate,
} from "@/lib/meal-plan-store";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { recipeStore } from "@/lib/recipe-store";
import { SUPPLEMENT_TEMPLATE_FREQUENCIES } from "@/lib/types";
import type {
  MealPlanTemplate,
  SupplementTemplate,
  SupplementTemplateFrequency,
} from "@/lib/types";
import {
  fetchSupplementTemplates,
  saveSupplementTemplate,
  deleteSupplementTemplate,
} from "@/lib/supabase/db";
import { MealPlanDrawer } from "@/components/nutrition/meal-plan-drawer";
import { AssignClientModal } from "@/components/nutrition/assign-client-modal";

type MainNutritionTab = "meal-plans" | "supplements";
type SupplementDraft = {
  name: string;
  dosageFrequency: SupplementTemplateFrequency;
  timing: string;
  purchaseUrl: string;
  notes: string;
  isActive: boolean;
};

const EMPTY_SUPPLEMENT_DRAFT: SupplementDraft = {
  name: "",
  dosageFrequency: "daily",
  timing: "",
  purchaseUrl: "",
  notes: "",
  isActive: true,
};

const SUPPLEMENT_FREQUENCY_LABELS: Record<SupplementTemplateFrequency, string> = {
  daily: "Daily",
  bi_daily: "Bi-daily",
  every_other_day: "Every other day",
  as_prescribed: "As prescribed",
};

function getSupplementErrorMessage(error: unknown, action: "load" | "save" | "delete"): string {
  const fallback = action === "load"
    ? "Unable to load supplements right now."
    : action === "save"
      ? "Unable to save supplement right now."
      : "Unable to delete supplement right now.";

  const code = typeof error === "object" && error && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  const message = typeof error === "object" && error && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : "";

  if (message.includes("No authenticated coach session")) {
    return "Session expired. Refresh the page and sign in again.";
  }

  if (
    code === "PGRST205" ||
    code === "42P01" ||
    /supplement_templates|client_supplement_prescriptions|supplement_adherence_logs|nutrition_daily_notes/i.test(message)
  ) {
    return "Supplements backend tables are not available yet. Run Supabase migration 00036 and refresh.";
  }

  if (code === "42501") {
    return "Permission denied by Supabase policy. Verify supplement table RLS policies for your coach account.";
  }

  return `${fallback} Please try again.`;
}

function toSupplementDraft(template: SupplementTemplate | null): SupplementDraft {
  if (!template) return EMPTY_SUPPLEMENT_DRAFT;
  return {
    name: template.name,
    dosageFrequency: template.dosageFrequency,
    timing: template.timing,
    purchaseUrl: template.purchaseUrl,
    notes: template.notes,
    isActive: template.isActive,
  };
}

function sortSupplements(rows: SupplementTemplate[]): SupplementTemplate[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name));
}

export default function NutritionPage() {
  const router = useRouter();
  const plans = useMealPlans();
  const [mainTab, setMainTab] = useState<MainNutritionTab>("meal-plans");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MealPlanTemplate | null>(null);
  const [assigningPlan, setAssigningPlan] = useState<MealPlanTemplate | null>(null);

  const [coachId, setCoachId] = useState<string | null>(null);
  const [supplements, setSupplements] = useState<SupplementTemplate[]>([]);
  const [loadingSupplements, setLoadingSupplements] = useState(true);
  const [supplementError, setSupplementError] = useState<string | null>(null);
  const [showSupplementEditor, setShowSupplementEditor] = useState(false);
  const [editingSupplement, setEditingSupplement] = useState<SupplementTemplate | null>(null);

  useEffect(() => {
    mealPlanStore.hydrate();
    recipeStore.hydrate();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function hydrateSupplements() {
      try {
        const supabase = createSupabaseClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const resolvedCoachId = user?.id ?? null;
        if (!resolvedCoachId || cancelled) {
          if (!cancelled) setLoadingSupplements(false);
          return;
        }
        setCoachId(resolvedCoachId);
        const rows = await fetchSupplementTemplates(resolvedCoachId);
        if (cancelled) return;
        setSupplements(sortSupplements(rows));
        setSupplementError(null);
      } catch (error) {
        console.error("[NutritionPage] supplement hydrate failed:", error);
        if (!cancelled) {
          setSupplementError(getSupplementErrorMessage(error, "load"));
        }
      } finally {
        if (!cancelled) setLoadingSupplements(false);
      }
    }
    hydrateSupplements();
    return () => { cancelled = true; };
  }, []);

  function openNewMealPlan() {
    const template = createEmptyTemplate();
    setEditingPlan(template);
    setDrawerOpen(true);
  }

  function openEditMealPlan(plan: MealPlanTemplate) {
    setEditingPlan({ ...plan });
    setDrawerOpen(true);
  }

  function handleSaveMealPlan(template: MealPlanTemplate) {
    mealPlanStore.save(template);
    setDrawerOpen(false);
    setEditingPlan(null);
  }

  function handleDuplicateMealPlan(plan: MealPlanTemplate) {
    mealPlanStore.saveAsTemplate(plan.id);
  }

  function handleDeleteMealPlan(id: string) {
    mealPlanStore.remove(id);
  }

  async function handleSaveSupplement(draft: SupplementDraft) {
    if (!coachId) return;
    try {
      const saved = await saveSupplementTemplate(
        {
          id: editingSupplement?.id,
          name: draft.name,
          dosageFrequency: draft.dosageFrequency,
          timing: draft.timing,
          purchaseUrl: draft.purchaseUrl,
          notes: draft.notes,
          isActive: draft.isActive,
        },
        coachId
      );
      setSupplements((prev) => {
        const existing = prev.some((s) => s.id === saved.id);
        const next = existing
          ? prev.map((s) => (s.id === saved.id ? saved : s))
          : [...prev, saved];
        return sortSupplements(next);
      });
      setSupplementError(null);
      setEditingSupplement(null);
      setShowSupplementEditor(false);
    } catch (error) {
      console.error("[NutritionPage] save supplement failed:", error);
      const message = getSupplementErrorMessage(error, "save");
      setSupplementError(message);
      alert(message);
    }
  }

  async function handleDeleteSupplement(id: string) {
    try {
      await deleteSupplementTemplate(id);
      setSupplements((prev) => prev.filter((s) => s.id !== id));
      setSupplementError(null);
    } catch (error) {
      console.error("[NutritionPage] delete supplement failed:", error);
      const message = getSupplementErrorMessage(error, "delete");
      setSupplementError(message);
      alert(message);
    }
  }

  const coachPlans = plans.filter((p) => !p.clientId);
  const templates = coachPlans.filter((p) => p.status === "template");
  const drafts = coachPlans.filter((p) => p.status !== "template");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 border-b border-black/10 pb-2">
        <button
          onClick={() => setMainTab("meal-plans")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            mainTab === "meal-plans"
              ? "bg-accent/15 text-accent"
              : "text-muted hover:text-foreground hover:bg-black/5"
          }`}
        >
          Meal Plans
        </button>
        <button
          onClick={() => setMainTab("supplements")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            mainTab === "supplements"
              ? "bg-accent/15 text-accent"
              : "text-muted hover:text-foreground hover:bg-black/5"
          }`}
        >
          Supplements
        </button>
      </div>

      {mainTab === "meal-plans" && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">
                {coachPlans.length} meal plan{coachPlans.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={openNewMealPlan}
              className="px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium shadow-[0_4px_16px_rgba(184,134,11,0.3)] hover:shadow-[0_4px_24px_rgba(184,134,11,0.4)] transition-shadow flex items-center gap-2"
            >
              <Plus size={16} /> New Meal Plan
            </button>
          </div>

          {templates.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
                Templates
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {templates.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    onEdit={() => openEditMealPlan(plan)}
                    onBuild={() => router.push(`/nutrition/${plan.id}`)}
                    onDuplicate={() => handleDuplicateMealPlan(plan)}
                    onDelete={() => handleDeleteMealPlan(plan.id)}
                    onAssign={() => setAssigningPlan(plan)}
                  />
                ))}
              </div>
            </div>
          )}

          {drafts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
                Drafts
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {drafts.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    onEdit={() => openEditMealPlan(plan)}
                    onBuild={() => router.push(`/nutrition/${plan.id}`)}
                    onDuplicate={() => handleDuplicateMealPlan(plan)}
                    onDelete={() => handleDeleteMealPlan(plan.id)}
                    onAssign={() => setAssigningPlan(plan)}
                  />
                ))}
              </div>
            </div>
          )}

          {plans.length === 0 && (
            <div className="glass-card p-12 text-center">
              <UtensilsCrossed size={40} className="mx-auto mb-4 text-muted/30" />
              <p className="text-sm font-medium text-muted">No meal plans yet</p>
              <p className="text-xs text-muted/60 mt-1">
                Create a meal plan template to get started
              </p>
              <button
                onClick={openNewMealPlan}
                className="mt-4 px-4 py-2 rounded-lg bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-colors"
              >
                Create your first meal plan
              </button>
            </div>
          )}

          {editingPlan && (
            <MealPlanDrawer
              key={editingPlan.id}
              open={drawerOpen}
              onClose={() => {
                setDrawerOpen(false);
                setEditingPlan(null);
              }}
              template={editingPlan}
              onSave={handleSaveMealPlan}
            />
          )}

          {assigningPlan && (
            <AssignClientModal
              plan={assigningPlan}
              onClose={() => setAssigningPlan(null)}
            />
          )}
        </>
      )}

      {mainTab === "supplements" && (
        <>
          {supplementError && (
            <div className="rounded-xl border border-red-300/70 bg-red-50 px-4 py-3 text-xs text-red-700">
              {supplementError}
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">
              {supplements.length} supplement{supplements.length !== 1 ? "s" : ""}
            </p>
            <button
              onClick={() => {
                setEditingSupplement(null);
                setShowSupplementEditor(true);
              }}
              className="px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium shadow-[0_4px_16px_rgba(184,134,11,0.3)] hover:shadow-[0_4px_24px_rgba(184,134,11,0.4)] transition-shadow flex items-center gap-2"
            >
              <Plus size={16} /> New Supplement
            </button>
          </div>

          {loadingSupplements && (
            <div className="glass-card p-10 text-center">
              <p className="text-xs text-muted animate-pulse">Loading supplements...</p>
            </div>
          )}

          {!loadingSupplements && supplements.length === 0 && (
            <div className="glass-card p-12 text-center">
              <Pill size={40} className="mx-auto mb-4 text-muted/30" />
              <p className="text-sm font-medium text-muted">No supplements yet</p>
              <p className="text-xs text-muted/60 mt-1">
                Create a supplement template to assign it to clients.
              </p>
            </div>
          )}

          {!loadingSupplements && supplements.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {supplements.map((supplement) => (
                <SupplementCard
                  key={supplement.id}
                  supplement={supplement}
                  frequencyLabel={SUPPLEMENT_FREQUENCY_LABELS[supplement.dosageFrequency]}
                  onEdit={() => {
                    setEditingSupplement(supplement);
                    setShowSupplementEditor(true);
                  }}
                  onDelete={() => handleDeleteSupplement(supplement.id)}
                />
              ))}
            </div>
          )}

          {showSupplementEditor && (
            <SupplementEditorModal
              title={editingSupplement ? "Edit Supplement" : "New Supplement"}
              initial={toSupplementDraft(editingSupplement)}
              onClose={() => {
                setShowSupplementEditor(false);
                setEditingSupplement(null);
              }}
              onSave={handleSaveSupplement}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Plan Card ─────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  onEdit,
  onBuild,
  onDuplicate,
  onDelete,
  onAssign,
}: {
  plan: MealPlanTemplate;
  onEdit: () => void;
  onBuild: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAssign: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  const dayTypesSummary = plan.dayTypes
    .map((dt) => `${dt.name} (${dt.targetCalories} kcal)`)
    .join(" · ");

  const statusColor = {
    draft: "bg-yellow-500/15 text-yellow-700",
    active: "bg-green-500/15 text-green-700",
    template: "bg-accent/15 text-accent",
  }[plan.status];

  return (
    <div
      className="glass-card p-4 hover:shadow-md transition-shadow cursor-pointer group relative"
      onClick={onBuild}
    >
      {/* Menu */}
      <div className="absolute top-3 right-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-1 rounded text-muted hover:text-foreground hover:bg-black/5 transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreVertical size={14} />
        </button>
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
              }}
            />
            <div className="absolute right-0 mt-1 w-36 rounded-lg bg-white border border-black/10 shadow-lg z-20 py-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onBuild();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-accent font-medium hover:bg-accent/5"
              >
                <Utensils size={12} /> Build Meals
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-black/5"
              >
                <Pencil size={12} /> Edit Structure
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-black/5"
              >
                <Copy size={12} /> Duplicate
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAssign();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-black/5"
              >
                <UserPlus size={12} /> Assign to Client
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-foreground truncate">
              {plan.name || "Untitled Plan"}
            </h4>
            {plan.description && (
              <p className="text-[10px] text-muted mt-0.5 line-clamp-2">
                {plan.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColor}`}
          >
            {plan.status}
          </span>
          <span className="text-[10px] text-muted">
            {plan.dayTypes.length} day type{plan.dayTypes.length !== 1 ? "s" : ""}
          </span>
          <span className="text-[10px] text-muted">
            up to {plan.maxOptionsPerMeal} option{plan.maxOptionsPerMeal !== 1 ? "s" : ""}/meal
          </span>
        </div>

        <p className="text-[10px] text-muted/70 truncate">{dayTypesSummary}</p>

        {/* Macro targets */}
        {plan.dayTypes[0] && (
          <div className="flex items-center gap-2 text-[10px] font-medium">
            <span className="text-foreground">
              {plan.dayTypes[0].targetCalories} kcal
            </span>
            <span className="text-muted">·</span>
            <span className="text-muted">
              P{plan.dayTypes[0].targetProteinGrams}g
            </span>
            <span className="text-muted">·</span>
            <span className="text-muted">
              C{plan.dayTypes[0].targetCarbsGrams}g
            </span>
            <span className="text-muted">·</span>
            <span className="text-muted">
              F{plan.dayTypes[0].targetFatGrams}g
            </span>
          </div>
        )}

        {/* Mini distribution preview */}
        {plan.dayTypes[0] && (
          <div className="flex h-1.5 rounded-full overflow-hidden bg-black/5">
            {plan.dayTypes[0].mealSlots
              .filter((s) => s.enabled)
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((slot, idx) => (
                <div
                  key={slot.id}
                  className="transition-all"
                  style={{
                    width: `${slot.caloriePercentage}%`,
                    backgroundColor: [
                      "#f59e0b",
                      "#3b82f6",
                      "#ef4444",
                      "#10b981",
                      "#8b5cf6",
                      "#ec4899",
                      "#f97316",
                      "#06b6d4",
                    ][idx % 8],
                  }}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SupplementCard({
  supplement,
  frequencyLabel,
  onEdit,
  onDelete,
}: {
  supplement: SupplementTemplate;
  frequencyLabel: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-foreground truncate">{supplement.name}</h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/15 text-accent">
              {frequencyLabel}
            </span>
            {!supplement.isActive && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/10 text-muted">
                inactive
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="px-2 py-1 rounded text-xs text-foreground hover:bg-black/5 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-2 py-1 rounded text-xs text-red-500 hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {supplement.timing && (
        <div className="flex items-start gap-2 text-[11px] text-muted">
          <Clock3 size={12} className="mt-0.5 shrink-0" />
          <span>{supplement.timing}</span>
        </div>
      )}

      {supplement.purchaseUrl && (
        <a
          href={supplement.purchaseUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] text-accent hover:underline"
        >
          <ExternalLink size={12} />
          Purchase link
        </a>
      )}

      {supplement.notes && (
        <p className="text-xs text-muted bg-black/[0.03] rounded-md p-2">{supplement.notes}</p>
      )}
    </div>
  );
}

function SupplementEditorModal({
  title,
  initial,
  onClose,
  onSave,
}: {
  title: string;
  initial: SupplementDraft;
  onClose: () => void;
  onSave: (draft: SupplementDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<SupplementDraft>(initial);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...draft,
        name: draft.name.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Close
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-[11px] font-medium text-muted">Name</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
              placeholder="Creatine Monohydrate"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-medium text-muted">Dosage Frequency</span>
            <select
              value={draft.dosageFrequency}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  dosageFrequency: e.target.value as SupplementTemplateFrequency,
                }))
              }
              className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
            >
              {SUPPLEMENT_TEMPLATE_FREQUENCIES.map((frequency) => (
                <option key={frequency} value={frequency}>
                  {SUPPLEMENT_FREQUENCY_LABELS[frequency]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-medium text-muted">Timing</span>
            <input
              value={draft.timing}
              onChange={(e) => setDraft((prev) => ({ ...prev, timing: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
              placeholder="Morning with breakfast"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-medium text-muted">Purchase Link</span>
            <input
              value={draft.purchaseUrl}
              onChange={(e) => setDraft((prev) => ({ ...prev, purchaseUrl: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
              placeholder="https://..."
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-medium text-muted">Notes</span>
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm min-h-[96px]"
              placeholder="Any important instructions..."
            />
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => setDraft((prev) => ({ ...prev, isActive: e.target.checked }))}
            />
            Active
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg border border-black/10 text-sm text-foreground hover:bg-black/5"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!draft.name.trim() || saving}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Supplement"}
          </button>
        </div>
      </div>
    </div>
  );
}
