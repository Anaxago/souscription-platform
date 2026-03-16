import { useState } from "react";
import { Form, useActionData, useNavigation, data, redirect } from "react-router";
import type { Route } from "./+types/souscrire.$slug.demarrer";
import { api } from "~/lib/api.server";

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */

interface MarketingProduct {
  id: string;
  name: string;
  slug: string;
  minimumInvestmentInCents: number | null;
  minimumInvestmentCurrency: string;
  status: string;
}

type ActionData =
  | { success: false; error: string }
  | undefined;

/* ──────────────────────────────────────────────
   Loader — fetch product to get its ID
   ────────────────────────────────────────────── */

export async function loader({ params }: Route.LoaderArgs) {
  const { slug } = params;
  const response = await api(`/marketing-products/by-slug/${slug}`);

  if (!response.ok) {
    throw data(null, { status: 404 });
  }

  const product = (await response.json()) as MarketingProduct;

  if (product.status !== "OPEN") {
    throw data(null, { status: 403 });
  }

  return { product };
}

/* ──────────────────────────────────────────────
   Action — create person kernel → investor → journey
   ────────────────────────────────────────────── */

export async function action({ request, params }: Route.ActionArgs) {
  const { slug } = params;
  const formData = await request.formData();
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const marketingProductId = formData.get("marketingProductId") as string;

  if (!firstName?.trim() || !lastName?.trim()) {
    return { success: false as const, error: "Le prénom et le nom sont requis." };
  }

  // Step 1: Create PersonKernel
  const kernelRes = await api("/person-kernels", {
    method: "POST",
    body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
  });

  if (!kernelRes.ok) {
    const err = await kernelRes.json().catch(() => ({}));
    return {
      success: false as const,
      error: (err as Record<string, string>).message ?? "Erreur lors de la création du profil.",
    };
  }

  const kernel = (await kernelRes.json()) as { id: string };

  // Step 2: Create IndividualInvestor
  const investorRes = await api("/individual-investors", {
    method: "POST",
    body: JSON.stringify({ personKernelId: kernel.id }),
  });

  if (!investorRes.ok) {
    const err = await investorRes.json().catch(() => ({}));
    return {
      success: false as const,
      error: (err as Record<string, string>).message ?? "Erreur lors de la création de l'investisseur.",
    };
  }

  const investor = (await investorRes.json()) as { id: string };

  // Step 3: Create SubscriptionJourney
  const journeyRes = await api("/subscription-journeys", {
    method: "POST",
    body: JSON.stringify({
      investorId: investor.id,
      investorType: "NATURAL",
      marketingProductId,
    }),
  });

  if (!journeyRes.ok) {
    const err = await journeyRes.json().catch(() => ({}));
    return {
      success: false as const,
      error: (err as Record<string, string>).message ?? "Erreur lors du démarrage du parcours.",
    };
  }

  const journey = (await journeyRes.json()) as { id: string };

  // Redirect to journey page
  throw redirect(`/souscrire/${slug}/parcours/${journey.id}`);
}

/* ──────────────────────────────────────────────
   Meta
   ────────────────────────────────────────────── */

export function meta({ data }: Route.MetaArgs) {
  if (!data) {
    return [{ title: "Souscrire — Anaxago" }];
  }
  return [
    { title: `Démarrer — ${data.product.name} — Anaxago` },
  ];
}

/* ──────────────────────────────────────────────
   Component
   ────────────────────────────────────────────── */

export default function DemarrerSouscription({ loaderData }: Route.ComponentProps) {
  const { product } = loaderData;
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="ds4-body">
      {/* Navbar */}
      <nav className="nav-bar scrolled">
        <a className="nav-logo-text" href="/">Anaxago</a>
      </nav>

      <main style={{ paddingTop: 100 }}>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "var(--space-xl)" }}>
          {/* Back link */}
          <a
            href={`/souscrire/${product.slug}`}
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--clr-cashmere)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginBottom: "var(--space-lg)",
            }}
          >
            ← Retour au produit
          </a>

          {/* Header */}
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(28px, 4vw, 36px)",
              fontWeight: 300,
              letterSpacing: "-0.02em",
              color: "var(--clr-obsidian)",
              marginBottom: "var(--space-xs)",
            }}
          >
            Commencer votre souscription
          </h1>
          <p style={{ fontSize: 15, color: "var(--clr-cashmere)", marginBottom: "var(--space-xl)" }}>
            {product.name}
          </p>

          {/* Form */}
          <Form method="post">
            <input type="hidden" name="marketingProductId" value={product.id} />

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              <div>
                <label className="form-label" htmlFor="firstName">Prénom</label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  placeholder="Jean"
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label" htmlFor="lastName">Nom</label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  placeholder="Dupont"
                  className="form-input"
                />
              </div>
            </div>

            {actionData?.success === false && (
              <div className="form-error" style={{ marginTop: "var(--space-md)" }}>
                {actionData.error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
              style={{
                width: "100%",
                justifyContent: "center",
                marginTop: "var(--space-lg)",
                opacity: isSubmitting ? 0.6 : 1,
                cursor: isSubmitting ? "not-allowed" : "pointer",
              }}
            >
              {isSubmitting ? "Création du parcours..." : "Démarrer le parcours"}
            </button>
          </Form>

          {/* Trust signals */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginTop: "var(--space-lg)",
            paddingTop: "var(--space-md)",
            borderTop: "1px solid var(--clr-stroke-dark)",
          }}>
            {["Signature électronique sécurisée", "Souscription en 5 min", "CIF enregistré AMF"].map((text) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--clr-cashmere)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                {text}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
