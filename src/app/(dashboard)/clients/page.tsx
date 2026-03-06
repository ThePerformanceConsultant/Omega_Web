"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search, ChevronRight, Copy, Check, Link2, X } from "lucide-react";
import { Client, ClientSubTab } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { ClientProfile } from "@/components/clients/client-profile";
import { fetchClients, getCoachInviteCode } from "@/lib/supabase/db";

function complianceColor(pct: number) {
  if (pct >= 90) return "text-success";
  if (pct >= 75) return "text-warning";
  return "text-accent";
}

function complianceBg(pct: number) {
  if (pct >= 90) return "bg-success";
  if (pct >= 75) return "bg-warning";
  return "bg-accent";
}

export default function ClientsPage() {
  return (
    <Suspense>
      <ClientsPageInner />
    </Suspense>
  );
}

function ClientsPageInner() {
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [initialTab, setInitialTab] = useState<ClientSubTab | undefined>(undefined);

  // Invite code
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Add Client modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [addResult, setAddResult] = useState<{ email: string; temp_password: string } | null>(null);

  useEffect(() => {
    fetchClients()
      .then((data) => setClients(data as Client[]))
      .catch((err) => console.error("[Clients] fetch failed:", err));

    getCoachInviteCode().then(setInviteCode);
  }, []);

  // Auto-select client from URL params after clients load
  const pendingClientId = searchParams.get("clientId");
  const pendingTab = searchParams.get("tab") as ClientSubTab | null;
  useEffect(() => {
    if (!pendingClientId || selectedClient) return;
    const match = clients.find((c) => c.id === pendingClientId);
    if (match) {
      queueMicrotask(() => {
        setSelectedClient(match);
        if (pendingTab) setInitialTab(pendingTab);
        window.history.replaceState({}, "", "/clients");
      });
    }
  }, [clients, pendingClientId, pendingTab, selectedClient]);

  const filtered = useMemo(() => {
    if (!search) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.tag?.toLowerCase().includes(q) ||
        c.current_phase?.toLowerCase().includes(q)
    );
  }, [clients, search]);

  function copyToClipboard(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  }

  const inviteLink = inviteCode
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${inviteCode}`
    : "";

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    setAddLoading(true);
    setAddResult(null);

    try {
      const res = await fetch("/api/admin/create-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: newName, email: newEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || "Failed to create client");
        setAddLoading(false);
        return;
      }
      setAddResult({ email: data.email, temp_password: data.temp_password });
      setAddLoading(false);

      // Refresh client list
      fetchClients()
        .then((fresh) => setClients(fresh as Client[]))
        .catch(() => {});
    } catch {
      setAddError("An unexpected error occurred");
      setAddLoading(false);
    }
  }

  function closeAddModal() {
    setShowAddModal(false);
    setNewName("");
    setNewEmail("");
    setAddError("");
    setAddResult(null);
  }

  // Client Profile View
  if (selectedClient) {
    return (
      <ClientProfile
        client={selectedClient}
        onBack={() => { setSelectedClient(null); setInitialTab(undefined); }}
        initialTab={initialTab}
      />
    );
  }

  // Client Roster View
  return (
    <div className="space-y-6">
      {/* Invite Code Banner */}
      {inviteCode && (
        <div className="glass-card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted mb-1">
              Share this link with new clients to sign up
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Code:</span>
              <span className="font-mono font-bold tracking-widest text-foreground">{inviteCode}</span>
              <button
                onClick={() => copyToClipboard(inviteCode, setCodeCopied)}
                className="p-1 rounded hover:bg-black/5 transition-colors text-muted"
                title="Copy code"
              >
                {codeCopied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
          <button
            onClick={() => copyToClipboard(inviteLink, setLinkCopied)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/5 border border-black/10 text-sm text-foreground hover:bg-black/10 transition-colors shrink-0"
          >
            {linkCopied ? <Check size={14} className="text-success" /> : <Link2 size={14} />}
            {linkCopied ? "Copied!" : "Copy Invite Link"}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{filtered.length} active clients</p>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white text-sm font-medium shadow-[0_4px_16px_rgba(184,134,11,0.3)] hover:shadow-[0_4px_24px_rgba(184,134,11,0.4)] transition-shadow flex items-center gap-2"
        >
          <Plus size={16} /> Add Client
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, tag, or phase..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
        />
      </div>

      {/* Client List */}
      <div className="glass-card p-0 overflow-hidden">
        {filtered.map((c, i) => (
          <button
            key={c.id}
            onClick={() => setSelectedClient(c)}
            className={`flex items-center gap-4 w-full px-5 py-3.5 text-left hover:bg-black/5 transition-colors ${
              i > 0 ? "border-t border-black/5" : ""
            }`}
          >
            <Avatar initials={c.avatar_initials || "?"} size={36} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{c.full_name}</div>
              <div className="text-xs text-muted">{c.email}</div>
            </div>
            {c.tag && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-black/5 text-muted shrink-0">
                {c.tag}
              </span>
            )}
            {c.current_phase && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-black/5 text-muted shrink-0 hidden md:inline">
                {c.current_phase}
              </span>
            )}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-16 h-1.5 rounded-full bg-black/5">
                <div
                  className={`h-full rounded-full ${complianceBg(c.compliance_pct)}`}
                  style={{ width: `${c.compliance_pct}%` }}
                />
              </div>
              <span
                className={`text-sm font-semibold w-10 text-right ${complianceColor(c.compliance_pct)}`}
              >
                {c.compliance_pct}%
              </span>
            </div>
            <ChevronRight size={16} className="text-muted/40 shrink-0" />
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-muted text-sm">
            No clients match your search
          </div>
        )}
      </div>

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="glass-card p-6 w-full max-w-md relative">
            <button
              onClick={closeAddModal}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-black/5 text-muted"
            >
              <X size={18} />
            </button>

            {addResult ? (
              /* Success state */
              <div className="text-center">
                <div className="text-2xl mb-3">&#x2705;</div>
                <h3 className="text-lg font-semibold mb-1">Client Created</h3>
                <p className="text-sm text-muted mb-4">
                  Share these credentials with your client so they can sign in.
                </p>
                <div className="bg-black/5 border border-black/10 rounded-lg p-4 mb-4 text-left space-y-2">
                  <div>
                    <span className="text-xs text-muted">Email</span>
                    <p className="text-sm font-medium">{addResult.email}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted">Temporary Password</span>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono font-bold">{addResult.temp_password}</p>
                      <button
                        onClick={() => navigator.clipboard.writeText(addResult.temp_password)}
                        className="p-1 rounded hover:bg-black/5 text-muted"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  onClick={closeAddModal}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white font-medium"
                >
                  Done
                </button>
              </div>
            ) : (
              /* Form state */
              <>
                <h3 className="text-lg font-semibold mb-1">Add Client</h3>
                <p className="text-sm text-muted mb-4">
                  Create an account for a new client. They&apos;ll receive a temporary password to sign in.
                </p>

                <form onSubmit={handleAddClient} className="space-y-4">
                  {addError && (
                    <div className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
                      {addError}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-muted mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
                      placeholder="John Smith"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted mb-1.5">Email</label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg bg-black/5 border border-black/10 text-foreground placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25"
                      placeholder="client@example.com"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={addLoading}
                    className="w-full py-2.5 rounded-lg bg-gradient-to-br from-accent to-accent-light text-white font-medium shadow-[0_4px_16px_rgba(184,134,11,0.3)] hover:shadow-[0_4px_24px_rgba(184,134,11,0.4)] transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addLoading ? "Creating..." : "Create Client"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
