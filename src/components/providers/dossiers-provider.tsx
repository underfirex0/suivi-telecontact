"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Dossier, HistoriqueEntry, Profile } from "@/lib/types";
import { todayISO } from "@/lib/utils";

interface DossiersContextValue {
  dossiers: Dossier[];
  profiles: Profile[];
  currentProfile: Profile | null;
  loading: boolean;
  createDossier: (input: Partial<Dossier>) => Promise<string | null>;
  updateDossier: (id: string, patch: Partial<Dossier>, historiqueTexte?: string) => Promise<void>;
  deleteDossier: (id: string) => Promise<void>;
  markQcOk: (id: string) => Promise<void>;
  markQcCorrection: (id: string) => Promise<void>;
  markFacture: (id: string, date: string, montant: number | null) => Promise<void>;
  markPaye: (id: string) => Promise<void>;
  toggleJuridique: (id: string) => Promise<void>;
  fetchHistorique: (dossierId: string) => Promise<HistoriqueEntry[]>;
  signOut: () => Promise<void>;
}

const DossiersContext = createContext<DossiersContextValue | null>(null);

export function DossiersProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const [dossiersRes, profilesRes] = await Promise.all([
      supabase.from("dossiers").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("full_name", { ascending: true }),
    ]);

    if (dossiersRes.data) setDossiers(dossiersRes.data as Dossier[]);
    if (profilesRes.data) {
      setProfiles(profilesRes.data as Profile[]);
      if (user) {
        const mine = (profilesRes.data as Profile[]).find((p) => p.id === user.id);
        setCurrentProfile(mine ?? null);
      }
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadAll();

    const channel = supabase
      .channel("realtime-dossiers")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dossiers" },
        (payload) => {
          setDossiers((prev) => {
            if (payload.eventType === "INSERT") {
              const newRow = payload.new as Dossier;
              if (prev.some((d) => d.id === newRow.id)) return prev;
              return [newRow, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const updated = payload.new as Dossier;
              return prev.map((d) => (d.id === updated.id ? updated : d));
            }
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as Partial<Dossier>;
              return prev.filter((d) => d.id !== oldRow.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addHistorique = useCallback(
    async (dossierId: string, texte: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("historique").insert({
        dossier_id: dossierId,
        auteur_id: user?.id ?? null,
        texte,
      });
    },
    [supabase]
  );

  const createDossier = useCallback(
    async (input: Partial<Dossier>) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("dossiers")
        .insert({
          client_nom: input.client_nom,
          offre: input.offre ?? null,
          contact_client: input.contact_client ?? null,
          commercial: input.commercial ?? null,
          date_bc: input.date_bc,
          operateur_id: input.operateur_id ?? null,
          notes: input.notes ?? null,
          etape: "qc",
          qc_sous_statut: "attente",
          created_by: user?.id ?? null,
        })
        .select()
        .single();

      if (error || !data) {
        console.error(error);
        return null;
      }

      await addHistorique(data.id, "Dossier créé (BC signé reçu).");
      await loadAll();
      return data.id as string;
    },
    [supabase, addHistorique, loadAll]
  );

  const updateDossier = useCallback(
    async (id: string, patch: Partial<Dossier>, historiqueTexte?: string) => {
      const { error } = await supabase.from("dossiers").update(patch).eq("id", id);
      if (error) {
        console.error(error);
        return;
      }
      if (historiqueTexte) await addHistorique(id, historiqueTexte);
      await loadAll();
    },
    [supabase, addHistorique, loadAll]
  );

  const deleteDossier = useCallback(
    async (id: string) => {
      await supabase.from("dossiers").delete().eq("id", id);
      setDossiers((prev) => prev.filter((d) => d.id !== id));
    },
    [supabase]
  );

  const markQcOk = useCallback(
    (id: string) =>
      updateDossier(
        id,
        { etape: "facturation", qc_sous_statut: "ok", date_qc: todayISO() },
        "Contrôle qualité OK — dossier validé automatiquement."
      ),
    [updateDossier]
  );

  const markQcCorrection = useCallback(
    (id: string) =>
      updateDossier(
        id,
        { qc_sous_statut: "a_corriger" },
        "Contrôle qualité : corrections demandées."
      ),
    [updateDossier]
  );

  const markFacture = useCallback(
    (id: string, date: string, montant: number | null) =>
      updateDossier(
        id,
        { etape: "paiement", date_facture: date, montant_facture: montant },
        `Facture envoyée${montant ? " — " + montant.toLocaleString("fr-FR") + " MAD" : ""}.`
      ),
    [updateDossier]
  );

  const markPaye = useCallback(
    (id: string) =>
      updateDossier(
        id,
        { etape: "paye", date_paiement: todayISO() },
        "Paiement reçu — dossier clôturé."
      ),
    [updateDossier]
  );

  const toggleJuridique = useCallback(
    async (id: string) => {
      const d = dossiers.find((x) => x.id === id);
      if (!d) return;
      const next = !d.juridique_actif;
      await updateDossier(
        id,
        { juridique_actif: next },
        next ? "Suivi juridique activé manuellement." : "Suivi juridique retiré."
      );
    },
    [dossiers, updateDossier]
  );

  const fetchHistorique = useCallback(
    async (dossierId: string) => {
      const { data } = await supabase
        .from("historique")
        .select("*")
        .eq("dossier_id", dossierId)
        .order("created_at", { ascending: false });
      return (data as HistoriqueEntry[]) ?? [];
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [supabase, router]);

  const value: DossiersContextValue = {
    dossiers,
    profiles,
    currentProfile,
    loading,
    createDossier,
    updateDossier,
    deleteDossier,
    markQcOk,
    markQcCorrection,
    markFacture,
    markPaye,
    toggleJuridique,
    fetchHistorique,
    signOut,
  };

  return <DossiersContext.Provider value={value}>{children}</DossiersContext.Provider>;
}

export function useDossiers() {
  const ctx = useContext(DossiersContext);
  if (!ctx) throw new Error("useDossiers must be used within DossiersProvider");
  return ctx;
}
