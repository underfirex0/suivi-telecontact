"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Email ou mot de passe incorrect.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-[#12A5A3] font-display text-lg font-bold text-white shadow-card">
            T
          </div>
          <h1 className="font-display text-xl font-semibold text-ink">Suivi Référencement</h1>
          <p className="mt-1 text-[13px] text-ink-2">Telecontact / Edicom</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-surface p-7 shadow-card">
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="mb-3 mt-2 text-[12.5px] font-medium text-danger">{error}</p>}
          <Button type="submit" className="mt-4 w-full" disabled={loading}>
            {loading ? "Connexion..." : "Se connecter"}
          </Button>
        </form>

        <p className="mt-5 text-center text-[12.5px] text-ink-2">
          Pas encore de compte ?{" "}
          <Link href="/signup" className="font-semibold text-brand hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
