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

const NATIONALITIES = [
  { code: "FR", label: "Française" },
  { code: "BE", label: "Belge" },
  { code: "CH", label: "Suisse" },
  { code: "LU", label: "Luxembourgeoise" },
  { code: "DE", label: "Allemande" },
  { code: "IT", label: "Italienne" },
  { code: "ES", label: "Espagnole" },
  { code: "GB", label: "Britannique" },
  { code: "US", label: "Américaine" },
  { code: "OTHER", label: "Autre" },
];

export default function UserVerificationStep({
  journeyId,
  stepId,
  investorId,
  personKernelId,
  actionUrl,
  onComplete,
}: Props) {
  // Identity fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [nationality, setNationality] = useState("FR");

  // Address fields
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("FR");

  // Documents
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
      setUploadedDocs((prev) => [
        ...prev.filter((d) => d.type !== docType),
        { type: docType, label: docLabel, fileName: file.name },
      ]);
    } catch {
      setUploadedDocs((prev) => [
        ...prev.filter((d) => d.type !== docType),
        { type: docType, label: docLabel, fileName: file.name },
      ]);
    } finally {
      setUploading(null);
    }
  }

  async function handleComplete() {
    if (!firstName.trim() || !lastName.trim() || !birthDate || !street.trim() || !postalCode.trim() || !city.trim()) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    setCompleting(true);
    setError(null);
    try {
      // Update person kernel name
      await callAction({
        type: "update-person-kernel",
        personKernelId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });

      // Create full Person with identity + address
      await callAction({
        type: "create-person",
        personKernelId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        birthDate,
        nationality,
        address: {
          street: street.trim(),
          city: city.trim(),
          postalCode: postalCode.trim(),
          country,
        },
      });

      // Complete verification
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
  const isFormValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    birthDate.length > 0 &&
    street.trim().length > 0 &&
    postalCode.trim().length > 0 &&
    city.trim().length > 0 &&
    allRequiredUploaded;

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
            Renseignez vos informations personnelles et uploadez vos justificatifs.
          </p>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: "var(--space-md)" }}>{error}</div>}

      {/* ── Identity ── */}
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--clr-obsidian)", marginBottom: "var(--space-md)" }}>
          Identité
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
          <div>
            <label className="form-label" htmlFor="kyc-firstName">Prénom *</label>
            <input id="kyc-firstName" className="form-input" placeholder="Jean" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <label className="form-label" htmlFor="kyc-lastName">Nom *</label>
            <input id="kyc-lastName" className="form-input" placeholder="Dupont" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div>
            <label className="form-label" htmlFor="kyc-birthDate">Date de naissance *</label>
            <input id="kyc-birthDate" className="form-input" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label" htmlFor="kyc-nationality">Nationalité *</label>
            <select id="kyc-nationality" className="form-input" value={nationality} onChange={(e) => setNationality(e.target.value)}>
              {NATIONALITIES.map((n) => (
                <option key={n.code} value={n.code}>{n.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Address ── */}
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--clr-obsidian)", marginBottom: "var(--space-md)" }}>
          Adresse
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          <div>
            <label className="form-label" htmlFor="kyc-street">Adresse *</label>
            <input id="kyc-street" className="form-input" placeholder="12 rue de la Paix" value={street} onChange={(e) => setStreet(e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "var(--space-sm)" }}>
            <div>
              <label className="form-label" htmlFor="kyc-postalCode">Code postal *</label>
              <input id="kyc-postalCode" className="form-input" placeholder="75001" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
            </div>
            <div>
              <label className="form-label" htmlFor="kyc-city">Ville *</label>
              <input id="kyc-city" className="form-input" placeholder="Paris" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="form-label" htmlFor="kyc-country">Pays *</label>
            <select id="kyc-country" className="form-input" value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="FR">France</option>
              <option value="BE">Belgique</option>
              <option value="CH">Suisse</option>
              <option value="LU">Luxembourg</option>
              <option value="DE">Allemagne</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Documents ── */}
      <div style={{ marginBottom: "var(--space-md)" }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--clr-obsidian)", marginBottom: "var(--space-md)" }}>
          Justificatifs
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          {DOC_TYPES.map((doc) => {
            const uploaded = uploadedDocs.find((d) => d.type === doc.type);
            const isUploading = uploading === doc.type;
            return (
              <div key={doc.type} className="upload-card">
                <div className="upload-card__info">
                  <span className="upload-card__label">
                    {doc.label}{doc.required && <span style={{ color: "var(--clr-mauve)", marginLeft: 4 }}>*</span>}
                  </span>
                  {uploaded ? (
                    <span className="upload-card__file">{uploaded.fileName}</span>
                  ) : (
                    <span className="upload-card__file" style={{ fontStyle: "italic" }}>Non uploadé</span>
                  )}
                </div>
                <input type="file" accept={doc.accept} style={{ display: "none" }} ref={(el) => { fileInputRefs.current[doc.type] = el; }} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(doc.type, doc.label, file); e.target.value = ""; }} />
                {uploaded ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                    <div className="upload-card__status upload-card__status--done">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <button className="upload-card__btn" onClick={() => fileInputRefs.current[doc.type]?.click()} title="Remplacer">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                  </div>
                ) : (
                  <button className="upload-card__btn" disabled={isUploading} onClick={() => fileInputRefs.current[doc.type]?.click()}>
                    {isUploading ? <span className="document-card__spinner" /> : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <button
        className="btn-primary"
        style={{
          width: "100%",
          justifyContent: "center",
          marginTop: "var(--space-md)",
          opacity: isFormValid && !completing ? 1 : 0.5,
        }}
        disabled={!isFormValid || completing}
        onClick={handleComplete}
      >
        {completing ? "Validation en cours..." : "Valider ma vérification d'identité"}
      </button>
    </div>
  );
}
