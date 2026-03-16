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

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  OPEN: {
    label: "Ouvert à la souscription",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  COMING_SOON: {
    label: "Prochainement",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  FULLY_SUBSCRIBED: {
    label: "Complet",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
  },
  CLOSED: {
    label: "Clôturé",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  DRAFT: {
    label: "Brouillon",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-500",
  },
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
      content: data.product.shortDescription ?? `Souscrivez au produit ${data.product.name} sur Anaxago`,
    },
  ];
}

export default function SouscrireProduit({ loaderData }: Route.ComponentProps) {
  const { product } = loaderData;
  const status = STATUS_CONFIG[product.status] ?? STATUS_CONFIG.DRAFT;
  const canSubscribe = product.status === "OPEN";

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            Anaxago
          </span>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Hero section */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          {product.imageUrl && (
            <div className="h-64 bg-gray-200 dark:bg-gray-800 overflow-hidden">
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {product.productType && (
                <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/20 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-400">
                  {PRODUCT_TYPE_LABELS[product.productType] ?? product.productType}
                </span>
              )}
              {product.investmentSectors.map((sector) => (
                <span
                  key={sector}
                  className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400"
                >
                  {SECTOR_LABELS[sector] ?? sector}
                </span>
              ))}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">
              {product.name}
            </h1>

            {product.shortDescription && (
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                {product.shortDescription}
              </p>
            )}

            {/* Key metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {product.minimumInvestmentInCents != null && (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Investissement minimum
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(product.minimumInvestmentInCents, product.minimumInvestmentCurrency)}
                  </p>
                </div>
              )}
              {product.recommendedDurationValue != null && product.recommendedDurationUnit != null && (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Durée recommandée
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatDuration(product.recommendedDurationValue, product.recommendedDurationUnit)}
                  </p>
                </div>
              )}
              {product.riskLevel != null && (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Niveau de risque
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {Array.from({ length: 7 }, (_, i) => (
                      <div
                        key={i}
                        className={`h-3 w-3 rounded-full ${
                          i < product.riskLevel!
                            ? "bg-blue-600 dark:bg-blue-500"
                            : "bg-gray-200 dark:bg-gray-700"
                        }`}
                      />
                    ))}
                    <span className="ml-2 text-lg font-semibold text-gray-900 dark:text-white">
                      {product.riskLevel}/7
                    </span>
                  </div>
                </div>
              )}
              {product.targetRegions.length > 0 && (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Zones géographiques
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {product.targetRegions.map((r) => REGION_LABELS[r] ?? r).join(", ")}
                  </p>
                </div>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <div className="prose dark:prose-invert max-w-none mb-8">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            )}

            {/* Advantages / Disadvantages */}
            {(product.keyAdvantages.length > 0 || product.keyDisadvantages.length > 0) && (
              <div className="grid sm:grid-cols-2 gap-6 mb-8">
                {product.keyAdvantages.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      Points forts
                    </h2>
                    <ul className="space-y-2">
                      {product.keyAdvantages.map((adv, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                        >
                          <span className="mt-0.5 flex-shrink-0 h-5 w-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 text-xs">
                            +
                          </span>
                          {adv}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {product.keyDisadvantages.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      Points d'attention
                    </h2>
                    <ul className="space-y-2">
                      {product.keyDisadvantages.map((dis, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                        >
                          <span className="mt-0.5 flex-shrink-0 h-5 w-5 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 text-xs">
                            !
                          </span>
                          {dis}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Cooling off period */}
            {product.coolingOffPeriod != null && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                Délai de rétractation : {product.coolingOffPeriod} jours
              </p>
            )}

            {/* CTA */}
            <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
              {canSubscribe ? (
                <a
                  href={`/souscrire/${product.slug}/demarrer`}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  Souscrire maintenant
                </a>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Ce produit n'est pas ouvert à la souscription pour le moment.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
