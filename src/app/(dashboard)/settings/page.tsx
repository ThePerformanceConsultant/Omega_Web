"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, KeyRound, LogOut, Mail, Save, User } from "lucide-react";
import { useRouter } from "next/navigation";
import type { NotificationKind, NotificationPrefs } from "@/lib/types";
import {
  defaultNotificationPrefs,
  fetchMyAccountProfile,
  fetchMyUserSettings,
  requestMyEmailChange,
  sendPasswordReset,
  updateMyAccountProfile,
  upsertMyUserSettings,
} from "@/lib/supabase/db";
import { createClient } from "@/lib/supabase/client";

const notificationFields: Array<{
  kind: NotificationKind;
  label: string;
  description: string;
}> = [
  {
    kind: "message_received",
    label: "Messages",
    description: "When a client sends you a message.",
  },
  {
    kind: "form_submitted",
    label: "Form Submissions",
    description: "When a client submits a form.",
  },
  {
    kind: "checkin_submitted",
    label: "Check-In Submissions",
    description: "When a client submits a check-in.",
  },
  {
    kind: "task_completed",
    label: "Task Completed",
    description: "When a client marks a task complete.",
  },
  {
    kind: "workout_completed",
    label: "Workout Completed",
    description: "When a client completes a workout.",
  },
  {
    kind: "workout_assigned",
    label: "Workout Assigned",
    description: "When a workout assignment is created.",
  },
  {
    kind: "workout_updated",
    label: "Workout Updated",
    description: "When a workout assignment is updated.",
  },
  {
    kind: "form_due",
    label: "Form Due",
    description: "When a form due date is assigned or changed.",
  },
  {
    kind: "task_due",
    label: "Task Due",
    description: "When a task due date is assigned or changed.",
  },
  {
    kind: "meal_plan_published",
    label: "Meal Plan Published",
    description: "When a meal plan is published or assigned.",
  },
  {
    kind: "insight_published",
    label: "Insight Published",
    description: "When a new client insight is published.",
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [isSubmittingEmailChange, setIsSubmittingEmailChange] = useState(false);
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);

  const [fullName, setFullName] = useState("");
  const [avatarInitials, setAvatarInitials] = useState("");
  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [notificationPrefs, setNotificationPrefs] =
    useState<NotificationPrefs>(defaultNotificationPrefs());

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasAnyNotificationEnabled = useMemo(
    () => Object.values(notificationPrefs).some(Boolean),
    [notificationPrefs]
  );

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [profile, settings] = await Promise.all([
          fetchMyAccountProfile(),
          fetchMyUserSettings(),
        ]);

        if (profile) {
          setFullName(profile.fullName ?? "");
          setAvatarInitials(profile.avatarInitials ?? "");
          setCurrentEmail(profile.email ?? "");
        }

        if (settings?.notificationPrefs) {
          setNotificationPrefs(settings.notificationPrefs);
        } else {
          setNotificationPrefs(defaultNotificationPrefs());
        }
      } catch (error) {
        console.error("[SettingsPage] Load failed:", error);
        setErrorMessage("Unable to load settings.");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function handleSaveAccount() {
    setIsSavingAccount(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      await updateMyAccountProfile({ fullName, avatarInitials });
      setSuccessMessage("Account profile saved.");
    } catch (error) {
      console.error("[SettingsPage] Save account failed:", error);
      setErrorMessage("Could not save account profile.");
    } finally {
      setIsSavingAccount(false);
    }
  }

  async function handleSaveNotifications() {
    setIsSavingNotifications(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      await upsertMyUserSettings({ notificationPrefs });
      setSuccessMessage("Notification preferences saved.");
    } catch (error) {
      console.error("[SettingsPage] Save notification prefs failed:", error);
      setErrorMessage("Could not save notification preferences.");
    } finally {
      setIsSavingNotifications(false);
    }
  }

  async function handleEmailChange() {
    setIsSubmittingEmailChange(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      await requestMyEmailChange(newEmail);
      setSuccessMessage("Email change requested. Check both inboxes to confirm.");
      setNewEmail("");
    } catch (error) {
      console.error("[SettingsPage] Email change failed:", error);
      setErrorMessage("Could not request email change.");
    } finally {
      setIsSubmittingEmailChange(false);
    }
  }

  async function handlePasswordReset() {
    setIsSendingPasswordReset(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      await sendPasswordReset(currentEmail, `${window.location.origin}/login`);
      setSuccessMessage("Password reset email sent.");
    } catch (error) {
      console.error("[SettingsPage] Password reset failed:", error);
      setErrorMessage("Could not send password reset email.");
    } finally {
      setIsSendingPasswordReset(false);
    }
  }

  async function handleSignOut() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      {successMessage && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <User size={18} className="text-accent" />
          <h3 className="text-lg font-semibold">Account</h3>
        </div>
        <p className="text-sm text-muted mt-1">
          Manage your profile, sign-in email, and account security actions.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <label className="text-sm text-muted">
            Full name
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 text-foreground focus:outline-none focus:border-accent/40"
              disabled={isLoading}
            />
          </label>
          <label className="text-sm text-muted">
            Avatar initials
            <input
              value={avatarInitials}
              onChange={(event) => setAvatarInitials(event.target.value.toUpperCase().slice(0, 4))}
              className="mt-1.5 w-full rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 text-foreground focus:outline-none focus:border-accent/40"
              disabled={isLoading}
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={handleSaveAccount}
            disabled={isLoading || isSavingAccount || !fullName.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={14} />
            Save account
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-black/10">
          <label className="text-sm text-muted">
            Current email
            <input
              value={currentEmail}
              disabled
              className="mt-1.5 w-full rounded-lg border border-black/10 bg-black/[0.04] px-3 py-2 text-foreground"
            />
          </label>
          <label className="text-sm text-muted">
            New email
            <input
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 text-foreground focus:outline-none focus:border-accent/40"
              placeholder="new-email@example.com"
              disabled={isLoading}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={handleEmailChange}
            disabled={isLoading || isSubmittingEmailChange || !newEmail.trim()}
            className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm text-foreground hover:bg-black/[0.03] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mail size={14} />
            Request email change
          </button>
          <button
            onClick={handlePasswordReset}
            disabled={isLoading || isSendingPasswordReset || !currentEmail}
            className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm text-foreground hover:bg-black/[0.03] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <KeyRound size={14} />
            Send password reset email
          </button>
          <button
            onClick={handleSignOut}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-accent" />
          <h3 className="text-lg font-semibold">Notifications</h3>
        </div>
        <p className="text-sm text-muted mt-1">
          Toggle which in-app notifications appear in your coach inbox.
        </p>

        <div className="mt-5 divide-y divide-black/10 rounded-xl border border-black/10 overflow-hidden">
          {notificationFields.map((field) => (
            <label
              key={field.kind}
              className="flex items-center justify-between gap-4 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{field.label}</p>
                <p className="text-xs text-muted">{field.description}</p>
              </div>
              <input
                type="checkbox"
                checked={notificationPrefs[field.kind]}
                onChange={(event) =>
                  setNotificationPrefs((current) => ({
                    ...current,
                    [field.kind]: event.target.checked,
                  }))
                }
                className="h-4 w-4 accent-accent shrink-0"
              />
            </label>
          ))}
        </div>

        {!hasAnyNotificationEnabled && (
          <p className="mt-3 text-xs text-amber-700">
            All notification categories are disabled.
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <button
            onClick={handleSaveNotifications}
            disabled={isSavingNotifications || isLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={14} />
            Save notifications
          </button>
        </div>
      </section>
    </div>
  );
}
