"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Client, ClientPanelType, ClientSubTab } from "./types";

type ClientViewState = {
  clients: Client[];
  selectedClientId: string | null;
  activePanel: ClientPanelType;
  activeSubTab: ClientSubTab;
};

let state: ClientViewState = {
  clients: [],
  selectedClientId: null,
  activePanel: null,
  activeSubTab: "overview",
};

const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function setState(next: Partial<ClientViewState>) {
  state = { ...state, ...next };
  emitChange();
}

export const clientViewStore = {
  getState(): ClientViewState {
    return state;
  },

  setClients(clients: Client[]) {
    const selectedStillExists =
      state.selectedClientId != null &&
      clients.some((client) => client.id === state.selectedClientId);
    setState({
      clients,
      selectedClientId: selectedStillExists ? state.selectedClientId : null,
      activePanel: selectedStillExists ? state.activePanel : null,
      activeSubTab: selectedStillExists ? state.activeSubTab : "overview",
    });
  },

  selectClient(clientId: string, options?: { closePanel?: boolean }) {
    const selected = state.clients.some((client) => client.id === clientId) ? clientId : null;
    if (!selected) return;
    setState({
      selectedClientId: selected,
      activePanel: options?.closePanel ? null : state.activePanel,
    });
  },

  clearSelectedClient() {
    setState({ selectedClientId: null, activePanel: null });
  },

  setActivePanel(panel: ClientPanelType) {
    setState({ activePanel: panel });
  },

  setActiveSubTab(tab: ClientSubTab) {
    setState({ activeSubTab: tab });
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useClientViewState(): ClientViewState {
  return useSyncExternalStore(
    clientViewStore.subscribe,
    clientViewStore.getState,
    clientViewStore.getState,
  );
}

export function useSelectedClient(): Client | null {
  const { clients, selectedClientId } = useClientViewState();
  return useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );
}
