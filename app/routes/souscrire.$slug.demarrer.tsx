import { useState } from "react";
import { data, redirect } from "react-router";
import type { Route } from "./+types/souscrire.$slug.demarrer";
import { api } from "~/lib/api.server";

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */

interface MarketingProduct {
  id: string;
  name: string;
  slug: string;
  status: string;
}

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

async function findIssuanceOperationId(productId: string): Promise<string | undefined> {
  try {
    const templatesRes = await api("/subscription-journey-templates");
    if (templatesRes.ok) {
      const body = (await templatesRes.json()) as {
        data: { marketingProductId: string; issuanceOperationId: string | null; status: string }[];
      };
      const match = (body.data ?? []).find(
        (t) => t.marketingProductId === productId && t.status === "ACTIVE" && t.issuanceOperationId,
      );
      if (match?.issuanceOperationId) return match.issuanceOperationId;
    }
  } catch {
    // Non-blocking
  }
  return undefined;
}

/* ──────────────────────────────────────────────
   Loader
   ────────────────────────────────────────────── */

export async function loader({ params }: Route.LoaderArgs) {
  const { slug } = params;

  const productRes = await api(`/marketing-products/by-slug/${slug}`);
  if (!productRes.ok) throw data(null, { status: 404 });
  const product = (await productRes.json()) as MarketingProduct;
  if (product.status !== "OPEN") throw data(null, { status: 403 });

  return { product, slug };
}

export function meta() {
  return [{ title: "Démarrage de la souscription — Anaxago" }];
}

/* ──────────────────────────────────────────────
   Action — create entities based on investor type, then redirect
   ────────────────────────────────────────────── */

export async function action({ request, params }: Route.ActionArgs) {
  const { slug } = params;
  const formData = await request.formData();
  const investorType = formData.get("investorType") as string;

  const productRes = await api(`/marketing-products/by-slug/${slug}`);
  if (!productRes.ok) throw data(null, { status: 404 });
  const product = (await productRes.json()) as MarketingProduct;

  const errorData = { product, slug };

  if (investorType === "LEGAL") {
    // 1. PersonKernel for operator
    const kernelRes = await api("/person-kernels", {
      method: "POST",
      body: JSON.stringify({ firstName: "Représentant", lastName: "Légal" }),
    });
    if (!kernelRes.ok) return { error: "Erreur lors de la création du profil.", ...errorData };
    const kernel = (await kernelRes.json()) as { id: string };

    // 2. Create placeholder LegalEntityKernel (real SIRET collected at verification step)
    const placeholderSiret = `${Date.now()}`.slice(0, 14);
    const leKernelRes = await api("/legal-entity-kernels", {
      method: "POST",
      body: JSON.stringify({ name: "Entreprise", siret: placeholderSiret }),
    });
    if (!leKernelRes.ok) {
      const err = await leKernelRes.json().catch(() => ({}));
      return { error: (err as Record<string, string>).message ?? "Erreur création société.", ...errorData };
    }
    const leKernel = (await leKernelRes.json()) as { id: string };

    // 3. Create LegalEntityInvestor
    const investorRes = await api("/legal-entity-investors", {
      method: "POST",
      body: JSON.stringify({ legalEntityKernelId: leKernel.id, operatedBy: kernel.id }),
    });
    if (!investorRes.ok) {
      const err = await investorRes.json().catch(() => ({}));
      return { error: (err as Record<string, string>).message ?? "Erreur création investisseur.", ...errorData };
    }
    const investor = (await investorRes.json()) as { id: string };

    // 4. Create journey
    const issuanceOperationId = await findIssuanceOperationId(product.id);
    const journeyRes = await api("/subscription-journeys", {
      method: "POST",
      body: JSON.stringify({
        investorId: investor.id,
        investorType: "LEGAL",
        marketingProductId: product.id,
        ...(issuanceOperationId ? { issuanceOperationId } : {}),
      }),
    });
    if (!journeyRes.ok) {
      const err = await journeyRes.json().catch(() => ({}));
      const rawMessage = (err as Record<string, string>).message ?? "";
      const userMessage = rawMessage.includes("Cannot read") || rawMessage.includes("Internal")
        ? "Une erreur technique est survenue. Veuillez réessayer."
        : rawMessage || "Erreur lors du démarrage du parcours.";
      return { error: userMessage, ...errorData };
    }
    const journey = (await journeyRes.json()) as { id: string };
    throw redirect(`/souscrire/${slug}/parcours/${journey.id}`);
  }

  // ── Individual flow ──
  const kernelRes = await api("/person-kernels", {
    method: "POST",
    body: JSON.stringify({ firstName: "Investisseur", lastName: "Anonyme" }),
  });
  if (!kernelRes.ok) return { error: "Erreur lors de la création du profil.", ...errorData };
  const kernel = (await kernelRes.json()) as { id: string };

  const investorRes = await api("/individual-investors", {
    method: "POST",
    body: JSON.stringify({ personKernelId: kernel.id }),
  });
  if (!investorRes.ok) return { error: "Erreur lors de la création de l'investisseur.", ...errorData };
  const investor = (await investorRes.json()) as { id: string };

  const issuanceOperationId = await findIssuanceOperationId(product.id);
  const journeyRes = await api("/subscription-journeys", {
    method: "POST",
    body: JSON.stringify({
      investorId: investor.id,
      investorType: "NATURAL",
      marketingProductId: product.id,
      ...(issuanceOperationId ? { issuanceOperationId } : {}),
    }),
  });
  if (!journeyRes.ok) {
    const err = await journeyRes.json().catch(() => ({}));
    const rawMessage = (err as Record<string, string>).message ?? "";
    const userMessage = rawMessage.includes("Cannot read") || rawMessage.includes("Internal")
      ? "Une erreur technique est survenue. Veuillez réessayer."
      : rawMessage || "Erreur lors du démarrage du parcours.";
    return { error: userMessage, ...errorData };
  }
  const journey = (await journeyRes.json()) as { id: string };
  throw redirect(`/souscrire/${slug}/parcours/${journey.id}`);
}

/* ──────────────────────────────────────────────
   Component — investor type selection only
   ────────────────────────────────────────────── */

export default function DemarrerSouscription({ loaderData, actionData }: Route.ComponentProps) {
  const loaderResult = loaderData as { product: MarketingProduct; slug: string };
  const actionResult = actionData as { error?: string; product?: MarketingProduct; slug?: string } | undefined;
  const product = actionResult?.product ?? loaderResult.product;
  const slug = actionResult?.slug ?? loaderResult.slug;
  const errorMessage = actionResult?.error;

  const [investorType, setInvestorType] = useState("NATURAL");
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="ds4-body">
      <nav className="nav-bar scrolled">
        <a className="nav-logo-text" href="/">Anaxago</a>
      </nav>

      <main style={{ paddingTop: 100 }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "var(--space-xl)" }}>
          <div style={{ textAlign: "center", marginBottom: "var(--space-xl)" }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 300, color: "var(--clr-obsidian)", marginBottom: "var(--space-xs)" }}>
              Souscrire à {product.name}
            </h1>
            <p style={{ fontSize: 15, color: "var(--clr-cashmere)" }}>
              Comment souhaitez-vous investir ?
            </p>
          </div>

          {errorMessage && (
            <div className="form-error" style={{ marginBottom: "var(--space-md)", textAlign: "center" }}>{errorMessage}</div>
          )}

          <form method="post" onSubmit={() => setSubmitting(true)}>
            <input type="hidden" name="investorType" value={investorType} />

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", marginBottom: "var(--space-lg)" }}>
              <label className="choice-card" style={{
                borderColor: investorType === "NATURAL" ? "var(--clr-primary)" : undefined,
                background: investorType === "NATURAL" ? "var(--clr-primary-light)" : undefined,
              }}>
                <input type="radio" name="investorTypeRadio" checked={investorType === "NATURAL"} onChange={() => setInvestorType("NATURAL")} style={{ display: "none" }} />
                <span className="choice-card__radio">
                  {investorType === "NATURAL" && <span className="choice-card__radio-dot" />}
                </span>
                <div style={{ flex: 1 }}>
                  <span className="choice-card__label">Personne physique</span>
                  <span className="choice-card__desc">Investir en tant que particulier</span>
                </div>
              </label>

              <label className="choice-card" style={{
                borderColor: investorType === "LEGAL" ? "var(--clr-primary)" : undefined,
                background: investorType === "LEGAL" ? "var(--clr-primary-light)" : undefined,
              }}>
                <input type="radio" name="investorTypeRadio" checked={investorType === "LEGAL"} onChange={() => setInvestorType("LEGAL")} style={{ display: "none" }} />
                <span className="choice-card__radio">
                  {investorType === "LEGAL" && <span className="choice-card__radio-dot" />}
                </span>
                <div style={{ flex: 1 }}>
                  <span className="choice-card__label">Personne morale</span>
                  <span className="choice-card__desc">Investir au nom d'une société</span>
                </div>
              </label>
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ width: "100%", justifyContent: "center", opacity: submitting ? 0.5 : 1 }}
              disabled={submitting}
            >
              {submitting ? "Création du parcours..." : "Continuer"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: "var(--space-md)" }}>
            <a href={`/souscrire/${slug}`} style={{ fontSize: 14, color: "var(--clr-cashmere)" }}>
              ← Retour au produit
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
