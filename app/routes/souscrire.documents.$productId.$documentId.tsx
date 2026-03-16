import type { Route } from "./+types/souscrire.documents.$productId.$documentId";
import { api } from "~/lib/api.server";

export async function loader({ params }: Route.LoaderArgs) {
  const { productId, documentId } = params;

  const response = await api(
    `/marketing-products/${productId}/documents/${documentId}/download-url`,
  );

  if (!response.ok) {
    return Response.json(
      { error: "Document introuvable" },
      { status: response.status },
    );
  }

  const data = (await response.json()) as { downloadUrl: string };
  return Response.json(data);
}
