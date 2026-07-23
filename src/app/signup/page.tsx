"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // If email confirmation is disabled in Supabase, session exists immediately.
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="w-full max-w-[380px] rounded-2xl border border-border bg-surface p-7 text-center shadow-card">
          <h1 className="font-display text-lg font-semibold text-ink">Compte créé 🎉</h1>
          <p className="mt-2 text-[13.5px] text-ink-2">
            Vérifiez votre boîte mail pour confirmer votre compte, puis connectez-vous.
          </p>
          <Link href="/login">
            <Button className="mt-5 w-full">Aller à la connexion</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-[#12A5A3] font-display text-lg font-bold text-white shadow-card">
            T
          </div>
          <h1 className="font-display text-xl font-semibold text-ink">Créer un compte</h1>
          <p className="mt-1 text-[13px] text-ink-2">Suivi Référencement — Telecontact/Edicom</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-surface p-7 shadow-card">
          <div className="mb-4">
            <Label htmlFor="fullName">Nom complet</Label>
            <Input
              id="fullName"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="ex: Yasmine El Amrani"
            />
          </div>
          <div className="mb-4">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@entreprise.com"
              autoComplete="email"
            />
          </div>
          <div className="mb-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6 caractères minimum"
              autoComplete="new-password"
            />
          </div>
          {error && <p className="mb-3 mt-2 text-[12.5px] font-medium text-danger">{error}</p>}
          <Button type="submit" className="mt-4 w-full" disabled={loading}>
            {loading ? "Création..." : "Créer mon compte"}
          </Button>
        </form>

        <p className="mt-5 text-center text-[12.5px] text-ink-2">
          Déjà un compte ?{" "}
          <Link href="/login" className="font-semibold text-brand hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
