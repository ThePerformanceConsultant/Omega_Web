"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function InvitePage() {
  const params = useParams();
  const code = (params.code as string)?.toUpperCase() ?? "";

  const [coachName, setCoachName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!code) {
      setInvalid(true);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    supabase
      .rpc("get_coach_name_by_invite_code", { code })
      .then(({ data, error }) => {
        if (error || !data) {
          setInvalid(true);
        } else {
          setCoachName(data as string);
        }
        setLoading(false);
      });
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#ffffff] via-[#f8f6f3] to-[#f0ece4] flex items-center justify-center p-4">
        <div className="text-muted text-sm">Validating invite...</div>
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#ffffff] via-[#f8f6f3] to-[#f0ece4] flex items-center justify-center p-4">
        <div className="glass-card p-8 w-full max-w-md text-center">
          <div className="text-4xl mb-4">&#x26A0;&#xFE0F;</div>
          <h1 className="text-xl font-bold text-foreground mb-2">Invalid Invite Link</h1>
          <p className="text-sm text-muted mb-6">
            This invite code is not valid. Please check with your coach for the correct link.
          </p>
          <Link
            href="/login"
            className="text-accent hover:text-accent-light text-sm transition-colors"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#ffffff] via-[#f8f6f3] to-[#f0ece4] flex items-center justify-center p-4">
      <div className="glass-card p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-accent mb-2">Omega Coach</h1>
          <p className="text-sm text-muted">
            You&apos;ve been invited by <span className="font-semibold text-foreground">{coachName}</span>
          </p>
        </div>

        {/* Coach code display */}
        <div className="bg-black/5 border border-black/10 rounded-lg p-4 mb-6 text-center">
          <p className="text-xs text-muted mb-1.5">Your coach code</p>
          <p className="text-2xl font-bold tracking-widest text-foreground font-mono">{code}</p>
          <p className="text-xs text-muted mt-1.5">You&apos;ll need this when signing up in the app</p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {/* App Store / Download button */}
          <a
            href="https://apps.apple.com/app/omega-coach/id000000000"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white font-medium text-center shadow-[0_4px_16px_rgba(184,134,11,0.3)] hover:shadow-[0_4px_24px_rgba(184,134,11,0.4)] transition-shadow"
          >
            Download the App
          </a>

          {/* Web signup fallback */}
          <Link
            href={`/signup?code=${code}`}
            className="block w-full py-3 rounded-lg bg-black/5 border border-black/10 text-foreground font-medium text-center hover:bg-black/10 transition-colors"
          >
            Sign up on the web
          </Link>
        </div>

        <p className="text-center text-xs text-muted mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:text-accent-light transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
