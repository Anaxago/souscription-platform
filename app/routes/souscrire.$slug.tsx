import { useEffect } from "react";
import { data } from "react-router";
import type { Route } from "./+types/souscrire.$slug";
import { api } from "~/lib/api.server";

interface MarketingProduct {
  id: string;
  name: string;
  slug: string;
  productType: string | null;
  holdingCategory: string | null;
  marketingCategory: "PRODUCT" | "HOLDING_TYPE";
  shortDescription: string | null;
  description: string | null;
  imageUrl: string | null;
  keyAdvantages: string[];
  keyDisadvantages: string[];
  investmentSectors: string[];
  targetRegions: string[];
  status: "DRAFT" | "COMING_SOON" | "OPEN" | "FULLY_SUBSCRIBED" | "CLOSED";
  accessLevel: "PUBLIC" | "PRIVATE" | "VIP";
  minimumInvestmentInCents: number | null;
  minimumInvestmentCurrency: string;
  recommendedDurationValue: number | null;
  recommendedDurationUnit: string | null;
  riskLevel: number | null;
  coolingOffPeriod: number | null;
}

const SECTOR_LABELS: Record<string, string> = {
  REAL_ESTATE: "Immobilier",
  PRIVATE_EQUITY: "Private Equity",
  INFRASTRUCTURE: "Infrastructure",
  HEALTH: "Santé",
  TECHNOLOGY: "Technologie",
  ENERGY: "Énergie",
  AGRICULTURE: "Agriculture",
  MIXED: "Diversifié",
  OTHER: "Autre",
};

const REGION_LABELS: Record<string, string> = {
  FRANCE: "France",
  EUROPE: "Europe",
  NORTH_AMERICA: "Amérique du Nord",
  ASIA_PACIFIC: "Asie-Pacifique",
  GLOBAL: "Mondial",
  EMERGING_MARKETS: "Marchés émergents",
  OTHER: "Autre",
};

const HOLDING_CATEGORY_LABELS: Record<string, string> = {
  AV: "Assurance-vie",
  PER: "PER",
  CTO: "Compte-titres",
  PEA: "PEA",
  PEA_PME: "PEA-PME",
  DIRECT_OWNERSHIP: "Détention directe",
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  OPEN: { label: "Ouvert à la souscription", className: "badge--open" },
  COMING_SOON: { label: "Prochainement", className: "badge--soon" },
  FULLY_SUBSCRIBED: { label: "Complet", className: "badge--full" },
  CLOSED: { label: "Clôturé", className: "badge--closed" },
  DRAFT: { label: "Brouillon", className: "badge--draft" },
};

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDuration(value: number, unit: string): string {
  const unitLabels: Record<string, string> = {
    YEARS: value > 1 ? "ans" : "an",
    MONTHS: "mois",
    DAYS: value > 1 ? "jours" : "jour",
  };
  return `${value} ${unitLabels[unit] ?? unit.toLowerCase()}`;
}

/**
 * The API sometimes returns advantages/disadvantages as a single concatenated
 * string with leading/trailing dashes. Split on ". " to get individual items.
 */
function parseListItems(items: string[]): string[] {
  return items
    .flatMap((item) => item.split(/\.\s+/))
    .map((s) => s.replace(/^-+/, "").replace(/-+$/, "").trim())
    .filter((s) => s.length > 0)
    .map((s) => (s.endsWith(".") ? s : `${s}.`));
}

export async function loader({ params }: Route.LoaderArgs) {
  const { slug } = params;

  const response = await api(`/marketing-products/by-slug/${slug}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw data(null, { status: 404 });
    }
    throw data(null, { status: response.status });
  }

  const product = (await response.json()) as MarketingProduct;
  return { product };
}

export function meta({ data }: Route.MetaArgs) {
  if (!data) {
    return [{ title: "Produit introuvable — Anaxago" }];
  }
  return [
    { title: `${data.product.name} — Souscrire — Anaxago` },
    {
      name: "description",
      content:
        data.product.shortDescription ??
        `Souscrivez au produit ${data.product.name} sur Anaxago`,
    },
  ];
}

export default function SouscrireProduit({ loaderData }: Route.ComponentProps) {
  const { product } = loaderData;
  const status = STATUS_BADGE[product.status] ?? STATUS_BADGE.DRAFT;
  const canSubscribe = product.status === "OPEN";
  const advantages = parseListItems(product.keyAdvantages);
  const disadvantages = parseListItems(product.keyDisadvantages);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.1 },
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="ds4-body">
      {/* ── Navbar ── */}
      <NavBar />

      {/* ── Hero: Product header ── */}
      <section className="section-light" style={{ paddingTop: 96 }}>
        <div className="section-inner" data-reveal>
          <span className={`badge ${status.className}`}>{status.label}</span>

          <div className="fund-card__tags" style={{ margin: "var(--space-md) 0" }}>
            {product.investmentSectors.map((sector) => (
              <span key={sector} className="tag">
                {SECTOR_LABELS[sector] ?? sector}
              </span>
            ))}
          </div>

          <h1 className="text-h1">{product.name}</h1>

          {product.shortDescription && (
            <p
              style={{
                fontSize: 17,
                color: "var(--clr-cashmere)",
                maxWidth: 640,
                marginTop: "var(--space-md)",
              }}
            >
              {product.shortDescription}
            </p>
          )}
        </div>
      </section>

      {/* ── KV Grid: Key metrics ── */}
      <section className="section-white">
        <div className="container-ds4" data-reveal data-reveal-delay="1">
          <div className="kv-grid">
            {product.minimumInvestmentInCents != null && (
              <div className="kv-item">
                <span className="kv-item__key">Investissement minimum</span>
                <span className="kv-item__value">
                  {formatCurrency(product.minimumInvestmentInCents, product.minimumInvestmentCurrency)}
                </span>
              </div>
            )}
            {product.targetRegions.length > 0 && (
              <div className="kv-item">
                <span className="kv-item__key">Zones géographiques</span>
                <span className="kv-item__value">
                  {product.targetRegions.map((r) => REGION_LABELS[r] ?? r).join(", ")}
                </span>
              </div>
            )}
            {product.holdingCategory && (
              <div className="kv-item">
                <span className="kv-item__key">Type de contrat</span>
                <span className="kv-item__value">
                  {HOLDING_CATEGORY_LABELS[product.holdingCategory] ?? product.holdingCategory}
                </span>
              </div>
            )}
            {product.recommendedDurationValue != null && product.recommendedDurationUnit != null && (
              <div className="kv-item">
                <span className="kv-item__key">Durée recommandée</span>
                <span className="kv-item__value">
                  {formatDuration(product.recommendedDurationValue, product.recommendedDurationUnit)}
                </span>
              </div>
            )}
            {product.riskLevel != null && (
              <div className="kv-item">
                <span className="kv-item__key">Niveau de risque</span>
                <span className="kv-item__value">{product.riskLevel} / 7</span>
              </div>
            )}
            {product.coolingOffPeriod != null && (
              <div className="kv-item">
                <span className="kv-item__key">Délai de rétractation</span>
                <span className="kv-item__value">{product.coolingOffPeriod} jours</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Description ── */}
      {product.description && (
        <section className="section-light">
          <div className="section-inner" data-reveal data-reveal-delay="2">
            <p
              style={{
                fontSize: 17,
                lineHeight: 1.6,
                color: "var(--clr-obsidian)",
                maxWidth: 800,
              }}
            >
              {product.description}
            </p>
          </div>
        </section>
      )}

      {/* ── Points forts / Points d'attention ── */}
      {(advantages.length > 0 || disadvantages.length > 0) && (
        <section className="section-light">
          <div
            className="container-ds4"
            style={{ paddingTop: "var(--space-xl)", paddingBottom: "var(--space-xl)" }}
            data-reveal
            data-reveal-delay="3"
          >
            <div className="info-grid">
              {advantages.length > 0 && (
                <div className="info-grid__col">
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="9 12 11 14 15 10" />
                    </svg>
                    <span className="text-eyebrow" style={{ marginBottom: 0 }}>
                      Points forts
                    </span>
                  </div>
                  <ul className="info-list">
                    {advantages.map((item, i) => (
                      <li key={i} className="info-list-item">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {disadvantages.length > 0 && (
                <div className="info-grid__col">
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--clr-mauve)" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span className="text-eyebrow" style={{ marginBottom: 0, color: "var(--clr-mauve)" }}>
                      Points d'attention
                    </span>
                  </div>
                  <ul className="info-list">
                    {disadvantages.map((item, i) => (
                      <li key={i} className="info-list-item">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      <section className="section-dark">
        <div className="cta-dark">
          <div className="cta-dark-text">
            <span className="text-eyebrow">Prêt à investir ?</span>
            <h2 className="section-title" style={{ color: "var(--clr-off-white)" }}>
              {canSubscribe
                ? `Souscrivez à ${product.name}${product.minimumInvestmentInCents != null ? ` dès ${formatCurrency(product.minimumInvestmentInCents, product.minimumInvestmentCurrency)}` : ""}.`
                : "Ce produit n'est pas ouvert à la souscription pour le moment."}
            </h2>
          </div>
          <div className="cta-dark-actions">
            {canSubscribe ? (
              <a href={`/souscrire/${product.slug}/demarrer`} className="btn-primary">
                Souscrire maintenant
              </a>
            ) : (
              <span
                className="btn-primary"
                style={{ opacity: 0.5, cursor: "not-allowed", pointerEvents: "none" }}
              >
                Souscription fermée
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Navbar component with scroll behavior
   ────────────────────────────────────────────── */
function NavBar() {
  useEffect(() => {
    const nav = document.getElementById("ds4-nav");
    if (!nav) return;

    function onScroll() {
      if (window.scrollY > 40) {
        nav!.classList.add("scrolled");
      } else {
        nav!.classList.remove("scrolled");
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav id="ds4-nav" className="nav-bar">
      <a className="nav-logo-text" href="/">
        Anaxago
      </a>
    </nav>
  );
}
