import { useState, useRef } from "react";

interface Props {
  journeyId: string;
  stepId: string;
  config: { requiredDocumentTypes: string[] | null } | null;
  state: { uploadedDocuments: UploadedDoc[] } | null;
  actionUrl: string;
  onComplete: () => void;
}

interface UploadedDoc {
  documentId: string;
  documentType: string;
  fileName: string;
  uploadedAt: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  RIB: "RIB (relevé d'identité bancaire)",
  BULLETIN: "Bulletin de souscription",
  TAX_NOTICE: "Avis d'imposition",
  PROOF_OF_ADDRESS: "Justificatif de domicile",
  PROOF_OF_INCOME: "Justificatif de revenus",
  WEALTH_DECLARATION: "Déclaration de patrimoine",
  OTHER: "Autre document",
};

const DEFAULT_DOC_TYPES = ["RIB", "PROOF_OF_ADDRESS"];

export default function DocumentUploadStep({
  journeyId,
  stepId,
  config,
  state,
  actionUrl,
  onComplete,
}: Props) {
  const requiredTypes = config?.requiredDocumentTypes ?? DEFAULT_DOC_TYPES;
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>(state?.uploadedDocuments ?? []);
  const [uploading, setUploading] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function callAction(payload: Record<string, unknown>) {
    const res = await fetch(actionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as Record<string, string>).error ?? `Erreur ${res.status}`);
    }
    return res.json();
  }

  async function handleUpload(docType: string, file: File) {
    setUploading(docType);
    setError(null);
    try {
      await callAction({
        type: "upload-journey-document",
        journeyId,
        stepId,
        documentType: docType,
        documentId: `${docType}-${Date.now()}`,
        fileName: file.name,
      });

      setUploadedDocs((prev) => [
        ...prev.filter((d) => d.documentType !== docType),
        { documentId: `${docType}-${Date.now()}`, documentType: docType, fileName: file.name, uploadedAt: new Date().toISOString() },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur upload");
    } finally {
      setUploading(null);
    }
  }

  async function handleComplete() {
    setCompleting(true);
    setError(null);
    try {
      await callAction({ type: "complete", journeyId, stepId });
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setCompleting(false);
    }
  }

  const allUploaded = requiredTypes.every((t) => uploadedDocs.some((d) => d.documentType === t));

  return (
    <div className="step-panel">
      <div className="step-panel__header">
        <div className="step-panel__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <polyline points="9 15 12 12 15 15" />
          </svg>
        </div>
        <div>
          <h2 className="step-panel__title">Documents justificatifs</h2>
          <p className="step-panel__desc">
            Uploadez les documents nécessaires pour finaliser votre souscription.
          </p>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: "var(--space-md)" }}>{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
        {requiredTypes.map((docType) => {
          const uploaded = uploadedDocs.find((d) => d.documentType === docType);
          const isUploading = uploading === docType;
          const label = DOC_TYPE_LABELS[docType] ?? docType;

          return (
            <div key={docType} className="upload-card">
              <div className="upload-card__info">
                <span className="upload-card__label">{label}</span>
                {uploaded && <span className="upload-card__file">{uploaded.fileName}</span>}
              </div>

              <input
                type="file"
                accept="image/*,application/pdf"
                style={{ display: "none" }}
                ref={(el) => { fileInputRefs.current[docType] = el; }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(docType, file);
                }}
              />

              {uploaded ? (
                <div className="upload-card__status upload-card__status--done">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              ) : (
                <button className="upload-card__btn" disabled={isUploading} onClick={() => fileInputRefs.current[docType]?.click()}>
                  {isUploading ? (
                    <span className="document-card__spinner" />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button
        className="btn-primary"
        style={{ width: "100%", justifyContent: "center", marginTop: "var(--space-lg)", opacity: allUploaded && !completing ? 1 : 0.5 }}
        disabled={!allUploaded || completing}
        onClick={handleComplete}
      >
        {completing ? "Validation..." : "Valider les documents"}
      </button>
    </div>
  );
}
