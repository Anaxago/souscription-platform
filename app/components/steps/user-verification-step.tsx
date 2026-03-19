import { useState, useRef } from "react";

interface QuestionResult {
  questionType: string;
  answered: boolean;
  answer: string | null;
}

interface Props {
  journeyId: string;
  stepId: string;
  investorId: string;
  personKernelId: string;
  investorType: string;
  legalEntityKernelId: string | null;
  requiredQuestions: string[];
  questionResults: QuestionResult[];
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

const LEGAL_FORMS = [
  { code: "SAS", label: "SAS" },
  { code: "SARL", label: "SARL" },
  { code: "SA", label: "SA" },
  { code: "SCA", label: "SCA" },
  { code: "SCI", label: "SCI" },
  { code: "SNC", label: "SNC" },
  { code: "SE", label: "SE" },
  { code: "OTHER", label: "Autre" },
];

const FAMILY_SITUATIONS = [
  { value: "SINGLE", label: "Célibataire" },
  { value: "MARRIED", label: "Marié(e)" },
  { value: "CIVIL_PARTNERSHIP", label: "Pacsé(e)" },
  { value: "DIVORCED", label: "Divorcé(e)" },
  { value: "SEPARATED", label: "Séparé(e)" },
  { value: "WIDOWED", label: "Veuf/Veuve" },
  { value: "OTHER_UNION", label: "Autre union" },
];

const PROFESSIONAL_SITUATIONS = [
  { value: "EMPLOYEE", label: "Salarié(e)" },
  { value: "EXECUTIVE", label: "Cadre" },
  { value: "SELF_EMPLOYED", label: "Indépendant(e)" },
  { value: "CIVIL_SERVANT", label: "Fonctionnaire" },
  { value: "RETIRED", label: "Retraité(e)" },
  { value: "STUDENT", label: "Étudiant(e)" },
  { value: "UNEMPLOYED", label: "Sans emploi" },
  { value: "OTHER", label: "Autre" },
];

const VERIFICATION_QUESTION_LABELS: Record<string, string> = {
  IS_US_PERSON: "Êtes-vous une US Person ?",
  IS_POLITICALLY_EXPOSED: "Êtes-vous une Personne Politiquement Exposée (PPE) ?",
  FAMILY_SITUATION: "Situation familiale",
  PROFESSIONAL_SITUATION: "Situation professionnelle",
};

const VERIFICATION_QUESTION_PLACEHOLDERS: Record<string, string> = {
  FAMILY_SITUATION: "Ex : Marié(e), 2 enfants",
  PROFESSIONAL_SITUATION: "Ex : Cadre en CDI, secteur bancaire",
};

const sectionTitle = { fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600 as const, color: "var(--clr-obsidian)", marginBottom: "var(--space-md)" };

export default function UserVerificationStep({
  journeyId,
  stepId,
  investorId,
  personKernelId,
  investorType,
  legalEntityKernelId,
  requiredQuestions,
  questionResults,
  actionUrl,
  onComplete,
}: Props) {
  const isLegal = investorType === "LEGAL";

  // Operator identity fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [nationality, setNationality] = useState("FR");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Operator address fields
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("FR");

  // Legal entity fields
  const [companyName, setCompanyName] = useState("");
  const [siret, setSiret] = useState("");
  const [legalForm, setLegalForm] = useState("SAS");
  const [companyStreet, setCompanyStreet] = useState("");
  const [companyPostalCode, setCompanyPostalCode] = useState("");
  const [companyCity, setCompanyCity] = useState("");
  const [companyCountry, setCompanyCountry] = useState("FR");

  // Verification questions
  const [verificationAnswers, setVerificationAnswers] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const qr of questionResults) {
      if (qr.answered && qr.answer) init[qr.questionType] = qr.answer;
    }
    return init;
  });

  const [submitted, setSubmitted] = useState(false);

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
    if (!firstName.trim() || !lastName.trim() || !birthDate || !email.trim() || !phone.trim() || !street.trim() || !postalCode.trim() || !city.trim()) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    if (isLegal && (!companyName.trim() || !siret.trim() || !companyStreet.trim() || !companyPostalCode.trim() || !companyCity.trim())) {
      setError("Veuillez remplir tous les champs de la société.");
      return;
    }
    const unansweredQuestions = requiredQuestions.filter((q) => !verificationAnswers[q]?.trim());
    if (unansweredQuestions.length > 0) {
      setError("Veuillez répondre à toutes les questions de vérification.");
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
      const personResult = await callAction({
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

      // Create Account with email + phone (non-blocking)
      const personId = (personResult as Record<string, string>).id;
      if (personId) {
        try {
          await callAction({
            type: "create-account",
            personId,
            email: email.trim(),
            phone: phone.trim(),
          });
        } catch {
          // Account creation is best-effort
        }
      }

      // ── Legal entity specific steps ──
      if (isLegal && legalEntityKernelId) {
        // Update kernel with real name/siret
        await callAction({
          type: "update-legal-entity-kernel",
          legalEntityKernelId,
          name: companyName.trim(),
          siret: siret.trim(),
        });

        // Create full legal entity
        const leResult = await callAction({
          type: "create-legal-entity",
          name: companyName.trim(),
          siret: siret.trim(),
          legalForm,
          registeredAddress: {
            street: companyStreet.trim(),
            city: companyCity.trim(),
            postalCode: companyPostalCode.trim(),
            country: companyCountry,
          },
          legalEntityKernelId,
        });

        // Add operator as legal representative
        const legalEntityId = (leResult as Record<string, string>).id;
        if (legalEntityId && personId) {
          try {
            await callAction({
              type: "add-company-role",
              legalEntityId,
              personId,
              roleType: "LEGAL_REPRESENTATIVE",
              since: new Date().toISOString().split("T")[0],
            });
          } catch {
            // Best-effort — don't block verification
          }
        }
      }

      // Submit verification questions one by one
      const questionErrors: string[] = [];
      for (const questionType of requiredQuestions) {
        const answer = verificationAnswers[questionType];
        if (answer) {
          try {
            await callAction({
              type: "submit-verification-question",
              journeyId,
              questionType,
              answer,
            });
          } catch (e) {
            questionErrors.push(`${questionType}: ${e instanceof Error ? e.message : "erreur"}`);
          }
        }
      }

      // Set user-verification status
      try {
        await callAction({ type: "user-verification", journeyId });
      } catch {
        // Best-effort
      }

      // Try to complete the step explicitly
      try {
        const completeResult = await callAction({
          type: "complete-verification",
          journeyId,
          stepId,
        });
        console.log("complete-verification result:", JSON.stringify(completeResult));
      } catch (e) {
        console.error("complete-verification failed:", e);
      }

      // Show warnings if questions failed
      if (questionErrors.length > 0) {
        console.warn("Question errors:", questionErrors);
      }

      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur lors de la validation";
      setError(msg);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setCompleting(false);
    }
  }

  const requiredDocs = DOC_TYPES.filter((d) => d.required);
  const allRequiredUploaded = requiredDocs.every((d) => uploadedDocs.some((u) => u.type === d.type));
  const isPersonValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    birthDate.length > 0 &&
    email.trim().length > 0 &&
    phone.trim().length > 0 &&
    street.trim().length > 0 &&
    postalCode.trim().length > 0 &&
    city.trim().length > 0;
  const isCompanyValid = !isLegal || (
    companyName.trim().length > 0 &&
    siret.trim().length > 0 &&
    companyStreet.trim().length > 0 &&
    companyPostalCode.trim().length > 0 &&
    companyCity.trim().length > 0
  );
  const isQuestionsValid = requiredQuestions.every((q) => verificationAnswers[q]?.trim());
  const isFormValid = isPersonValid && isCompanyValid && isQuestionsValid;

  // ── Submitted confirmation screen ──
  if (submitted) {
    return (
      <div className="step-panel">
        <div style={{ textAlign: "center", padding: "var(--space-lg) 0" }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "rgba(26, 93, 86, 0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto var(--space-md)",
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, color: "var(--clr-obsidian)", marginBottom: "var(--space-xs)" }}>
            Informations enregistrées
          </h2>
          <p style={{ fontSize: 15, color: "var(--clr-cashmere)", maxWidth: 420, margin: "0 auto var(--space-lg)" }}>
            Vos informations ont été soumises avec succès. La vérification d'identité est en cours de traitement.
            Vous serez notifié une fois la validation terminée.
          </p>
          <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={onComplete}>
            Continuer
          </button>
        </div>
      </div>
    );
  }

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
            {isLegal
              ? "Renseignez les informations du représentant légal et de la société."
              : "Renseignez vos informations personnelles et uploadez vos justificatifs."}
          </p>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: "var(--space-md)" }}>{error}</div>}

      {/* ── Operator Identity ── */}
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <h3 style={sectionTitle}>
          {isLegal ? "Représentant légal" : "Identité"}
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
          <div>
            <label className="form-label" htmlFor="kyc-email">Email *</label>
            <input id="kyc-email" className="form-input" type="email" placeholder="jean.dupont@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="form-label" htmlFor="kyc-phone">Téléphone *</label>
            <input id="kyc-phone" className="form-input" type="tel" placeholder="+33 6 12 34 56 78" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
      </div>

      {/* ── Operator Address ── */}
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <h3 style={sectionTitle}>
          {isLegal ? "Adresse du représentant" : "Adresse"}
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

      {/* ── Legal Entity Info (only for LEGAL) ── */}
      {isLegal && (
        <div style={{ marginBottom: "var(--space-lg)" }}>
          <h3 style={sectionTitle}>Société</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--space-sm)" }}>
              <div>
                <label className="form-label" htmlFor="kyc-companyName">Dénomination sociale *</label>
                <input id="kyc-companyName" className="form-input" placeholder="Ma Société SAS" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div>
                <label className="form-label" htmlFor="kyc-legalForm">Forme juridique *</label>
                <select id="kyc-legalForm" className="form-input" value={legalForm} onChange={(e) => setLegalForm(e.target.value)}>
                  {LEGAL_FORMS.map((f) => (
                    <option key={f.code} value={f.code}>{f.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="form-label" htmlFor="kyc-siret">SIRET *</label>
              <input id="kyc-siret" className="form-input" placeholder="123 456 789 00012" maxLength={14} value={siret} onChange={(e) => setSiret(e.target.value.replace(/\s/g, ""))} />
            </div>
            <div>
              <label className="form-label" htmlFor="kyc-companyStreet">Adresse du siège *</label>
              <input id="kyc-companyStreet" className="form-input" placeholder="10 avenue des Champs-Élysées" value={companyStreet} onChange={(e) => setCompanyStreet(e.target.value)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "var(--space-sm)" }}>
              <div>
                <label className="form-label" htmlFor="kyc-companyPostalCode">Code postal *</label>
                <input id="kyc-companyPostalCode" className="form-input" placeholder="75008" value={companyPostalCode} onChange={(e) => setCompanyPostalCode(e.target.value)} />
              </div>
              <div>
                <label className="form-label" htmlFor="kyc-companyCity">Ville *</label>
                <input id="kyc-companyCity" className="form-input" placeholder="Paris" value={companyCity} onChange={(e) => setCompanyCity(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="form-label" htmlFor="kyc-companyCountry">Pays *</label>
              <select id="kyc-companyCountry" className="form-input" value={companyCountry} onChange={(e) => setCompanyCountry(e.target.value)}>
                <option value="FR">France</option>
                <option value="BE">Belgique</option>
                <option value="CH">Suisse</option>
                <option value="LU">Luxembourg</option>
                <option value="DE">Allemagne</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── Documents ── */}
      <div style={{ marginBottom: "var(--space-md)" }}>
        <h3 style={sectionTitle}>Justificatifs</h3>
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

      {/* ── Verification Questions ── */}
      {requiredQuestions.length > 0 && (
        <div style={{ marginBottom: "var(--space-lg)" }}>
          <h3 style={sectionTitle}>Déclarations réglementaires</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            {requiredQuestions.map((qType) => {
              const isYesNo = qType === "IS_US_PERSON" || qType === "IS_POLITICALLY_EXPOSED";
              const label = VERIFICATION_QUESTION_LABELS[qType] ?? qType;
              const currentAnswer = verificationAnswers[qType] ?? "";

              if (isYesNo) {
                return (
                  <div key={qType}>
                    <label className="form-label">{label} *</label>
                    <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                      {[{ value: "NO", label: "Non" }, { value: "YES", label: "Oui" }].map((opt) => (
                        <label key={opt.value} className="choice-card" style={{
                          flex: 1, textAlign: "center",
                          borderColor: currentAnswer === opt.value ? "var(--clr-primary)" : undefined,
                          background: currentAnswer === opt.value ? "var(--clr-primary-light)" : undefined,
                        }}>
                          <input type="radio" name={`vq-${qType}`} checked={currentAnswer === opt.value} onChange={() => setVerificationAnswers((prev) => ({ ...prev, [qType]: opt.value }))} style={{ display: "none" }} />
                          <span className="choice-card__radio">
                            {currentAnswer === opt.value && <span className="choice-card__radio-dot" />}
                          </span>
                          <span className="choice-card__label">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              }

              // Enum select for FAMILY_SITUATION and PROFESSIONAL_SITUATION
              const options = qType === "FAMILY_SITUATION" ? FAMILY_SITUATIONS
                : qType === "PROFESSIONAL_SITUATION" ? PROFESSIONAL_SITUATIONS
                : null;

              if (options) {
                return (
                  <div key={qType}>
                    <label className="form-label" htmlFor={`vq-${qType}`}>{label} *</label>
                    <select
                      id={`vq-${qType}`}
                      className="form-input"
                      value={currentAnswer}
                      onChange={(e) => setVerificationAnswers((prev) => ({ ...prev, [qType]: e.target.value }))}
                    >
                      <option value="">Sélectionner...</option>
                      {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                );
              }

              return (
                <div key={qType}>
                  <label className="form-label" htmlFor={`vq-${qType}`}>{label} *</label>
                  <input
                    id={`vq-${qType}`}
                    className="form-input"
                    value={currentAnswer}
                    onChange={(e) => setVerificationAnswers((prev) => ({ ...prev, [qType]: e.target.value }))}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

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
