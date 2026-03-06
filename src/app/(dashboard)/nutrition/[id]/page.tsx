"use client";

import { use, useEffect, useState } from "react";
import { useMealPlan, mealPlanStore } from "@/lib/meal-plan-store";
import { recipeStore } from "@/lib/recipe-store";
import { MealPlanBuilder } from "@/components/nutrition/meal-plan-builder";
import { ArrowLeft, UtensilsCrossed, Loader2 } from "lucide-react";
import Link from "next/link";

export default function MealPlanBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [hydrated, setHydrated] = useState(false);

  // Ensure stores are hydrated (covers direct navigation / page refresh)
  useEffect(() => {
    Promise.all([mealPlanStore.hydrate(), recipeStore.hydrate()])
      .then(() => setHydrated(true));
  }, []);

  const plan = useMealPlan(id);

  // Show loading state while hydrating
  if (!hydrated && !plan) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 size={24} className="animate-spin text-accent" />
        <p className="text-xs text-muted">Loading meal plan…</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <UtensilsCrossed size={40} className="text-muted/30" />
        <p className="text-sm text-muted font-medium">Meal plan not found</p>
        <p className="text-xs text-muted/60">
          This plan may have been deleted or doesn&apos;t exist yet.
        </p>
        <Link
          href="/nutrition"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-accent hover:bg-accent/10 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Nutrition
        </Link>
      </div>
    );
  }

  return <MealPlanBuilder plan={plan} />;
}
