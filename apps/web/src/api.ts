import type {
  DeviceBudgetDto,
  DeviceBudgetUpdate,
  DeviceListDto,
  InvoiceDto,
  InvoiceListDto,
  PublicCheckoutDto,
  PublicConfigDto,
} from "@mmp/contracts";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const protectedPath = path.startsWith("/v1/invoices") || path.startsWith("/v1/devices");
  const token = protectedPath ? await accessTokenProvider?.() : null;
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event("mmp:unauthorized"));
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) message = payload.message;
    } catch {
      // Keep the status-based error when the response body is not JSON.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

let accessTokenProvider: (() => Promise<string>) | null = null;

export function setAccessTokenProvider(provider: (() => Promise<string>) | null): void {
  accessTokenProvider = provider;
}

export const api = {
  config: () => request<PublicConfigDto>("/v1/config"),
  listInvoices: async () => (await request<InvoiceListDto>("/v1/invoices")).items,
  getInvoice: (id: string) => request<InvoiceDto>(`/v1/invoices/${id}`),
  getCheckout: (id: string) => request<PublicCheckoutDto>(`/v1/checkouts/${id}`),
  createInvoice: (body: { amountXrp: string; reference?: string }) =>
    request<InvoiceDto>("/v1/invoices", { method: "POST", body: JSON.stringify(body) }),
  simulatePayment: (id: string) =>
    request<InvoiceDto>(`/v1/invoices/${id}/demo-payment`, { method: "POST" }),
  simulateCheckoutPayment: (id: string) =>
    request<PublicCheckoutDto>(`/v1/checkouts/${id}/demo-payment`, { method: "POST" }),
  listDevices: async () => (await request<DeviceListDto>("/v1/devices")).items,
  getDeviceBudget: (id: string) => request<DeviceBudgetDto>(`/v1/devices/${id}/budget`),
  updateDeviceBudget: (id: string, body: DeviceBudgetUpdate) =>
    request<DeviceBudgetDto>(`/v1/devices/${id}/budget`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};
