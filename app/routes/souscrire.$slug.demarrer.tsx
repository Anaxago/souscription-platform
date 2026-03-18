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

function errorPage(message: string, slug: string) {
  return { error: message, slug };
}

/* ──────────────────────────────────────────────
   Loader — creates entities based on ?type= query param and redirects
   ────────────────────────────────────────────── */

export async function loader({ params, request }: Route.LoaderArgs) {
  const { slug } = params;
  const url = new URL(request.url);
  const investorType = url.searchParams.get("type") ?? "NATURAL";

  // Fetch product
  const productRes = await api(`/marketing-products/by-slug/${slug}`);
  if (!productRes.ok) {
    throw data(null, { status: 404 });
  }
  const product = (await productRes.json()) as MarketingProduct;
  if (product.status !== "OPEN") {
    throw data(null, { status: 403 });
  }

  if (investorType === "LEGAL") {
    // ── Legal entity flow ──
    const kernelRes = await api("/person-kernels", {
      method: "POST",
      body: JSON.stringify({ firstName: "Représentant", lastName: "Légal" }),
    });
    if (!kernelRes.ok) return errorPage("Erreur lors de la création du profil opérateur.", slug);
    const kernel = (await kernelRes.json()) as { id: string };

    const leKernelRes = await api("/legal-entity-kernels", {
      method: "POST",
      body: JSON.stringify({ name: "Entreprise", siret: "00000000000000" }),
    });
    if (!leKernelRes.ok) return errorPage("Erreur lors de la création du profil société.", slug);
    const leKernel = (await leKernelRes.json()) as { id: string };

    const investorRes = await api("/legal-entity-investors", {
      method: "POST",
      body: JSON.stringify({ legalEntityKernelId: leKernel.id, operatedBy: kernel.id }),
    });
    if (!investorRes.ok) return errorPage("Erreur lors de la création de l'investisseur.", slug);
    const investor = (await investorRes.json()) as { id: string };

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
      return errorPage(userMessage, slug);
    }
    const journey = (await journeyRes.json()) as { id: string };

    throw redirect(`/souscrire/${slug}/parcours/${journey.id}`);
  }

  // ── Individual flow (default) ──
  const kernelRes = await api("/person-kernels", {
    method: "POST",
    body: JSON.stringify({ firstName: "Investisseur", lastName: "Anonyme" }),
  });
  if (!kernelRes.ok) return errorPage("Erreur lors de la création du profil.", slug);
  const kernel = (await kernelRes.json()) as { id: string };

  const investorRes = await api("/individual-investors", {
    method: "POST",
    body: JSON.stringify({ personKernelId: kernel.id }),
  });
  if (!investorRes.ok) return errorPage("Erreur lors de la création de l'investisseur.", slug);
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
    return errorPage(userMessage, slug);
  }
  const journey = (await journeyRes.json()) as { id: string };

  const verifyRes = await api(`/subscription-journeys/${journey.id}`);
  if (!verifyRes.ok) {
    return errorPage("Le parcours n'est pas accessible. Le template est peut-être mal configuré.", slug);
  }

  throw redirect(`/souscrire/${slug}/parcours/${journey.id}`);
}

export function meta() {
  return [{ title: "Démarrage de la souscription — Anaxago" }];
}

/* ──────────────────────────────────────────────
   Component — only shown if there's an error
   ────────────────────────────────────────────── */

export default function DemarrerSouscription({ loaderData }: Route.ComponentProps) {
  const { error: errorMessage, slug } = loaderData as { error?: string; slug?: string };

  return (
    <div className="ds4-body">
      <nav className="nav-bar scrolled">
        <a className="nav-logo-text" href="/">Anaxago</a>
      </nav>

      <main style={{ paddingTop: 100 }}>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "var(--space-xl)", textAlign: "center" }}>
          {errorMessage ? (
            <>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "rgba(192, 57, 43, 0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto var(--space-md)",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 300, color: "var(--clr-obsidian)", marginBottom: "var(--space-sm)" }}>
                Erreur de démarrage
              </h1>
              <p style={{ fontSize: 15, color: "var(--clr-cashmere)", marginBottom: "var(--space-lg)" }}>
                {errorMessage}
              </p>
              <a href={`/souscrire/${slug ?? ""}`} className="btn-primary" style={{ display: "inline-flex" }}>
                Retour au produit
              </a>
            </>
          ) : (
            <p style={{ color: "var(--clr-cashmere)" }}>
              Création de votre parcours en cours...
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
