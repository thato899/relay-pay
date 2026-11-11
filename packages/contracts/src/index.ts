import { type Static, Type } from "typebox";

export const paymentModes = ["demo", "xrpl-testnet"] as const;
export const invoiceStatuses = ["pending", "paid", "expired"] as const;

export const createInvoiceBodySchema = Type.Object(
  {
    amountXrp: Type.String({
      description:
        "Amount in XRP, up to six decimal places. Sent as a string to avoid float errors.",
      maxLength: 18,
      pattern: "^(?:0|[1-9][0-9]{0,8})(?:\\.[0-9]{1,6})?$",
    }),
    reference: Type.Optional(
      Type.String({ description: "Optional order or table reference.", maxLength: 80 }),
    ),
    expiresInMinutes: Type.Optional(Type.Integer({ minimum: 5, maximum: 120 })),
  },
  { additionalProperties: false },
);

export const invoiceSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  amountXrp: Type.String(),
  amountDrops: Type.String(),
  reference: Type.Union([Type.String(), Type.Null()]),
  status: Type.Union([Type.Literal("pending"), Type.Literal("paid"), Type.Literal("expired")]),
  destinationAddress: Type.String(),
  destinationTag: Type.Integer({ minimum: 1, maximum: 4_294_967_295 }),
  checkoutUrl: Type.String({ format: "uri" }),
  network: Type.Union([Type.Literal("demo"), Type.Literal("xrpl-testnet")]),
  expiresAt: Type.String({ format: "date-time" }),
  paidAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  transactionHash: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ format: "date-time" }),
});

export const invoiceListSchema = Type.Object({
  items: Type.Array(invoiceSchema),
});

export const publicCheckoutSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  amountXrp: Type.String(),
  reference: Type.Union([Type.String(), Type.Null()]),
  status: Type.Union([Type.Literal("pending"), Type.Literal("paid"), Type.Literal("expired")]),
  destinationAddress: Type.String(),
  destinationTag: Type.Integer({ minimum: 1, maximum: 4_294_967_295 }),
  checkoutUrl: Type.String({ format: "uri" }),
  network: Type.Union([Type.Literal("demo"), Type.Literal("xrpl-testnet")]),
  expiresAt: Type.String({ format: "date-time" }),
  paidAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  transactionHash: Type.Union([Type.String(), Type.Null()]),
});

export const publicConfigSchema = Type.Object({
  mode: Type.Union([Type.Literal("demo"), Type.Literal("xrpl-testnet")]),
  network: Type.String(),
  merchantAddress: Type.String(),
});

export const errorResponseSchema = Type.Object({
  error: Type.String(),
  message: Type.String(),
});

export type CreateInvoiceBody = Static<typeof createInvoiceBodySchema>;
export type InvoiceStatus = (typeof invoiceStatuses)[number];
export type PaymentMode = (typeof paymentModes)[number];
export type InvoiceDto = Static<typeof invoiceSchema>;
export type InvoiceListDto = Static<typeof invoiceListSchema>;
export type PublicCheckoutDto = Static<typeof publicCheckoutSchema>;
export type PublicConfigDto = Static<typeof publicConfigSchema>;
