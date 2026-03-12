import { useState } from "react";
import type { Route } from "./+types/persons.new";
import { createPerson, type PersonResponse } from "~/lib/api";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Créer une personne — Anaxago" },
    { name: "description", content: "Créer une personne Kernel" },
  ];
}

export default function NewPerson() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [personKernelId, setPersonKernelId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<PersonResponse | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const person = await createPerson({
        firstName,
        lastName,
        birthDate: "1990-01-01",
        nationality: "FR",
        ...(personKernelId ? { personKernelId } : {}),
      });
      setCreated(person);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
          Créer une personne Kernel
        </h1>

        {created ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
              <p className="text-green-800 dark:text-green-300 font-medium">
                Personne créée avec succès
              </p>
              <dl className="mt-3 space-y-1 text-sm text-green-700 dark:text-green-400">
                <div className="flex gap-2">
                  <dt className="font-medium">ID :</dt>
                  <dd className="font-mono">{created.id}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-medium">Nom :</dt>
                  <dd>
                    {created.firstName} {created.lastName}
                  </dd>
                </div>
                {created.personKernelId && (
                  <div className="flex gap-2">
                    <dt className="font-medium">ID Anaxago :</dt>
                    <dd className="font-mono">{created.personKernelId}</dd>
                  </div>
                )}
              </dl>
            </div>
            <button
              type="button"
              onClick={() => {
                setCreated(null);
                setFirstName("");
                setLastName("");
                setPersonKernelId("");
              }}
              className="w-full rounded-lg bg-gray-900 dark:bg-white px-4 py-2.5 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
            >
              Créer une autre personne
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="firstName"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
              >
                Prénom
              </label>
              <input
                id="firstName"
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jean"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="lastName"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
              >
                Nom
              </label>
              <input
                id="lastName"
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Dupont"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="personKernelId"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
              >
                ID Anaxago
              </label>
              <input
                id="personKernelId"
                type="text"
                value={personKernelId}
                onChange={(e) => setPersonKernelId(e.target.value)}
                placeholder="550e8400-e29b-41d4-a716-446655440000"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-xs"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                UUID de la personne dans le kernel (optionnel)
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                <p className="text-sm text-red-700 dark:text-red-400">
                  {error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Création en cours..." : "Créer la personne"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
