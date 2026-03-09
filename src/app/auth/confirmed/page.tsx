"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const APP_DEEP_LINK = "omegacoach://auth/confirmed";

export default function EmailConfirmedPage() {
  const [attemptedOpen, setAttemptedOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAttemptedOpen(true);
      window.location.href = APP_DEEP_LINK;
    }, 600);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#ffffff] via-[#f8f6f3] to-[#f0ece4] flex items-center justify-center p-4">
      <div className="glass-card p-8 w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-accent mb-3">Email Confirmed</h1>
        <p className="text-sm text-muted mb-6">
          Thanks for signing up. Return to the Omega Coach app to continue.
        </p>

        <a
          href={APP_DEEP_LINK}
          className="block w-full py-3 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white font-medium text-center shadow-[0_4px_16px_rgba(184,134,11,0.3)] hover:shadow-[0_4px_24px_rgba(184,134,11,0.4)] transition-shadow"
        >
          Open Omega Coach
        </a>

        <p className="text-xs text-muted mt-4">
          {attemptedOpen
            ? "If the app did not open, tap the button above."
            : "Opening the app..."}
        </p>

        <Link
          href="/login"
          className="inline-block mt-6 text-sm text-accent hover:text-accent-light transition-colors"
        >
          Stay on web instead
        </Link>
      </div>
    </div>
  );
}
