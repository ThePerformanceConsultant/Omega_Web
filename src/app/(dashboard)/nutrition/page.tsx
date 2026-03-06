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
} from "lucide-react";
import {
  useMealPlans,
  mealPlanStore,
  createEmptyTemplate,
} from "@/lib/meal-plan-store";
import { recipeStore } from "@/lib/recipe-store";
import type { MealPlanTemplate } from "@/lib/types";
import { MealPlanDrawer } from "@/components/nutrition/meal-plan-drawer";
import { AssignClientModal } from "@/components/nutrition/assign-client-modal";

export default function NutritionPage() {
  const router = useRouter();
  const plans = useMealPlans();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Hydrate stores from Supabase on mount
  useEffect(() => { mealPlanStore.hydrate(); recipeStore.hydrate(); }, []);
  const [editingPlan, setEditingPlan] = useState<MealPlanTemplate | null>(null);
  const [assigningPlan, setAssigningPlan] = useState<MealPlanTemplate | null>(null);

  function openNew() {
    const template = createEmptyTemplate();
    setEditingPlan(template);
    setDrawerOpen(true);
  }

  function openEdit(plan: MealPlanTemplate) {
    setEditingPlan({ ...plan });
    setDrawerOpen(true);
  }

  function handleSave(template: MealPlanTemplate) {
    mealPlanStore.save(template);
    setDrawerOpen(false);
    setEditingPlan(null);
  }

  function handleDuplicate(plan: MealPlanTemplate) {
    mealPlanStore.saveAsTemplate(plan.id);
  }

  function handleDelete(id: string) {
    mealPlanStore.remove(id);
  }

  // Only show coach-owned plans (no clientId) — client plans are accessed from client profiles
  const coachPlans = plans.filter((p) => !p.clientId);
  const templates = coachPlans.filter((p) => p.status === "template");
  const drafts = coachPlans.filter((p) => p.status !== "template");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">
            {coachPlans.length} meal plan{coachPlans.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openNew}
          className="px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium shadow-[0_4px_16px_rgba(184,134,11,0.3)] hover:shadow-[0_4px_24px_rgba(184,134,11,0.4)] transition-shadow flex items-center gap-2"
        >
          <Plus size={16} /> New Meal Plan
        </button>
      </div>

      {/* Templates Section */}
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
                onEdit={() => openEdit(plan)}
                onBuild={() => router.push(`/nutrition/${plan.id}`)}
                onDuplicate={() => handleDuplicate(plan)}
                onDelete={() => handleDelete(plan.id)}
                onAssign={() => setAssigningPlan(plan)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Drafts Section */}
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
                onEdit={() => openEdit(plan)}
                onBuild={() => router.push(`/nutrition/${plan.id}`)}
                onDuplicate={() => handleDuplicate(plan)}
                onDelete={() => handleDelete(plan.id)}
                onAssign={() => setAssigningPlan(plan)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {plans.length === 0 && (
        <div className="glass-card p-12 text-center">
          <UtensilsCrossed
            size={40}
            className="mx-auto mb-4 text-muted/30"
          />
          <p className="text-sm font-medium text-muted">
            No meal plans yet
          </p>
          <p className="text-xs text-muted/60 mt-1">
            Create a meal plan template to get started
          </p>
          <button
            onClick={openNew}
            className="mt-4 px-4 py-2 rounded-lg bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-colors"
          >
            Create your first meal plan
          </button>
        </div>
      )}

      {/* Drawer */}
      {editingPlan && (
        <MealPlanDrawer
          key={editingPlan.id}
          open={drawerOpen}
          onClose={() => {
            setDrawerOpen(false);
            setEditingPlan(null);
          }}
          template={editingPlan}
          onSave={handleSave}
        />
      )}

      {/* Assign to Client modal */}
      {assigningPlan && (
        <AssignClientModal
          plan={assigningPlan}
          onClose={() => setAssigningPlan(null)}
        />
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
