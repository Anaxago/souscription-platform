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

  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
      "X-Api-Key": apiKey,
    },
  });
}
