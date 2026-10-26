import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  baseState,
  createSeed,
  convert,
  csvString,
  businessDaysSince,
  businessDate,
  dateOffset,
  today,
  wonEffects,
} from "../shared/domain.mjs";
import { calculateQuote } from "../shared/quote.mjs";
import { schemas } from "../server/schema.mjs";
import { zodMessages } from "../shared/errors.mjs";
import { canWrite, keepsOwner } from "../shared/permissions.mjs";

const catalog = JSON.parse(
  readFileSync(new URL("../server/catalog.json", import.meta.url), "utf8"),
);
const offer = {
  id: "S-01",
  name: "Prueba",
  market: "España",
  owner: "Dirección",
  city: "",
  sector: "",
  contact: "",
  url: "",
  signal: "",
  pain: "",
  offerId: "S-01",
  stage: "Investigado",
  value: 1000,
  currency: "EUR",
  probability: 10,
  nextAction: "",
  nextDate: "",
  source: "Outbound",
  fit: "Alto",
};
const settings = { eurUsd: 1.09, usdClp: 950 };

test("reporting converts EUR/USD/CLP without combining raw values", () => {
  const s = baseState().settings;
  assert.equal(convert(100, "EUR", "USD", s), 109.00000000000001);
  assert.equal(convert(95000, "CLP", "USD", s), 100);
  assert.ok(
    Math.abs(convert(convert(500, "EUR", "CLP", s), "CLP", "EUR", s) - 500) <
      1e-6,
  );
});

test("real workspace includes strategy but no fictitious revenue or contacts", () => {
  const s = createSeed();
  assert.equal(s.prospects.length, 0);
  assert.equal(s.projects.length, 0);
  assert.equal(s.activities.length, 0);
  assert.equal(s.quotes.length, 0);
  assert.equal(s.profiles.length, 0);
  assert.equal(s.initiatives.length, 12);
  assert.ok(s.initiatives.every((i) => i.progress === 0));
  assert.ok(s.initiatives.every((i) => i.start <= i.end));
});

test("catalog carries 39 services and 14 profiles with coherent HH allocations", () => {
  assert.equal(catalog.offers.length, 39);
  assert.equal(catalog.profiles.length, 14);
  assert.ok(catalog.profiles.every((p) => p.active && p.cost > 0));
  const ids = new Set(catalog.profiles.map((p) => p.id));
  for (const o of catalog.offers) {
    assert.ok(o.clpMax >= o.clpMin && o.usdMax >= o.usdMin && o.eurMax >= o.eurMin);
    const hours = (o.allocations || []).reduce((s, a) => s + a.hours, 0);
    for (const a of o.allocations || [])
      assert.ok(ids.has(a.profileId), `${o.id} usa un perfil inexistente`);
    if (o.allocations?.length) {
      assert.equal(hours, o.hours, `${o.id} no cuadra con sus asignaciones`);
      const labor = o.allocations.reduce((s, a) => {
        const p = catalog.profiles.find((x) => x.id === a.profileId);
        return s + a.hours * p.cost;
      }, 0);
      const commission = 30;
      assert.ok(
        o.clpMin >= labor / (1 - commission / 100),
        `${o.id} no cubre costo + comisión`,
      );
    }
  }
});

test("winning creates project, onboarding, review once", () => {
  const s = createSeed();
  const p = { ...offer, stage: "Ganado" };
  const effects = wonEffects(s, p, () => "new-id");
  assert.equal(effects.filter((e) => e[0] === "projects").length, 1);
  assert.equal(effects.filter((e) => e[0] === "tasks").length, 4);
  s.projects.push(effects.find((e) => e[0] === "projects")[1]);
  assert.equal(wonEffects(s, p).length, 0);
});

test("business day alerts skip weekend and reject invalid dates", () => {
  assert.equal(businessDaysSince("2026-10-09", "2026-10-12"), 1);
  assert.equal(businessDaysSince("2026-10-09", "2026-10-16"), 5);
  assert.equal(businessDaysSince("invalid"), 0);
});

test("business dates follow Santiago across UTC midnight", () => {
  const instant = new Date("2026-11-01T00:00:00Z");
  assert.equal(today(instant), "2026-10-31");
  assert.equal(businessDate(instant.toISOString()), "2026-10-31");
  assert.equal(businessDate("2026-10-31"), "2026-10-31");
  assert.equal(dateOffset(1, instant), "2026-11-01");
  assert.equal(dateOffset(1, "2026-10-31"), "2026-11-01");
  assert.equal(dateOffset(1, "2026-10-31T12:00:00Z"), "2026-11-01");
});

test("CSV escapes delimiters, quotes, multiline text and formula injection", () => {
  const csv = csvString([
    { Nombre: "=1+1", Nota: 'A;B\n"quoted"', Valor: 10 },
    { Nombre: "@SUM(A1)", Nota: "normal", Valor: 0 },
  ]);
  assert.ok(csv.startsWith("\ufeff"));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"\'@SUM(A1)"'));
  assert.ok(csv.includes('"A;B\n""quoted"""'));
});

test("validation rejects impossible dates, reversed timeline and negative deal values", () => {
  assert.equal(
    schemas.prospects.safeParse({ ...offer, value: -1 }).success,
    false,
  );
  assert.equal(
    schemas.prospects.safeParse({ ...offer, nextDate: "2026-02-30" }).success,
    false,
  );
  const seed = createSeed();
  assert.equal(
    schemas.initiatives.safeParse({
      ...seed.initiatives[0],
      start: "2026-10-30",
      end: "2026-10-01",
    }).success,
    false,
  );
  assert.equal(
    schemas.prospects.safeParse({ ...offer, url: "javascript:alert(1)" }).success,
    false,
  );
});

test("quote pricing adds commission and margin over direct cost", () => {
  const lines = [
    { profileId: "profile-1", hours: 10, rate: 41000, currency: "CLP" },
    { profileId: "profile-2", hours: 5, rate: 33000, currency: "CLP" },
  ];
  const t = calculateQuote({
    lines,
    extraCost: 85000,
    commission: 30,
    margin: 10,
    currency: "CLP",
    ...settings,
  });
  assert.equal(t.hours, 15);
  assert.equal(t.labor, 575000);
  assert.equal(t.direct, 660000);
  assert.equal(t.net, 1100000);
  assert.equal(t.fee, 330000);
  assert.equal(t.profit, 110000);
  assert.equal(t.net, Math.round(t.direct / (1 - 0.4)));
  assert.equal(t.profit, t.net * 0.1);
});

test("quote pricing converts profile currency and rounds per currency", () => {
  const t = calculateQuote({
    lines: [{ profileId: "p", hours: 1, rate: 109, currency: "EUR" }],
    commission: 0,
    margin: 0,
    currency: "USD",
    ...settings,
  });
  assert.equal(t.net, 118.81);
  const clp = calculateQuote({
    lines: [{ profileId: "p", hours: 1, rate: 1000, currency: "CLP" }],
    commission: 0,
    margin: 0,
    currency: "CLP",
    ...settings,
  });
  assert.equal(clp.net, 1000);
  assert.equal(Number.isInteger(clp.net), true);
});

test("quote pricing rejects empty scopes and impossible percentages", () => {
  const base = { commission: 30, margin: 0, currency: "CLP", ...settings };
  assert.throws(() => calculateQuote({ ...base, lines: [] }), /perfil/i);
  assert.throws(
    () =>
      calculateQuote({
        ...base,
        lines: [{ profileId: "p", hours: 0, rate: 100, currency: "CLP" }],
      }),
    /horas/i,
  );
  assert.throws(
    () =>
      calculateQuote({
        ...base,
        commission: 60,
        margin: 40,
        lines: [{ profileId: "p", hours: 1, rate: 100, currency: "CLP" }],
      }),
    /100%/,
  );
});

test("validation errors are explained in Spanish", () => {  const result = schemas.quotes.safeParse({
    name: "",
    client: "",
    currency: "CLP",
    serviceId: "",
    status: "Borrador",
    notes: "",
    commission: 30,
    margin: 0,
    extraCost: 0,
    validUntil: "2026-10-30",
    lines: [],
  });
  assert.equal(result.success, false);
  const message = zodMessages(result.error);
  assert.ok(message.includes("name"));
  assert.ok(message.includes("client"));
  assert.ok(/elemento/.test(message), message);
  for (const english of ["Required", "Expected", "must be", "at least", "Invalid"])
    assert.ok(!message.includes(english), message);
  const badDate = schemas.prospects.safeParse({
    ...offer,
    nextDate: "2026-02-30",
  });
  assert.equal(badDate.success, false);
  assert.match(zodMessages(badDate.error), /Fecha inválida/);
  const badUrl = schemas.prospects.safeParse({
    ...offer,
    url: "javascript:alert(1)",
  });
  assert.equal(badUrl.success, false);
  assert.match(zodMessages(badUrl.error), /enlace|http/);
  const oneDay = schemas.initiatives.safeParse({
    ...createSeed().initiatives[0],
    start: "2026-10-01",
    end: "2026-10-01",
  });
  assert.equal(oneDay.success, true);
});

test("one permission matrix governs interface and server for every role", () => {
  const direccion = { id: "d", name: "D", role: "Dirección" };
  const comercial = { id: "c", name: "C", role: "Comercial" };
  const estrategia = { id: "e", name: "E", role: "Estrategia / Diseño" };
  const externo = { id: "x", name: "X", role: "Colaborador externo" };
  const collections = [
    "prospects",
    "tasks",
    "content",
    "partners",
    "projects",
    "initiatives",
    "offers",
    "profiles",
    "quotes",
  ];
  for (const c of collections)
    assert.equal(canWrite(direccion, c), true, `Dirección escribe ${c}`);
  assert.equal(canWrite(comercial, "prospects"), true);
  assert.equal(canWrite(comercial, "partners"), true);
  assert.equal(canWrite(comercial, "quotes"), true);
  assert.equal(canWrite(comercial, "quotes", { ownerId: "c" }), true);
  assert.equal(canWrite(comercial, "quotes", { ownerId: "otro" }), false);
  assert.equal(canWrite(comercial, "offers"), false);
  assert.equal(canWrite(comercial, "profiles"), false);
  assert.equal(canWrite(estrategia, "tasks"), true);
  assert.equal(canWrite(estrategia, "content"), true);
  assert.equal(canWrite(estrategia, "projects"), true);
  assert.equal(canWrite(estrategia, "prospects"), false);
  assert.equal(canWrite(estrategia, "partners"), false);
  assert.equal(canWrite(estrategia, "quotes"), false);
  assert.equal(canWrite(externo, "tasks", { owner: "X" }), true);
  assert.equal(canWrite(externo, "tasks", { owner: "Otro" }), false);
  assert.equal(canWrite(externo, "prospects", { owner: "X" }), false);
  assert.equal(canWrite(externo, "tasks"), false);
  assert.equal(keepsOwner(externo, { owner: "X" }, { owner: "X" }), true);
  assert.equal(keepsOwner(externo, { owner: "X" }, { owner: "Otro" }), false);
  assert.equal(keepsOwner(comercial, { owner: "C" }, { owner: "Otro" }), true);
  assert.equal(canWrite(null, "tasks"), false);
});
