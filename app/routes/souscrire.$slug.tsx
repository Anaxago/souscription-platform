import { useEffect, useState } from "react";
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
  videoUrl: string | null;
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
  documents: MarketingDocument[];
}

interface MarketingDocument {
  id: string;
  type: "BROCHURE" | "PRODUCT_SHEET" | "INVESTOR_PRESENTATION" | "OTHER";
  name: string;
  storageRef: string;
  mimeType: string;
  uploadedAt: string;
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

const DOC_TYPE_LABELS: Record<string, string> = {
  BROCHURE: "Brochure commerciale",
  PRODUCT_SHEET: "Annexe financière",
  INVESTOR_PRESENTATION: "Présentation investisseur",
  OTHER: "Document d'information",
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
 * Convert a Google Drive sharing URL to a direct image URL.
 * Uses lh3.googleusercontent.com which serves images directly without redirects.
 * Non-Drive URLs are returned as-is.
 */
function toDirectImageUrl(url: string): string {
  const match = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (match) {
    return `https://lh3.googleusercontent.com/d/${match[1]}=w1000`;
  }
  return url;
}

/**
 * Extract an embeddable video URL from various sources.
 * Supports: YouTube (watch/short/embed), Google Drive, or direct URLs.
 * Returns null if the URL cannot be embedded.
 */
function toEmbedVideoUrl(url: string): string | null {
  // YouTube: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
  const ytWatch = url.match(/youtube\.com\/watch\?v=([^&]+)/);
  if (ytWatch) return `https://www.youtube.com/embed/${ytWatch[1]}`;

  const ytShort = url.match(/youtu\.be\/([^?]+)/);
  if (ytShort) return `https://www.youtube.com/embed/${ytShort[1]}`;

  const ytEmbed = url.match(/youtube\.com\/embed\/([^?]+)/);
  if (ytEmbed) return url;

  // Google Drive video: drive.google.com/file/d/ID/...
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;

  // Direct video URL (mp4, webm, etc.)
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return url;

  return null;
}

/**
 * Check if a video URL points to a direct file (mp4/webm/ogg) vs an iframe embed.
 */
function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url);
}

/**
 * Parse API advantages/disadvantages into clean sentences.
 * The API sometimes returns a single concatenated string with leading/trailing
 * dashes. Split on ". " and clean up each item as a complete phrase.
 */
function parseListItems(items: string[]): string[] {
  return items
    .flatMap((item) => item.split(/\.\s+/))
    .map((s) => s.replace(/^-+/, "").replace(/-+$/, "").trim())
    .filter((s) => s.length > 0)
    .map((s) => (s.endsWith(".") ? s : `${s}.`));
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
  const ctaHrefNatural = `/souscrire/${product.slug}/demarrer?type=NATURAL`;
  const ctaHrefLegal = `/souscrire/${product.slug}/demarrer?type=LEGAL`;
  const minAmount =
    product.minimumInvestmentInCents != null
      ? formatCurrency(product.minimumInvestmentInCents, product.minimumInvestmentCurrency)
      : null;
  const minAmountNumber =
    product.minimumInvestmentInCents != null
      ? formatAmount(product.minimumInvestmentInCents)
      : null;

  const heroImage = product.imageUrl ? toDirectImageUrl(product.imageUrl) : null;
  const videoEmbed = product.videoUrl ? toEmbedVideoUrl(product.videoUrl) : null;

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
        <div className={`hero-dark__inner${heroImage ? " hero-dark__inner--with-media" : ""}`}>
          <div className="hero-dark__text">
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
              <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                <a href={ctaHrefNatural} className="btn-primary btn-primary--hero">
                  Investir en nom propre
                </a>
                <a href={ctaHrefLegal} className="btn-primary btn-primary--hero" style={{ background: "transparent", border: "1.5px solid #fff", color: "#fff" }}>
                  Investir en société
                </a>
              </div>
            )}
          </div>

        </div>

          {heroImage && (
            <div className="hero-dark__media">
              <div className="hero-dark__media-overlay" />
              <img src={heroImage} alt={product.name} />
            </div>
          )}

        {/* Reassurance band — value/label pairs */}
        <div className="hero-dark__reassurance-wrap">
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
            {/* Tabs */}
            <TabBar
              tabs={[
                { id: "investissement", label: "Investissement" },
                ...(product.documents.length > 0
                  ? [{ id: "documents" as const, label: `Documents (${product.documents.length})` }]
                  : []),
              ]}
              productId={product.id}
              documents={product.documents}
            >
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

            {/* Video section */}
            {videoEmbed && (
              <div className="video-section" data-reveal data-reveal-delay="1">
                <div className="video-section__header">
                  <span className="text-eyebrow" style={{ marginBottom: 0 }}>Présentation</span>
                </div>
                <div className="video-section__player">
                  {isDirectVideoUrl(videoEmbed) ? (
                    <video controls preload="metadata">
                      <source src={videoEmbed} />
                    </video>
                  ) : (
                    <iframe
                      src={videoEmbed}
                      title={product.name}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  )}
                </div>
              </div>
            )}

            {/* Points forts & Points d'attention — side by side cards */}
            {(advantages.length > 0 || disadvantages.length > 0) && (
              <div className="points-grid" data-reveal data-reveal-delay="1">
                {/* Points forts */}
                {advantages.length > 0 && (
                  <div className="points-card points-card--positive">
                    <div className="points-card__header">
                      <svg className="points-card__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      <span className="points-card__title">Points forts</span>
                    </div>
                    <ul className="points-list">
                      {advantages.map((item, i) => (
                        <li key={i} className="points-list__item">
                          <svg viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Points d'attention */}
                {disadvantages.length > 0 && (
                  <div className="points-card points-card--warning">
                    <div className="points-card__header">
                      <svg className="points-card__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span className="points-card__title">Points d'attention</span>
                    </div>
                    <ul className="points-list">
                      {disadvantages.map((item, i) => (
                        <li key={i} className="points-list__item">
                          <svg viewBox="0 0 24 24" fill="none" stroke="var(--clr-mauve)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            </TabBar>
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
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                  <a href={ctaHrefNatural} className="btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                    Investir en nom propre
                  </a>
                  <a href={ctaHrefLegal} className="btn-primary" style={{ width: "100%", justifyContent: "center", background: "transparent", border: "1.5px solid var(--clr-primary)", color: "var(--clr-primary)" }}>
                    Investir en société
                  </a>
                </div>
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
                  Souscription en 5 min
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
          <a href={ctaHrefNatural} className="btn-primary">
            Nom propre
          </a>
          <a href={ctaHrefLegal} className="btn-primary" style={{ background: "transparent", border: "1.5px solid var(--clr-primary)", color: "var(--clr-primary)" }}>
            Société
          </a>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
   TabBar — switches between Investissement and Documents
   ────────────────────────────────────────────── */

interface Tab {
  id: string;
  label: string;
}

function TabBar({
  tabs,
  productId,
  documents,
  children,
}: {
  tabs: Tab[];
  productId: string;
  documents: MarketingDocument[];
  children: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "investissement");

  return (
    <>
      {tabs.length > 1 && (
        <div className="tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tabs__item${activeTab === tab.id ? " tabs__item--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: activeTab === "investissement" ? "block" : "none" }}>
        {children}
      </div>

      <div style={{ display: activeTab === "documents" ? "block" : "none" }}>
        <DocumentsList productId={productId} documents={documents} />
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────
   Documents list
   ────────────────────────────────────────────── */

function DocumentsList({
  productId,
  documents,
}: {
  productId: string;
  documents: MarketingDocument[];
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleDownload(docId: string) {
    setLoadingId(docId);
    try {
      const res = await fetch(
        `/souscrire/documents/${productId}/${docId}`,
      );
      if (!res.ok) throw new Error("Erreur lors du téléchargement");
      const { downloadUrl } = (await res.json()) as { downloadUrl: string };
      window.open(downloadUrl, "_blank");
    } catch {
      alert("Impossible de télécharger le document. Veuillez réessayer.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="documents-list">
      {documents.map((doc) => (
        <div key={doc.id} className="document-card">
          <div className="document-card__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div className="document-card__info">
            <span className="document-card__name">
              {DOC_TYPE_LABELS[doc.type] ?? doc.type}
            </span>
            <span className="document-card__type">PDF</span>
          </div>
          <button
            className="document-card__download"
            onClick={() => handleDownload(doc.id)}
            disabled={loadingId === doc.id}
          >
            {loadingId === doc.id ? (
              <span className="document-card__spinner" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
          </button>
        </div>
      ))}
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
