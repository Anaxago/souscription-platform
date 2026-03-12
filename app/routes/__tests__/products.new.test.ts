import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/lib/api.server", () => ({
  api: vi.fn(),
}));

import { api } from "~/lib/api.server";
import { action } from "../products.new";

const mockedApi = vi.mocked(api);

function buildRequest(body: Record<string, string>): Request {
  const formData = new FormData();
  for (const [key, value] of Object.entries(body)) {
    formData.append(key, value);
  }
  return new Request("http://localhost/products/new", {
    method: "POST",
    body: formData,
  });
}

describe("products.new action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a product kernel successfully", async () => {
    const mockProduct = {
      id: "prod-456",
      name: "SCPI Corum Origin",
      type: "SCPI",
    };

    mockedApi.mockResolvedValue(
      new Response(JSON.stringify(mockProduct), { status: 201 }),
    );

    const request = buildRequest({
      name: "SCPI Corum Origin",
      type: "SCPI",
    });

    const result = await action({
      request,
      params: {},
      context: {},
    } as Parameters<typeof action>[0]);

    expect(mockedApi).toHaveBeenCalledWith("/product-kernels", {
      method: "POST",
      body: JSON.stringify({ name: "SCPI Corum Origin", type: "SCPI" }),
    });

    expect(result).toEqual({ success: true, product: mockProduct });
  });

  it("returns error on API failure", async () => {
    mockedApi.mockResolvedValue(
      new Response(JSON.stringify({ message: "Invalid type" }), {
        status: 400,
      }),
    );

    const request = buildRequest({
      name: "Test",
      type: "INVALID",
    });

    const result = await action({
      request,
      params: {},
      context: {},
    } as Parameters<typeof action>[0]);

    expect(result).toEqual({ success: false, error: "Invalid type" });
  });

  it("returns error when API returns non-JSON error", async () => {
    mockedApi.mockResolvedValue(
      new Response("Internal Server Error", { status: 500 }),
    );

    const request = buildRequest({
      name: "Test",
      type: "SCPI",
    });

    const result = await action({
      request,
      params: {},
      context: {},
    } as Parameters<typeof action>[0]);

    expect(result).toEqual({
      success: false,
      error: "Erreur 500 lors de la création",
    });
  });

  it("returns error on network failure", async () => {
    mockedApi.mockRejectedValue(new Error("fetch failed"));

    const request = buildRequest({
      name: "Test",
      type: "SCPI",
    });

    const result = await action({
      request,
      params: {},
      context: {},
    } as Parameters<typeof action>[0]);

    expect(result).toEqual({ success: false, error: "fetch failed" });
  });
});
