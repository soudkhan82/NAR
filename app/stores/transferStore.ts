import { create } from "zustand";

export type EndpointType = "Site" | "Warehouse" | "R&R";
export type MoveStatus = "In Process" | "Approved" | "Transferred";

export type CatalogParam = { key: string; value: string };

export interface TransferDraft {
  sourceType: EndpointType;
  sourceName: string;
  destType: EndpointType;
  destName: string;
  assetId: number | null; // pk in source table
  assetType: string;
  purpose: string;
  txDate: string; // 'YYYY-MM-DD'
  status: MoveStatus; // only 'Approved' triggers execute
  catalog: CatalogParam[]; // dynamic per asset type
}

type TransferState = {
  draft: TransferDraft;
  setField: <K extends keyof TransferDraft>(k: K, v: TransferDraft[K]) => void;
  setCatalogKV: (i: number, k: string, v: string) => void;
  addCatalogRow: () => void;
  removeCatalogRow: (i: number) => void;
  reset: () => void;
};

const today = new Date().toISOString().slice(0, 10);

export const useTransferStore = create<TransferState>((set) => ({
  draft: {
    sourceType: "Site",
    sourceName: "",
    destType: "Site",
    destName: "",
    assetId: null,
    assetType: "",
    purpose: "",
    txDate: today,
    status: "In Process",
    catalog: [{ key: "", value: "" }],
  },
  setField: (k, v) => set((s) => ({ draft: { ...s.draft, [k]: v } })),
  setCatalogKV: (i, k, v) =>
    set((s) => {
      const next = s.draft.catalog.slice();
      next[i] = { ...next[i], [k]: v } as CatalogParam;
      return { draft: { ...s.draft, catalog: next } };
    }),
  addCatalogRow: () =>
    set((s) => ({
      draft: {
        ...s.draft,
        catalog: [...s.draft.catalog, { key: "", value: "" }],
      },
    })),
  removeCatalogRow: (i) =>
    set((s) => {
      const next = s.draft.catalog.slice();
      next.splice(i, 1);
      return {
        draft: {
          ...s.draft,
          catalog: next.length ? next : [{ key: "", value: "" }],
        },
      };
    }),
  reset: () =>
    set(() => ({
      draft: {
        sourceType: "Site",
        sourceName: "",
        destType: "Site",
        destName: "",
        assetId: null,
        assetType: "",
        purpose: "",
        txDate: today,
        status: "In Process",
        catalog: [{ key: "", value: "" }],
      },
    })),
}));
