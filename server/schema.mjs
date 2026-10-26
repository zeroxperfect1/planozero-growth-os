import { z } from "zod";
import { STAGES, MARKETS, STATUSES } from "../shared/domain.mjs";
import { COMPANY_DOMAIN, isCompanyEmail, normalizeEmail } from "../shared/auth.mjs";
const text = z.string().trim().max(4000);
const name = z.string().trim().min(1).max(160);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Fecha inválida");
const optionalDate = z.union([date, z.literal("")]).default("");
const amount = z.number().finite().min(0).max(1e12);
const market = z.enum([...MARKETS, "Todos"]);
const base = { name, market, owner: name };
const currency = z.enum(["USD", "EUR", "CLP"]);
export const schemas = {
  prospects: z.object({
    ...base,
    market: z.enum(MARKETS),
    city: text.default(""),
    sector: text.default(""),
    contact: text.default(""),
    url: z
      .union([
        z
          .string()
          .url()
          .refine((s) => /^https?:/.test(s), "El enlace debe empezar con http:// o https://"),
        z.literal(""),
      ])
      .default(""),
    signal: text.default(""),
    pain: text.default(""),
    offerId: text,
    stage: z.enum(STAGES),
    value: amount,
    currency,
    probability: z.number().min(0).max(100),
    nextAction: text.default(""),
    nextDate: optionalDate,
    source: z
      .enum(["Outbound", "Referido", "Contenido", "Alianza", "Inbound"])
      .default("Outbound"),
    fit: z.enum(["Alto", "Medio", "Bajo"]).default("Alto"),
  }),
  initiatives: z
    .object({
      ...base,
      phase: z.number().int().min(1).max(6),
      start: date,
      end: date,
      status: z.enum(STATUSES),
      progress: z.number().min(0).max(100),
      objective: text,
      kpi: text,
      type: text,
      dependencies: text.default(""),
    })
    .refine(
      (o) => o.end >= o.start,
      "La fecha de fin debe ser igual o posterior al inicio",
    ),
  tasks: z.object({
    ...base,
    date,
    status: z.enum(STATUSES),
    priority: z.enum(["Alta", "Media", "Baja"]),
    prospectId: text.optional(),
  }),
  content: z.object({
    ...base,
    channel: z.enum(["LinkedIn", "Instagram"]),
    format: text,
    pillar: text,
    cta: text,
    date,
    status: z.enum([
      "Idea",
      "En diseño",
      "En revisión",
      "Programado",
      "Publicado",
    ]),
    result: text.default(""),
  }),
  partners: z.object({
    ...base,
    type: text,
    service: text,
    status: z.enum(["Identificado", "Conversación", "Activo", "Pausado"]),
    model: text,
    nextAction: text,
    date: optionalDate,
  }),
  projects: z.object({
    ...base,
    prospectId: text,
    offerId: text,
    value: amount,
    currency,
    recurring: z.boolean(),
    status: z.enum(["Activo", "Completado", "Pausado"]),
    hours: z.number().min(0).max(10000),
    cost: amount,
    date,
    renewalDate: optionalDate,
    reviewDate: optionalDate,
    checklist: z.array(text).max(30),
  }),
  profiles: z.object({name, area: text, description: text, cost: amount.positive(), currency, active: z.boolean(), source: text.default("Tarifa actualizada por Dirección")}),
  quotes: z.object({name, client: name, currency, serviceId: text.default(""), status: z.enum(["Borrador","Enviada","Aceptada","Archivada"]), notes: text.default(""), commission: z.number().min(0).max(99), margin: z.number().min(0).max(99).default(0), extraCost: amount.default(0), validUntil: date, lines: z.array(z.object({profileId: name, hours: z.number().positive().max(10000)})).min(1).max(100)}).refine(q=>q.commission+q.margin<100,"Comisión y margen deben sumar menos de 100%"),
  offers: z
    .object({
      name,
      category: text.default("Servicio individual"),
      source: text.default("Catálogo interno"),
      notes: text.default(""),
      allocations: z.array(z.object({profileId: name, hours: z.number().positive()})).max(100).default([]),
      subtitle: text,
      description: text,
      eurMin: amount,
      eurMax: amount,
      usdMin: amount,
      usdMax: amount,
      clpMin: amount,
      clpMax: amount,
      duration: text,
      hours: z.number().min(0).max(10000),
      margin: z.number().min(0).max(100),
      deliverables: text,
      recurring: z.boolean(),
    })
    .refine(
      (o) =>
        o.eurMax >= o.eurMin && o.usdMax >= o.usdMin && o.clpMax >= o.clpMin,
      "El máximo debe ser mayor o igual al mínimo",
    ),
};
export const settingsSchema = z.object({
  agencyCommission: z.number().min(0).max(99).default(30),
  name,
  monthlyTarget: z.number().positive().max(1e12),
  meetingTarget: z.number().int().positive().max(10000),
  baseCurrency: currency,
  eurUsd: z.number().positive().max(1000),
  usdClp: z.number().positive().max(100000),
  teamHours: z.number().positive().max(100000),
  roadmapStart: date,
  ratesDate: date,
});
export const userSchema = z.object({
  name,
  email: z
    .string()
    .trim()
    .email()
    .max(200)
    .transform(normalizeEmail)
    .refine(isCompanyEmail, `El correo debe pertenecer a @${COMPANY_DOMAIN}.`),
  password: z.string().min(10).max(200),
  role: z
    .enum([
      "Dirección",
      "Comercial",
      "Estrategia / Diseño",
      "Colaborador externo",
    ]),
});
const password = z.string().min(10).max(200);
export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(200), newPassword: password })
  .refine((v) => v.currentPassword !== v.newPassword, "La nueva contraseña debe ser distinta.");
export const resetPasswordSchema = z.object({ newPassword: password });
export const activitySchema = z.object({
  name,
  type: z.enum(["Nota", "Llamada", "Reunión", "Email", "Propuesta"]),
  date,
  prospectId: name,
});
