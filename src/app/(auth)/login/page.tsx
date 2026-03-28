"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0f0f0f] text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(212,170,92,0.35),transparent_55%),radial-gradient(circle_at_50%_120%,rgba(212,170,92,0.2),transparent_45%)]" />

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-[#d6b36f]/25 bg-[#141414]/90 p-8 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#d6b36f] mb-2">Omega Coach</h1>
            <p className="text-sm text-white/70">Sign in to your coaching portal</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-400/35 text-sm text-red-200">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/15 text-white placeholder-white/35 focus:outline-none focus:border-[#d6b36f]/60 focus:ring-1 focus:ring-[#d6b36f]/35 transition-colors"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/15 text-white placeholder-white/35 focus:outline-none focus:border-[#d6b36f]/60 focus:ring-1 focus:ring-[#d6b36f]/35 transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#c7a462] to-[#e1c488] text-[#141414] font-semibold shadow-[0_10px_26px_rgba(199,164,98,0.35)] hover:shadow-[0_14px_32px_rgba(199,164,98,0.45)] transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-center text-sm text-white/65 mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-[#d6b36f] hover:text-[#e1c488] transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
