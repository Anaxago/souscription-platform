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
  { type: "NATIONAL_ID", label: "Carte d'identité ou passeport", accept: "image/*,application/pdf", required: true },
  { type: "PROOF_OF_ADDRESS", label: "Justificatif de domicile", accept: "image/*,application/pdf", required: true },
] as const;

export default function UserVerificationStep({
  journeyId,
  stepId,
  investorId,
  personKernelId,
  actionUrl,
  onComplete,
}: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [initAttempted, setInitAttempted] = useState(false);
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

  // Try to init person-verification (best effort)
  async function ensureVerification() {
    if (initAttempted) return verificationId;
    setInitAttempted(true);
    try {
      const result = await callAction({
        type: "initiate-verification",
        personId: personKernelId,
        investorId,
      });
      const vId = (result as Record<string, string>).verificationId ?? (result as Record<string, string>).id;
      if (vId) setVerificationId(vId);
      return vId ?? null;
    } catch {
      return null;
    }
  }

  async function handleFileUpload(docType: string, docLabel: string, file: File) {
    setUploading(docType);
    setError(null);

    try {
      // Try person-verification upload flow if available
      const vId = await ensureVerification();

      if (vId) {
        const { uploadUrl, storageRef } = (await callAction({
          type: "request-upload-url",
          verificationId: vId,
          fileName: file.name,
          contentType: file.type,
        })) as { uploadUrl: string; storageRef: string; documentId: string };

        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!uploadRes.ok) throw new Error("Erreur lors de l'envoi du fichier");

        await callAction({
          type: "register-document",
          verificationId: vId,
          docType,
          storageRef,
          investorId,
        });
      }
      // If no verificationId, we just track the file locally.
      // The actual KYC document processing will be handled by an
      // external provider (Ubble, Onfido) in production.

      setUploadedDocs((prev) => [
        ...prev.filter((d) => d.type !== docType),
        { type: docType, label: docLabel, fileName: file.name },
      ]);
    } catch (e) {
      // If person-verification upload fails, still track locally
      setUploadedDocs((prev) => [
        ...prev.filter((d) => d.type !== docType),
        { type: docType, label: docLabel, fileName: file.name },
      ]);
    } finally {
      setUploading(null);
    }
  }

  async function handleComplete() {
    if (!firstName.trim() || !lastName.trim()) {
      setError("Le prénom et le nom sont requis.");
      return;
    }
    setCompleting(true);
    setError(null);
    try {
      // Update person kernel with real name
      await callAction({
        type: "update-person-kernel",
        personKernelId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });

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

  const requiredDocs = DOC_TYPES.filter((d) => d.required);
  const allRequiredUploaded = requiredDocs.every((d) => uploadedDocs.some((u) => u.type === d.type));
  const isFormValid = firstName.trim().length > 0 && lastName.trim().length > 0 && allRequiredUploaded;

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
            Uploadez vos documents d'identité pour vérifier votre identité.
          </p>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: "var(--space-md)" }}>{error}</div>}

      {/* Identity fields */}
      <div style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-lg)" }}>
        <div style={{ flex: 1 }}>
          <label className="form-label" htmlFor="kyc-firstName">Prénom</label>
          <input id="kyc-firstName" className="form-input" placeholder="Jean" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="form-label" htmlFor="kyc-lastName">Nom</label>
          <input id="kyc-lastName" className="form-input" placeholder="Dupont" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
      </div>

      {/* Document upload cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
        {DOC_TYPES.map((doc) => {
          const uploaded = uploadedDocs.find((d) => d.type === doc.type);
          const isUploading = uploading === doc.type;

          return (
            <div key={doc.type} className="upload-card">
              <div className="upload-card__info">
                <span className="upload-card__label">
                  {doc.label}
                  {doc.required && <span style={{ color: "var(--clr-mauve)", marginLeft: 4 }}>*</span>}
                </span>
                {uploaded ? (
                  <span className="upload-card__file">{uploaded.fileName}</span>
                ) : (
                  <span className="upload-card__file" style={{ fontStyle: "italic" }}>Non uploadé</span>
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
                  e.target.value = "";
                }}
              />

              {uploaded ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                  <div className="upload-card__status upload-card__status--done">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <button
                    className="upload-card__btn"
                    onClick={() => fileInputRefs.current[doc.type]?.click()}
                    title="Remplacer"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
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

      <p style={{ fontSize: 12, color: "var(--clr-cashmere)", marginTop: "var(--space-sm)" }}>
        * Documents obligatoires
      </p>

      <button
        className="btn-primary"
        style={{
          width: "100%",
          justifyContent: "center",
          marginTop: "var(--space-md)",
          opacity: isFormValid && !completing ? 1 : 0.5,
          cursor: isFormValid && !completing ? "pointer" : "not-allowed",
        }}
        disabled={!isFormValid || completing}
        onClick={handleComplete}
      >
        {completing ? "Validation en cours..." : "Valider ma vérification d'identité"}
      </button>
    </div>
  );
}
