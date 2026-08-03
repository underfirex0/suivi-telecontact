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
import { format, addHours, addDays } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import type { Dossier, HistoriqueEntry, Profile, Paiement, ActionEntry, ActionType, JuridiqueEtape, ImportBatch } from "@/lib/types";
import { todayISO } from "@/lib/utils";
import { JURIDIQUE_ETAPES } from "@/lib/dossier-logic";
import type { ImportDiff } from "@/lib/import-diff";

interface DossiersContextValue {
  dossiers: Dossier[];
  profiles: Profile[];
  currentProfile: Profile | null;
  loading: boolean;
  createDossier: (input: Partial<Dossier>) => Promise<string | null>;
  updateDossier: (id: string, patch: Partial<Dossier>, historiqueTexte?: string) => Promise<void>;
  archiveDossier: (id: string) => Promise<void>;
  restoreDossier: (id: string) => Promise<void>;
  markQcOk: (id: string) => Promise<void>;
  markQcCorrection: (id: string) => Promise<void>;
  markFacture: (id: string, date: string, montant: number | null) => Promise<void>;
  markPaye: (id: string) => Promise<void>;
  toggleJuridique: (id: string) => Promise<void>;
  updateJuridiqueEtape: (id: string, etape: JuridiqueEtape, dateEtape?: string) => Promise<void>;
  revertQcCorrection: (id: string) => Promise<void>;
  revertValidation: (id: string) => Promise<void>;
  revertFacturation: (id: string) => Promise<void>;
  revertPaiement: (id: string) => Promise<void>;
  fetchHistorique: (dossierId: string) => Promise<HistoriqueEntry[]>;
  fetchPaiements: (dossierId: string) => Promise<Paiement[]>;
  addPaiement: (dossierId: string, montant: number, datePaiement: string, note?: string) => Promise<void>;
  deletePaiement: (id: string, dossierId: string) => Promise<void>;
  fetchActions: (dossierId: string) => Promise<ActionEntry[]>;
  fetchAllActions: () => Promise<ActionEntry[]>;
  addAction: (
    dossierId: string,
    type: ActionType,
    resultat: string,
    note: string,
    dateRappel: string | null,
    sousStatut?: string | null
  ) => Promise<void>;
  updateCourrielNiveau: (id: string, niveau: 1 | 2 | 3) => Promise<void>;
  commitImport: (diff: ImportDiff, libelle: string, fichiers: string[]) => Promise<void>;
  fetchImportBatches: () => Promise<ImportBatch[]>;
  claimDossier: (id: string) => Promise<void>;
  abandonDossier: (id: string, raison: string) => Promise<void>;
  reactivateDossier: (id: string) => Promise<void>;
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

      // La visibilité démarre au référencement (24h après création) et dure 365 jours,
      // sauf si des dates historiques précises sont fournies (import de données 2025/2026).
      const dateDebutVisibilite =
        input.date_debut_visibilite ?? format(addHours(new Date(), 24), "yyyy-MM-dd");
      const dateFinVisibilite =
        input.date_fin_visibilite ?? format(addDays(new Date(dateDebutVisibilite), 365), "yyyy-MM-dd");

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
          ville: input.ville ?? null,
          numero_facture: input.numero_facture ?? null,
          date_debut_visibilite: dateDebutVisibilite,
          date_fin_visibilite: dateFinVisibilite,
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

  const archiveDossier = useCallback(
    async (id: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await updateDossier(
        id,
        { archived_at: new Date().toISOString(), archived_by: user?.id ?? null },
        "Dossier archivé (supprimé)."
      );
    },
    [supabase, updateDossier]
  );

  const restoreDossier = useCallback(
    async (id: string) => {
      await updateDossier(
        id,
        { archived_at: null, archived_by: null },
        "Dossier restauré depuis les archives."
      );
    },
    [updateDossier]
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
        next
          ? {
              juridique_actif: true,
              juridique_etape: "en_attente",
              juridique_etape_maj_at: new Date().toISOString(),
            }
          : { juridique_actif: false },
        next ? "Suivi juridique activé manuellement — étape : En attente." : "Suivi juridique retiré."
      );
    },
    [dossiers, updateDossier]
  );

  const updateJuridiqueEtape = useCallback(
    async (id: string, etape: JuridiqueEtape, dateEtape?: string) => {
      const label = JURIDIQUE_ETAPES.find((e) => e.key === etape)?.label ?? etape;
      const dateField: Partial<Dossier> = {};
      const stamp = dateEtape || todayISO();
      if (etape === "mise_en_demeure_edicom") dateField.date_mise_en_demeure = stamp;
      if (etape === "mise_en_demeure_avocat") dateField.date_mise_en_demeure_avocat = stamp;
      if (etape === "assignation") dateField.date_assignation = stamp;
      if (etape === "jugement") dateField.date_jugement = stamp;
      await updateDossier(
        id,
        { juridique_etape: etape, juridique_etape_maj_at: new Date().toISOString(), ...dateField },
        `Suivi juridique — nouvelle étape : ${label}.`
      );
    },
    [updateDossier]
  );

  // ---- Annulations (corriger une erreur de manipulation, sans supprimer le dossier) ----

  const revertQcCorrection = useCallback(
    (id: string) =>
      updateDossier(
        id,
        { qc_sous_statut: "attente" },
        "Annulation : la demande de correction a été retirée."
      ),
    [updateDossier]
  );

  const revertValidation = useCallback(
    (id: string) =>
      updateDossier(
        id,
        { etape: "qc", qc_sous_statut: "attente", date_qc: null },
        "Annulation : retour au contrôle qualité (validation annulée)."
      ),
    [updateDossier]
  );

  const revertFacturation = useCallback(
    (id: string) =>
      updateDossier(
        id,
        { etape: "facturation", date_facture: null, montant_facture: null },
        "Annulation : la facturation a été annulée."
      ),
    [updateDossier]
  );

  const revertPaiement = useCallback(
    (id: string) =>
      updateDossier(
        id,
        { etape: "paiement", date_paiement: null },
        "Annulation : le paiement a été annulé."
      ),
    [updateDossier]
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

  const fetchPaiements = useCallback(
    async (dossierId: string) => {
      const { data } = await supabase
        .from("paiements")
        .select("*")
        .eq("dossier_id", dossierId)
        .order("date_paiement", { ascending: false });
      return (data as Paiement[]) ?? [];
    },
    [supabase]
  );

  const addPaiement = useCallback(
    async (dossierId: string, montant: number, datePaiement: string, note?: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("paiements").insert({
        dossier_id: dossierId,
        montant,
        date_paiement: datePaiement,
        note: note ?? null,
        created_by: user?.id ?? null,
      });
      await addHistorique(
        dossierId,
        `Paiement enregistré — ${montant.toLocaleString("fr-FR")} MAD${note ? " (" + note + ")" : ""}.`
      );
      await loadAll();
    },
    [supabase, addHistorique, loadAll]
  );

  const deletePaiement = useCallback(
    async (id: string, dossierId: string) => {
      await supabase.from("paiements").delete().eq("id", id);
      await addHistorique(dossierId, "Un paiement a été supprimé (correction).");
      await loadAll();
    },
    [supabase, addHistorique, loadAll]
  );

  const fetchActions = useCallback(
    async (dossierId: string) => {
      const { data } = await supabase
        .from("actions")
        .select("*")
        .eq("dossier_id", dossierId)
        .order("created_at", { ascending: false });
      return (data as ActionEntry[]) ?? [];
    },
    [supabase]
  );

  const fetchAllActions = useCallback(async () => {
    const { data } = await supabase
      .from("actions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    return (data as ActionEntry[]) ?? [];
  }, [supabase]);

  const ACTION_LABELS: Record<ActionType, string> = {
    appel: "Appel",
    email: "Email",
    visite: "Visite",
    promesse_paiement: "Promesse de paiement",
    autre: "Autre",
  };

  const addAction = useCallback(
    async (
      dossierId: string,
      type: ActionType,
      resultat: string,
      note: string,
      dateRappel: string | null,
      sousStatut?: string | null
    ) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("actions").insert({
        dossier_id: dossierId,
        type,
        resultat: resultat || null,
        sous_statut: sousStatut || null,
        note: note || null,
        date_rappel: dateRappel,
        created_by: user?.id ?? null,
      });
      const label = ACTION_LABELS[type];
      const texte = `Action enregistrée — ${label}${sousStatut ? " (" + sousStatut + ")" : ""}${
        resultat ? " : " + resultat : ""
      }${dateRappel ? ` (rappel prévu le ${dateRappel})` : ""}`;
      await addHistorique(dossierId, texte);
      await loadAll();
    },
    [supabase, addHistorique, loadAll]
  );

  const updateCourrielNiveau = useCallback(
    async (id: string, niveau: 1 | 2 | 3) => {
      await updateDossier(id, { courriel_niveau: niveau }, `Courriel niveau ${niveau} envoyé.`);
    },
    [updateDossier]
  );

  const commitImport = useCallback(
    async (diff: ImportDiff, libelle: string, fichiers: string[]) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // 1) Créer les nouveaux dossiers en bloc
      const nouveauxPayload = diff.nouveaux.map((n) => {
        const dateDebut = n.dateDebutVisibilite ?? n.dateCreation ?? todayISO();
        const notesParts: string[] = [];
        if (n.teleacteur) notesParts.push(`Téléacteur historique : ${n.teleacteur}`);
        if (n.source === "reglement_seul") {
          notesParts.push("Montant facturé estimé = montant réglé (déduit automatiquement, non confirmé par un fichier 'en instance').");
        }
        return {
          client_nom: n.client,
          ville: n.ville,
          commercial: n.commercial,
          numero_facture: n.numeroFacture,
          date_bc: n.dateCreation ?? todayISO(),
          date_debut_visibilite: dateDebut,
          date_fin_visibilite: n.dateFinVisibilite,
          montant_facture: n.montantFacture,
          courriel_niveau: n.courrielNiveau,
          etape: n.paye ? "paye" : "paiement",
          qc_sous_statut: "ok",
          date_qc: n.dateCreation ?? todayISO(),
          date_facture: n.dateCreation ?? todayISO(),
          date_paiement: n.paye ? todayISO() : null,
          notes: notesParts.length ? notesParts.join(" — ") : null,
          created_by: user?.id ?? null,
        };
      });

      let insertedDossiers: { id: string; numero_facture: string | null }[] = [];
      if (nouveauxPayload.length > 0) {
        const { data, error } = await supabase.from("dossiers").insert(nouveauxPayload).select("id, numero_facture");
        if (error) throw error;
        insertedDossiers = data ?? [];
      }
      const newIdByFacture = new Map(insertedDossiers.map((d) => [d.numero_facture ?? "", d.id]));

      // 2) Construire les paiements à insérer (nouveaux dossiers avec montant déjà reçu + paiements sur dossiers existants)
      const paiementsPayload: {
        dossier_id: string;
        montant: number;
        date_paiement: string;
        note: string;
        created_by: string | null;
      }[] = [];

      diff.nouveaux.forEach((n) => {
        if (n.montantRecu <= 0) return;
        const id = newIdByFacture.get(n.numeroFacture);
        if (!id) return;
        paiementsPayload.push({
          dossier_id: id,
          montant: n.montantRecu,
          date_paiement: n.dateCreation ?? todayISO(),
          note: `Import "${libelle}" — montant reçu à la création.`,
          created_by: user?.id ?? null,
        });
      });

      diff.paiementsExistants.forEach((p) => {
        paiementsPayload.push({
          dossier_id: p.dossierId,
          montant: p.montantAjoute,
          date_paiement: p.dateReglement ?? todayISO(),
          note: `Import "${libelle}" — règlement reçu.`,
          created_by: user?.id ?? null,
        });
      });

      if (paiementsPayload.length > 0) {
        const { error } = await supabase.from("paiements").insert(paiementsPayload);
        if (error) throw error;
      }

      // 3) Historique (création + paiements) en un seul insert groupé
      const historiquePayload: { dossier_id: string; auteur_id: string | null; texte: string }[] = [];
      diff.nouveaux.forEach((n) => {
        const id = newIdByFacture.get(n.numeroFacture);
        if (!id) return;
        historiquePayload.push({
          dossier_id: id,
          auteur_id: user?.id ?? null,
          texte: `Dossier créé via import "${libelle}".`,
        });
      });
      diff.paiementsExistants.forEach((p) => {
        historiquePayload.push({
          dossier_id: p.dossierId,
          auteur_id: user?.id ?? null,
          texte: `Import "${libelle}" — paiement de ${p.montantAjoute.toLocaleString("fr-FR")} MAD enregistré.`,
        });
      });
      if (historiquePayload.length > 0) {
        await supabase.from("historique").insert(historiquePayload);
      }

      // 4) Enregistrer le batch dans l'historique des imports (visibilité permanente)
      const kpis = {
        nb_nouveaux_dossiers: diff.nouveaux.length,
        nb_dossiers_soldes:
          diff.nouveaux.filter((n) => n.paye).length + diff.paiementsExistants.filter((p) => p.devientPaye).length,
        nb_dossiers_partiels: diff.paiementsExistants.filter((p) => !p.devientPaye).length,
        montant_total_regle:
          diff.nouveaux.reduce((s, n) => s + n.montantRecu, 0) +
          diff.paiementsExistants.reduce((s, p) => s + p.montantAjoute, 0),
      };
      await supabase.from("imports").insert({
        libelle,
        fichiers,
        ...kpis,
        detail: diff,
        created_by: user?.id ?? null,
      });

      await loadAll();
    },
    [supabase, loadAll]
  );

  const fetchImportBatches = useCallback(async () => {
    const { data } = await supabase.from("imports").select("*").order("created_at", { ascending: false });
    return (data as ImportBatch[]) ?? [];
  }, [supabase]);

  const claimDossier = useCallback(
    async (id: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const mine = profiles.find((p) => p.id === user.id);
      await updateDossier(id, { operateur_id: user.id }, `Dossier pris en charge par ${mine?.full_name ?? "un opérateur"}.`);
    },
    [supabase, profiles, updateDossier]
  );

  const abandonDossier = useCallback(
    async (id: string, raison: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await updateDossier(
        id,
        { abandonne_at: new Date().toISOString(), abandonne_par: user?.id ?? null, abandonne_raison: raison },
        `Dossier abandonné — ${raison}`
      );
    },
    [supabase, updateDossier]
  );

  const reactivateDossier = useCallback(
    async (id: string) => {
      await updateDossier(
        id,
        { abandonne_at: null, abandonne_par: null, abandonne_raison: null },
        "Dossier réactivé (retiré des abandons)."
      );
    },
    [updateDossier]
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
    archiveDossier,
    restoreDossier,
    markQcOk,
    markQcCorrection,
    markFacture,
    markPaye,
    toggleJuridique,
    updateJuridiqueEtape,
    revertQcCorrection,
    revertValidation,
    revertFacturation,
    revertPaiement,
    fetchHistorique,
    fetchPaiements,
    addPaiement,
    deletePaiement,
    fetchActions,
    fetchAllActions,
    addAction,
    updateCourrielNiveau,
    commitImport,
    fetchImportBatches,
    claimDossier,
    abandonDossier,
    reactivateDossier,
    signOut,
  };

  return <DossiersContext.Provider value={value}>{children}</DossiersContext.Provider>;
}

export function useDossiers() {
  const ctx = useContext(DossiersContext);
  if (!ctx) throw new Error("useDossiers must be used within DossiersProvider");
  return ctx;
}
