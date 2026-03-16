import { useEffect } from "react";
import { data } from "react-router";
import type { Route } from "./+types/souscrire.$slug";
import { api } from "~/lib/api.server";

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */

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

/* ──────────────────────────────────────────────
   Label maps
   ────────────────────────────────────────────── */

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
  AV: "Assurance-vie multisupport",
  PER: "Plan d'Épargne Retraite",
  CTO: "Compte-titres ordinaire",
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

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

/**
 * Format cents to currency string using thin non-breaking space (&#8239;).
 */
function formatCurrency(cents: number, currency: string): string {
  const formatted = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
  // Replace standard/non-breaking spaces with thin non-breaking space
  return formatted.replace(/[\s\u00A0]/g, "\u202F");
}

/**
 * Format amount as number with thin spaces (no currency symbol).
 */
function formatAmount(cents: number): string {
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
  }).format(cents / 100);
  return formatted.replace(/[\s\u00A0]/g, "\u202F");
}

/**
 * Parse API advantages/disadvantages into { title, detail } pairs.
 * Each item starts with a bold keyword before the em dash.
 */
interface ListItem {
  title: string;
  detail: string;
}

function parseListItems(items: string[]): ListItem[] {
  return items
    .flatMap((item) => item.split(/\.\s+/))
    .map((s) => s.replace(/^-+/, "").replace(/-+$/, "").trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      const text = s.endsWith(".") ? s : `${s}.`;
      // Try to extract a bold title: first few words before a natural break
      const match = text.match(
        /^(.+?)\s*(?:\(|,\s|:\s|\.(?:\s|$))/,
      );
      if (match && match[1].length <= 60) {
        const title = match[1];
        const rest = text.slice(title.length).replace(/^\s*[(:,]\s*/, "");
        if (rest.length > 0) {
          return { title, detail: rest };
        }
      }
      return { title: "", detail: text };
    });
}

/* ──────────────────────────────────────────────
   SVG icons
   ────────────────────────────────────────────── */

function CheckIcon() {
  return (
    <svg className="info-list-item__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="info-list-item__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--clr-mauve)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

/* ──────────────────────────────────────────────
   Loader & Meta
   ────────────────────────────────────────────── */

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

/* ──────────────────────────────────────────────
   Page component
   ────────────────────────────────────────────── */

export default function SouscrireProduit({ loaderData }: Route.ComponentProps) {
  const { product } = loaderData;
  const status = STATUS_BADGE[product.status] ?? STATUS_BADGE.DRAFT;
  const canSubscribe = product.status === "OPEN";
  const advantages = parseListItems(product.keyAdvantages);
  const disadvantages = parseListItems(product.keyDisadvantages);
  const ctaHref = `/souscrire/${product.slug}/demarrer`;
  const minAmount =
    product.minimumInvestmentInCents != null
      ? formatCurrency(product.minimumInvestmentInCents, product.minimumInvestmentCurrency)
      : null;
  const minAmountNumber =
    product.minimumInvestmentInCents != null
      ? formatAmount(product.minimumInvestmentInCents)
      : null;

  // Split product name on " - " for multi-line H1
  const nameParts = product.name.split(/\s*-\s*/);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        });
      },
      { threshold: 0.1 },
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="ds4-body">
      <NavBar />

      {/* ━━ HERO DARK ━━ */}
      <section className="hero-dark">
        <div className="hero-dark__inner">
          <span className={`badge ${status.className}`}>{status.label}</span>

          <div className="fund-card__tags" style={{ marginTop: "var(--space-md)" }}>
            {product.investmentSectors.map((sector) => (
              <span key={sector} className="tag">
                {SECTOR_LABELS[sector] ?? sector}
              </span>
            ))}
          </div>

          <h1 className="text-h1">
            {nameParts.map((part, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {part}
              </span>
            ))}
          </h1>

          <p className="hero-tagline">
            Construisez librement votre allocation avec un contrat d'assurance-vie
            multisupport accessible et diversifié.
          </p>

          {canSubscribe && (
            <a href={ctaHref} className="btn-primary btn-primary--hero">
              Souscrire maintenant
            </a>
          )}

          {/* Reassurance band — value/label pairs */}
          <div className="hero-reassurance">
            <div className="hero-reassurance__item">
              <span className="hero-reassurance__value">15 ans</span>
              <span className="hero-reassurance__label">d'expertise</span>
            </div>
            <span className="hero-reassurance__dot" />
            <div className="hero-reassurance__item">
              <span className="hero-reassurance__value">2 500+</span>
              <span className="hero-reassurance__label">investisseurs</span>
            </div>
            <span className="hero-reassurance__dot" />
            <div className="hero-reassurance__item">
              <span className="hero-reassurance__value">CIF</span>
              <span className="hero-reassurance__label">enregistré AMF</span>
            </div>
            <span className="hero-reassurance__dot" />
            <div className="hero-reassurance__item">
              <span className="hero-reassurance__value">Generali Vie</span>
              <span className="hero-reassurance__label">assureur</span>
            </div>
          </div>
        </div>
      </section>

      {/* ━━ BODY: 60/40 SPLIT ━━ */}
      <section className="section-light">
        <div className="split-layout">
          {/* ── Left column (scrollable) ── */}
          <div className="split-layout__main">
            {/* KV Grid — 6 data points */}
            <div data-reveal>
              <div className="kv-grid">
                {minAmount && (
                  <div className="kv-item">
                    <span className="kv-item__key">Investissement min.</span>
                    <span className="kv-item__value">{minAmount}</span>
                  </div>
                )}
                <div className="kv-item">
                  <span className="kv-item__key">Assureur</span>
                  <span className="kv-item__value">Generali Vie</span>
                </div>
                <div className="kv-item">
                  <span className="kv-item__key">Horizon recommandé</span>
                  <span className="kv-item__value">8 ans</span>
                </div>
                {product.holdingCategory && (
                  <div className="kv-item">
                    <span className="kv-item__key">Type</span>
                    <span className="kv-item__value">
                      {HOLDING_CATEGORY_LABELS[product.holdingCategory] ?? product.holdingCategory}
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
                <div className="kv-item">
                  <span className="kv-item__key">Avantage fiscal</span>
                  <span className="kv-item__value">Abattement après 8 ans</span>
                </div>
              </div>
            </div>

            {/* Points forts */}
            {advantages.length > 0 && (
              <div className="info-section" data-reveal data-reveal-delay="1">
                <div className="info-section__header">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                  <span className="text-eyebrow">Points forts</span>
                </div>
                <ul className="info-list">
                  {advantages.map((item, i) => (
                    <li key={i} className="info-list-item">
                      <CheckIcon />
                      <span className="info-list-item__text">
                        {item.title && <strong>{item.title}</strong>}
                        {item.title && " — "}
                        {item.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Points d'attention */}
            {disadvantages.length > 0 && (
              <div className="info-section info-section--attention" data-reveal data-reveal-delay="2">
                <div className="info-section__header">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--clr-mauve)" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span className="text-eyebrow">Points d'attention</span>
                </div>
                <ul className="info-list">
                  {disadvantages.map((item, i) => (
                    <li key={i} className="info-list-item">
                      <AlertIcon />
                      <span className="info-list-item__text">
                        {item.title && <strong>{item.title}</strong>}
                        {item.title && " — "}
                        {item.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* ── Right column (sticky panel) ── */}
          <aside className="split-layout__aside">
            <div className="sticky-panel">
              <span className="sticky-panel__amount-label">À partir de</span>
              <div className="sticky-panel__amount">
                {minAmountNumber ?? "—"}{" "}
                <span className="currency-symbol">€</span>
              </div>

              {canSubscribe ? (
                <a href={ctaHref} className="btn-primary">
                  Souscrire maintenant
                </a>
              ) : (
                <span
                  className="btn-primary"
                  style={{ width: "100%", justifyContent: "center", opacity: 0.5, cursor: "not-allowed", pointerEvents: "none" }}
                >
                  Souscription fermée
                </span>
              )}

              {/* Reassurance items */}
              <div className="sticky-panel__reassurance">
                <div className="sticky-panel__reassurance-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Signature électronique sécurisée
                </div>
                <div className="sticky-panel__reassurance-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Souscription en 15 min
                </div>
                <div className="sticky-panel__reassurance-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  CIF enregistré AMF · Generali Vie
                </div>
              </div>

              {/* Timeline with descriptions */}
              <div className="timeline">
                <div className="timeline__title">Étapes de souscription</div>
                <div className="timeline__steps">
                  <div className="timeline__step">
                    <div className="timeline__dot">1</div>
                    <div className="timeline__line" />
                    <div className="timeline__content">
                      <span className="timeline__label">Profil investisseur</span>
                      <span className="timeline__desc">Questionnaire réglementaire (5 min)</span>
                    </div>
                  </div>
                  <div className="timeline__step">
                    <div className="timeline__dot">2</div>
                    <div className="timeline__line" />
                    <div className="timeline__content">
                      <span className="timeline__label">Documents &amp; justificatifs</span>
                      <span className="timeline__desc">Pièce d'identité et justificatif de domicile</span>
                    </div>
                  </div>
                  <div className="timeline__step">
                    <div className="timeline__dot">3</div>
                    <div className="timeline__content">
                      <span className="timeline__label">Signature &amp; paiement</span>
                      <span className="timeline__desc">Signature électronique et virement sécurisé</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* ━━ MOBILE STICKY BAR ━━ */}
      {canSubscribe && (
        <div className="mobile-sticky-bar">
          <div className="mobile-sticky-bar__info">
            <div className="mobile-sticky-bar__name">{product.name}</div>
            {minAmount && (
              <div className="mobile-sticky-bar__amount">Dès {minAmount}</div>
            )}
          </div>
          <a href={ctaHref} className="btn-primary">
            Souscrire →
          </a>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Navbar with scroll behavior
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
