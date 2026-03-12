const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";

interface CreatePersonPayload {
  firstName: string;
  lastName: string;
  birthDate: string;
  nationality: string;
  taxResidence?: string;
  personKernelId?: string;
}

interface PersonResponse {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  nationality: string;
  taxResidence: string | null;
  personKernelId: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function createPerson(
  payload: CreatePersonPayload
): Promise<PersonResponse> {
  const response = await fetch(`${API_BASE_URL}/persons`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      (error as Record<string, string>).message ??
        `Erreur ${response.status} lors de la création`
    );
  }

  return response.json() as Promise<PersonResponse>;
}

export type { CreatePersonPayload, PersonResponse };
