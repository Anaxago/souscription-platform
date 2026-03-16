/**
 * Server-side API client for the Platform API.
 *
 * This module MUST only be imported from server code (loaders, actions, .server files).
 * The ".server.ts" suffix ensures React Router / Vite will never bundle it into the
 * client, keeping the API_KEY secret out of the browser.
 *
 * Usage:
 *   import { api } from "~/lib/api.server";
 *   const res = await api("/persons", { method: "POST", body: JSON.stringify(data) });
 */

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function api(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const baseUrl = getEnvOrThrow("API_BASE_URL");
  const apiKey = getEnvOrThrow("API_KEY");

  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    "X-Api-Key": apiKey,
  };

  // Only set Content-Type for requests with a body
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
    },
  });
}
