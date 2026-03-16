import { useState, useRef } from "react";

interface Props {
  journeyId: string;
  stepId: string;
  investorId: string;
  personKernelId: string;
  actionUrl: string;
  onComplete: () => void;
}

interface UploadedDoc {
  type: string;
  label: string;
  fileName: string;
}

const DOC_TYPES = [
  { type: "PASSPORT", label: "Passeport", accept: "image/*,application/pdf" },
  { type: "NATIONAL_ID", label: "Carte d'identité", accept: "image/*,application/pdf" },
  { type: "PROOF_OF_ADDRESS", label: "Justificatif de domicile", accept: "image/*,application/pdf" },
] as const;

export default function UserVerificationStep({
  journeyId,
  stepId,
  investorId,
  personKernelId,
  actionUrl,
  onComplete,
}: Props) {
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
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

  async function initVerification() {
    setError(null);
    try {
      const result = await callAction({
        type: "initiate-verification",
        personId: personKernelId,
        investorId,
      });
      // Response can be ActiveVerificationStatus or PersonVerification
      const vId = (result as Record<string, string>).verificationId ?? (result as Record<string, string>).id;
      setVerificationId(vId);
      setInitialized(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'initiation");
    }
  }

  async function handleFileUpload(docType: string, docLabel: string, file: File) {
    if (!verificationId) return;
    setUploading(docType);
    setError(null);

    try {
      // 1. Get presigned upload URL
      const { uploadUrl, storageRef } = (await callAction({
        type: "request-upload-url",
        verificationId,
        fileName: file.name,
        contentType: file.type,
      })) as { uploadUrl: string; storageRef: string; documentId: string };

      // 2. Upload file directly to storage
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error("Erreur lors de l'envoi du fichier");
      }

      // 3. Register the document
      await callAction({
        type: "register-document",
        verificationId,
        docType,
        storageRef,
        investorId,
      });

      setUploadedDocs((prev) => [...prev.filter((d) => d.type !== docType), { type: docType, label: docLabel, fileName: file.name }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'upload");
    } finally {
      setUploading(null);
    }
  }

  async function handleComplete() {
    setCompleting(true);
    setError(null);
    try {
      await callAction({
        type: "complete-verification",
        journeyId,
        stepId,
      });
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la validation");
    } finally {
      setCompleting(false);
    }
  }

  const hasRequiredDocs = uploadedDocs.length >= 1;

  // Phase 1: Init verification
  if (!initialized) {
    return (
      <div className="step-panel">
        <div className="step-panel__header">
          <div className="step-panel__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <polyline points="17 11 19 13 23 9" />
            </svg>
          </div>
          <div>
            <h2 className="step-panel__title">Vérification d'identité</h2>
            <p className="step-panel__desc">
              Pour souscrire, nous devons vérifier votre identité. Préparez une pièce d'identité
              et un justificatif de domicile.
            </p>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={initVerification}>
          Commencer la vérification
        </button>
      </div>
    );
  }

  // Phase 2: Upload documents
  return (
    <div className="step-panel">
      <div className="step-panel__header">
        <div className="step-panel__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <polyline points="17 11 19 13 23 9" />
          </svg>
        </div>
        <div>
          <h2 className="step-panel__title">Documents d'identité</h2>
          <p className="step-panel__desc">
            Uploadez au moins une pièce d'identité pour continuer.
          </p>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: "var(--space-md)" }}>{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
        {DOC_TYPES.map((doc) => {
          const uploaded = uploadedDocs.find((d) => d.type === doc.type);
          const isUploading = uploading === doc.type;

          return (
            <div key={doc.type} className="upload-card">
              <div className="upload-card__info">
                <span className="upload-card__label">{doc.label}</span>
                {uploaded && (
                  <span className="upload-card__file">{uploaded.fileName}</span>
                )}
              </div>

              <input
                type="file"
                accept={doc.accept}
                style={{ display: "none" }}
                ref={(el) => { fileInputRefs.current[doc.type] = el; }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(doc.type, doc.label, file);
                }}
              />

              {uploaded ? (
                <div className="upload-card__status upload-card__status--done">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              ) : (
                <button
                  className="upload-card__btn"
                  disabled={isUploading}
                  onClick={() => fileInputRefs.current[doc.type]?.click()}
                >
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
        style={{
          width: "100%",
          justifyContent: "center",
          marginTop: "var(--space-lg)",
          opacity: hasRequiredDocs && !completing ? 1 : 0.5,
          cursor: hasRequiredDocs && !completing ? "pointer" : "not-allowed",
        }}
        disabled={!hasRequiredDocs || completing}
        onClick={handleComplete}
      >
        {completing ? "Validation en cours..." : "Valider la vérification"}
      </button>
    </div>
  );
}
