import { create } from "zustand";
import type { Document } from "./model";
interface State {
  doc: Document | null;
  past: Document[];
  future: Document[];
  selected: string[];
  setDoc: (d: Document) => void;
  edit: (fn: (d: Document) => void) => void;
  undo: () => void;
  redo: () => void;
  select: (ids: string[]) => void;
}
export const useStore = create<State>((set, get) => ({
  doc: null,
  past: [],
  future: [],
  selected: [],
  setDoc: (doc) => set({ doc, past: [], future: [], selected: [] }),
  edit: (fn) => {
    const old = get().doc;
    if (!old) return;
    const doc = structuredClone(old);
    fn(doc);
    set({ doc, past: [...get().past.slice(-39), old], future: [] });
  },
  undo: () => {
    const { past, doc, future } = get();
    if (!past.length || !doc) return;
    set({
      doc: past[past.length - 1],
      past: past.slice(0, -1),
      future: [doc, ...future],
      selected: [],
    });
  },
  redo: () => {
    const { past, doc, future } = get();
    if (!future.length || !doc) return;
    set({
      doc: future[0],
      past: [...past, doc],
      future: future.slice(1),
      selected: [],
    });
  },
  select: (selected) => set({ selected }),
}));
