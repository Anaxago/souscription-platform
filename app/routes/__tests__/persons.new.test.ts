import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/lib/api.server", () => ({
  api: vi.fn(),
}));

import { api } from "~/lib/api.server";
import { action } from "../persons.new";

const mockedApi = vi.mocked(api);

function buildRequest(body: Record<string, string>): Request {
  const formData = new FormData();
  for (const [key, value] of Object.entries(body)) {
    formData.append(key, value);
  }
  return new Request("http://localhost/persons/new", {
    method: "POST",
    body: formData,
  });
}

describe("persons.new action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a person kernel successfully", async () => {
    const mockPerson = {
      id: "abc-123",
      firstName: "Jean",
      lastName: "Dupont",
      legacyAppId: null,
    };

    mockedApi.mockResolvedValue(
      new Response(JSON.stringify(mockPerson), { status: 201 }),
    );

    const request = buildRequest({
      firstName: "Jean",
      lastName: "Dupont",
      legacyAppId: "",
    });

    const result = await action({
      request,
      params: {},
      context: {},
    } as Parameters<typeof action>[0]);

    expect(mockedApi).toHaveBeenCalledWith("/person-kernels", {
      method: "POST",
      body: JSON.stringify({ firstName: "Jean", lastName: "Dupont" }),
    });

    expect(result).toEqual({ success: true, person: mockPerson });
  });

  it("sends legacyAppId when provided", async () => {
    mockedApi.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "abc-123",
          firstName: "Jean",
          lastName: "Dupont",
          legacyAppId: "42",
        }),
        { status: 201 },
      ),
    );

    const request = buildRequest({
      firstName: "Jean",
      lastName: "Dupont",
      legacyAppId: "42",
    });

    await action({
      request,
      params: {},
      context: {},
    } as Parameters<typeof action>[0]);

    expect(mockedApi).toHaveBeenCalledWith("/person-kernels", {
      method: "POST",
      body: JSON.stringify({
        firstName: "Jean",
        lastName: "Dupont",
        legacyAppId: "42",
      }),
    });
  });

  it("returns error on API failure", async () => {
    mockedApi.mockResolvedValue(
      new Response(JSON.stringify({ message: "Conflict" }), { status: 409 }),
    );

    const request = buildRequest({
      firstName: "Jean",
      lastName: "Dupont",
      legacyAppId: "",
    });

    const result = await action({
      request,
      params: {},
      context: {},
    } as Parameters<typeof action>[0]);

    expect(result).toEqual({ success: false, error: "Conflict" });
  });

  it("returns error on network failure", async () => {
    mockedApi.mockRejectedValue(new Error("fetch failed"));

    const request = buildRequest({
      firstName: "Jean",
      lastName: "Dupont",
      legacyAppId: "",
    });

    const result = await action({
      request,
      params: {},
      context: {},
    } as Parameters<typeof action>[0]);

    expect(result).toEqual({ success: false, error: "fetch failed" });
  });
});
