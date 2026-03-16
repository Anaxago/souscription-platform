import type { Route } from "./+types/catalogue";
import { api } from "~/lib/api.server";

interface MarketingProduct {
  id: string;
  name: string;
  slug: string;
  productType: string | null;
  holdingCategory: string | null;
  marketingCategory: "PRODUCT" | "HOLDING_TYPE";
  shortDescription: string | null;
  imageUrl: string | null;
  investmentSectors: string[];
  status: "DRAFT" | "COMING_SOON" | "OPEN" | "FULLY_SUBSCRIBED" | "CLOSED";
  accessLevel: string;
  minimumInvestmentInCents: number | null;
  minimumInvestmentCurrency: string;
  riskLevel: number | null;
}

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  SCPI: "SCPI",
  OPCI: "OPCI",
  SCI: "SCI",
  PE: "Private Equity",
  STRUCTURED: "Produit structuré",
  CROWDFUNDING: "Crowdfunding",
  OBLIGATIONS: "Obligations",
  ACTIONS: "Actions",
  ETF: "ETF",
  MONETAIRE: "Monétaire",
};

const HOLDING_LABELS: Record<string, string> = {
  AV: "Assurance-vie",
  PER: "PER",
  CTO: "Compte-titres",
  PEA: "PEA",
};

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

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  OPEN: { label: "Ouvert", className: "catalogue-badge--open" },
  COMING_SOON: { label: "Prochainement", className: "catalogue-badge--soon" },
  FULLY_SUBSCRIBED: { label: "Complet", className: "catalogue-badge--full" },
  CLOSED: { label: "Clôturé", className: "catalogue-badge--closed" },
  DRAFT: { label: "Brouillon", className: "catalogue-badge--draft" },
};

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

function toDirectImageUrl(url: string): string {
  const match = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (match) {
    return `https://lh3.googleusercontent.com/d/${match[1]}=w600`;
  }
  return url;
}

export async function loader() {
  const response = await api("/marketing-products?pageSize=50");
  if (!response.ok) {
    return { products: [] };
  }
  const result = (await response.json()) as { data: MarketingProduct[] };
  // Show only non-draft products
  const products = (result.data ?? []).filter((p) => p.status !== "DRAFT");
  return { products };
}

export function meta() {
  return [
    { title: "Catalogue — Investissements — Anaxago" },
    { name: "description", content: "Découvrez nos opportunités d'investissement : SCPI, produits structurés, assurance-vie et plus." },
  ];
}

export default function Catalogue({ loaderData }: Route.ComponentProps) {
  const { products } = loaderData;

  return (
    <div className="ds4-body">
      <nav className="nav-bar scrolled">
        <a className="nav-logo-text" href="/">Anaxago</a>
      </nav>

      {/* Hero */}
      <section className="catalogue-hero">
        <div className="catalogue-hero__inner">
          <span className="catalogue-hero__eyebrow">Catalogue d'investissement</span>
          <h1 className="catalogue-hero__title">
            Nos opportunités<br />d'investissement
          </h1>
          <p className="catalogue-hero__desc">
            Accédez à des produits d'investissement sélectionnés par nos experts :
            assurance-vie, produits structurés, SCPI et plus.
          </p>
        </div>
      </section>

      {/* Products grid */}
      <section className="catalogue-section">
        <div className="catalogue-grid">
          {products.length === 0 && (
            <p style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--clr-cashmere)", padding: "var(--space-2xl)" }}>
              Aucun produit disponible pour le moment.
            </p>
          )}
          {products.map((product) => {
            const status = STATUS_CONFIG[product.status] ?? STATUS_CONFIG.DRAFT;
            const typeLabel = product.productType
              ? PRODUCT_TYPE_LABELS[product.productType] ?? product.productType
              : product.holdingCategory
                ? HOLDING_LABELS[product.holdingCategory] ?? product.holdingCategory
                : null;

            return (
              <a key={product.id} href={`/souscrire/${product.slug}`} className="catalogue-card">
                {/* Image */}
                <div className="catalogue-card__image">
                  {product.imageUrl ? (
                    <img src={toDirectImageUrl(product.imageUrl)} alt={product.name} />
                  ) : (
                    <div className="catalogue-card__image-placeholder">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--clr-stroke-dark)" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                  )}
                  <span className={`catalogue-badge ${status.className}`}>{status.label}</span>
                </div>

                {/* Content */}
                <div className="catalogue-card__body">
                  {/* Type tag */}
                  <div className="catalogue-card__tags">
                    {typeLabel && <span className="tag">{typeLabel}</span>}
                    {product.investmentSectors.slice(0, 2).map((s) => (
                      <span key={s} className="tag">{SECTOR_LABELS[s] ?? s}</span>
                    ))}
                  </div>

                  <h2 className="catalogue-card__name">{product.name}</h2>

                  {product.shortDescription && (
                    <p className="catalogue-card__desc">{product.shortDescription}</p>
                  )}

                  {/* Footer */}
                  <div className="catalogue-card__footer">
                    {product.minimumInvestmentInCents != null && (
                      <div className="catalogue-card__stat">
                        <span className="catalogue-card__stat-label">Min.</span>
                        <span className="catalogue-card__stat-value">
                          {formatCurrency(product.minimumInvestmentInCents, product.minimumInvestmentCurrency)}
                        </span>
                      </div>
                    )}
                    <span className="catalogue-card__cta">
                      Découvrir →
                    </span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
}
