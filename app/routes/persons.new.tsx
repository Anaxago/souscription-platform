import { Form, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/persons.new";
import { api } from "~/lib/api.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Créer une personne Kernel — Stanza" },
    { name: "description", content: "Créer une personne Kernel" },
  ];
}

interface PersonKernelResponse {
  id: string;
  firstName: string;
  lastName: string;
  legacyAppId: string | null;
}

type ActionData =
  | { success: true; person: PersonKernelResponse }
  | { success: false; error: string };

export async function action({ request }: Route.ActionArgs): Promise<ActionData> {
  try {
    const formData = await request.formData();
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const legacyAppId = formData.get("legacyAppId") as string;

    const response = await api("/person-kernels", {
      method: "POST",
      body: JSON.stringify({
        firstName,
        lastName,
        ...(legacyAppId ? { legacyAppId } : {}),
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return {
        success: false,
        error:
          (error as Record<string, string>).message ??
          `Erreur ${response.status} lors de la création`,
      };
    }

    const person = (await response.json()) as PersonKernelResponse;
    return { success: true, person };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erreur de connexion au serveur",
    };
  }
}

export default function NewPerson() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
          Créer une personne Kernel
        </h1>

        {actionData?.success ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
              <p className="text-green-800 dark:text-green-300 font-medium">
                Personne Kernel créée avec succès
              </p>
              <dl className="mt-3 space-y-1 text-sm text-green-700 dark:text-green-400">
                <div className="flex gap-2">
                  <dt className="font-medium">ID :</dt>
                  <dd className="font-mono">{actionData.person.id}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-medium">Nom :</dt>
                  <dd>
                    {actionData.person.firstName} {actionData.person.lastName}
                  </dd>
                </div>
                {actionData.person.legacyAppId && (
                  <div className="flex gap-2">
                    <dt className="font-medium">ID Stanza :</dt>
                    <dd className="font-mono">
                      {actionData.person.legacyAppId}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
            <a
              href="/persons/new"
              className="block w-full rounded-lg bg-gray-900 dark:bg-white px-4 py-2.5 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors text-center"
            >
              Créer une autre personne
            </a>
          </div>
        ) : (
          <Form method="post" className="space-y-5">
            <div>
              <label
                htmlFor="firstName"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
              >
                Prénom
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
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
                name="lastName"
                type="text"
                required
                placeholder="Dupont"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="legacyAppId"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
              >
                ID Stanza
              </label>
              <input
                id="legacyAppId"
                name="legacyAppId"
                type="text"
                placeholder="42"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                ID de l'application legacy (optionnel)
              </p>
            </div>

            {actionData?.success === false && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                <p className="text-sm text-red-700 dark:text-red-400">
                  {actionData.error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? "Création en cours..." : "Créer la personne"}
            </button>
          </Form>
        )}
      </div>
    </main>
  );
}
