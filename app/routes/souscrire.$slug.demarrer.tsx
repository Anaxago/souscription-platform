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

interface LegalEntityKernel {
  id: string;
  name: string;
  siret: string;
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
   Loader — fetch product + existing legal entity kernels
   ────────────────────────────────────────────── */

export async function loader({ params }: Route.LoaderArgs) {
  const { slug } = params;

  const productRes = await api(`/marketing-products/by-slug/${slug}`);
  if (!productRes.ok) throw data(null, { status: 404 });
  const product = (await productRes.json()) as MarketingProduct;
  if (product.status !== "OPEN") throw data(null, { status: 403 });

  // Fetch existing legal entity kernels
  let legalEntityKernels: LegalEntityKernel[] = [];
  try {
    const res = await api("/legal-entity-kernels?pageSize=100");
    if (res.ok) {
      const body = (await res.json()) as { data: LegalEntityKernel[] };
      legalEntityKernels = body.data ?? [];
    }
  } catch {
    // Non-blocking
  }

  return { product, slug, legalEntityKernels };
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
  const leKernelMode = formData.get("leKernelMode") as string; // "existing" or "new"
  const existingLeKernelId = formData.get("existingLeKernelId") as string;
  const newCompanyName = formData.get("newCompanyName") as string;
  const newCompanySiret = formData.get("newCompanySiret") as string;

  const productRes = await api(`/marketing-products/by-slug/${slug}`);
  if (!productRes.ok) throw data(null, { status: 404 });
  const product = (await productRes.json()) as MarketingProduct;

  // Fetch kernels for re-render on error
  let legalEntityKernels: LegalEntityKernel[] = [];
  try {
    const res = await api("/legal-entity-kernels?pageSize=100");
    if (res.ok) {
      const body = (await res.json()) as { data: LegalEntityKernel[] };
      legalEntityKernels = body.data ?? [];
    }
  } catch { /* */ }

  const errorData = { product, slug, legalEntityKernels };

  if (investorType === "LEGAL") {
    // ── Legal entity flow ──
    // 1. PersonKernel for operator
    const kernelRes = await api("/person-kernels", {
      method: "POST",
      body: JSON.stringify({ firstName: "Représentant", lastName: "Légal" }),
    });
    if (!kernelRes.ok) return { error: "Erreur lors de la création du profil opérateur.", ...errorData };
    const kernel = (await kernelRes.json()) as { id: string };

    // 2. Get or create LegalEntityKernel
    let leKernelId: string;
    if (leKernelMode === "existing" && existingLeKernelId) {
      leKernelId = existingLeKernelId;
    } else {
      if (!newCompanyName?.trim() || !newCompanySiret?.trim()) {
        return { error: "Veuillez renseigner le nom et le SIRET de la société.", ...errorData };
      }
      const leKernelRes = await api("/legal-entity-kernels", {
        method: "POST",
        body: JSON.stringify({ name: newCompanyName.trim(), siret: newCompanySiret.trim() }),
      });
      if (!leKernelRes.ok) {
        const err = await leKernelRes.json().catch(() => ({}));
        const msg = (err as Record<string, string>).message ?? `Erreur ${leKernelRes.status}`;
        return { error: `Erreur création société : ${msg}`, ...errorData };
      }
      const leKernel = (await leKernelRes.json()) as { id: string };
      leKernelId = leKernel.id;
    }

    // 3. Create LegalEntityInvestor
    const investorRes = await api("/legal-entity-investors", {
      method: "POST",
      body: JSON.stringify({ legalEntityKernelId: leKernelId, operatedBy: kernel.id }),
    });
    if (!investorRes.ok) {
      const err = await investorRes.json().catch(() => ({}));
      const msg = (err as Record<string, string>).message ?? `Erreur ${investorRes.status}`;
      return { error: `Erreur création investisseur : ${msg}`, ...errorData };
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

  // ── Individual flow (default) ──
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
   Component — investor type + legal entity selection
   ────────────────────────────────────────────── */

export default function DemarrerSouscription({ loaderData, actionData }: Route.ComponentProps) {
  const loaderResult = loaderData as { product: MarketingProduct; slug: string; legalEntityKernels: LegalEntityKernel[] };
  const actionResult = actionData as { error?: string; product?: MarketingProduct; slug?: string; legalEntityKernels?: LegalEntityKernel[] } | undefined;
  const product = actionResult?.product ?? loaderResult.product;
  const slug = actionResult?.slug ?? loaderResult.slug;
  const legalEntityKernels = actionResult?.legalEntityKernels ?? loaderResult.legalEntityKernels;
  const errorMessage = actionResult?.error;

  const [investorType, setInvestorType] = useState("NATURAL");
  const [leKernelMode, setLeKernelMode] = useState(legalEntityKernels.length > 0 ? "existing" : "new");
  const [selectedLeKernelId, setSelectedLeKernelId] = useState(legalEntityKernels[0]?.id ?? "");
  const [newName, setNewName] = useState("");
  const [newSiret, setNewSiret] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isLegal = investorType === "LEGAL";
  const isNewMode = leKernelMode === "new";
  const canSubmit = !isLegal || (isNewMode ? newName.trim() && newSiret.trim() : selectedLeKernelId);

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
            <input type="hidden" name="leKernelMode" value={leKernelMode} />
            <input type="hidden" name="existingLeKernelId" value={selectedLeKernelId} />
            <input type="hidden" name="newCompanyName" value={newName} />
            <input type="hidden" name="newCompanySiret" value={newSiret} />

            {/* ── Investor type choice ── */}
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

            {/* ── Legal entity selection (only when LEGAL) ── */}
            {isLegal && (
              <div style={{ marginBottom: "var(--space-lg)", display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {/* Mode toggle */}
                <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                  {legalEntityKernels.length > 0 && (
                    <button type="button" className="choice-card" style={{
                      flex: 1, cursor: "pointer", textAlign: "center",
                      borderColor: !isNewMode ? "var(--clr-primary)" : undefined,
                      background: !isNewMode ? "var(--clr-primary-light)" : undefined,
                    }} onClick={() => setLeKernelMode("existing")}>
                      <span className="choice-card__label">Société existante</span>
                    </button>
                  )}
                  <button type="button" className="choice-card" style={{
                    flex: 1, cursor: "pointer", textAlign: "center",
                    borderColor: isNewMode ? "var(--clr-primary)" : undefined,
                    background: isNewMode ? "var(--clr-primary-light)" : undefined,
                  }} onClick={() => setLeKernelMode("new")}>
                    <span className="choice-card__label">Nouvelle société</span>
                  </button>
                </div>

                {/* Existing: select from list */}
                {!isNewMode && legalEntityKernels.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                    {legalEntityKernels.map((le) => (
                      <label key={le.id} className="choice-card" style={{
                        borderColor: selectedLeKernelId === le.id ? "var(--clr-primary)" : undefined,
                        background: selectedLeKernelId === le.id ? "var(--clr-primary-light)" : undefined,
                      }}>
                        <input type="radio" name="leKernelRadio" checked={selectedLeKernelId === le.id} onChange={() => setSelectedLeKernelId(le.id)} style={{ display: "none" }} />
                        <span className="choice-card__radio">
                          {selectedLeKernelId === le.id && <span className="choice-card__radio-dot" />}
                        </span>
                        <div style={{ flex: 1 }}>
                          <span className="choice-card__label">{le.name}</span>
                          <span className="choice-card__desc">SIRET : {le.siret}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {/* New: name + SIRET fields */}
                {isNewMode && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                    <div>
                      <label className="form-label" htmlFor="new-company-name">Nom de la société *</label>
                      <input id="new-company-name" className="form-input" placeholder="Ma Société SAS" value={newName} onChange={(e) => setNewName(e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="new-company-siret">SIRET *</label>
                      <input id="new-company-siret" className="form-input" placeholder="123 456 789 00012" maxLength={14} value={newSiret} onChange={(e) => setNewSiret(e.target.value.replace(/\s/g, ""))} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              style={{ width: "100%", justifyContent: "center", opacity: canSubmit && !submitting ? 1 : 0.5 }}
              disabled={!canSubmit || submitting}
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
