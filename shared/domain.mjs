export const STAGES = [
  "Investigado",
  "Contactado",
  "Conversación",
  "Diagnóstico",
  "Propuesta enviada",
  "Negociación",
  "Ganado",
  "Perdido",
  "Nurture",
];
export const MARKETS = ["España", "US Hispanic", "Chile"];
export const STATUSES = [
  "Pendiente",
  "En curso",
  "Bloqueado",
  "Completado",
  "Archivado",
];
export const PHASES = [
  "Fundaciones",
  "Autoridad y prueba",
  "Prospección focalizada",
  "Primeras conversiones",
  "Retainers",
  "Escala",
];
export const COLLECTIONS = [
  "prospects",
  "initiatives",
  "tasks",
  "content",
  "partners",
  "projects",
  "activities",
  "offers",
  "profiles",
  "quotes",
];
export const BUSINESS_TIME_ZONE = "America/Santiago";
const businessDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
/** @param {Date} [date] */
export const today = (date = new Date()) => {
  const parts = businessDateFormatter.formatToParts(date);
  const part = (type) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};
/** @param {string} value */
export const businessDate = (value) => {
  if (typeof value !== "string" || !value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? today(date) : "";
};
/**
 * @param {number} days
 * @param {Date|string} [base]
 */
export const dateOffset = (days, base = new Date()) => {
  const start =
    typeof base === "string" ? businessDate(base) : today(base);
  const d = new Date(`${start}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
export function baseState() {
  return {
    prospects: [],
    initiatives: [],
    tasks: [],
    content: [],
    partners: [],
    projects: [],
    activities: [],
    settings: {
      name: "PLANOZERO",
      agencyCommission: 30,
      monthlyTarget: 8000,
      meetingTarget: 10,
      baseCurrency: "USD",
      eurUsd: 1.09,
      usdClp: 950,
      teamHours: 320,
      roadmapStart: today().slice(0, 7) + "-01",
      ratesDate: today(),
    },
    profiles: [], quotes: [], offers: [],
  };
}
export function createSeed() {
  const state = baseState();
  const initiatives = [
    [
      "Definir paquetes internacionales",
      1,
      0,
      18,
      "Tres ofertas aprobadas en EUR y USD",
    ],
    [
      "Sales deck y kit comercial",
      1,
      3,
      21,
      "Deck de 12 láminas y plantillas listas",
    ],
    ["Landings España y US Hispanic", 1, 7, 27, "Dos landings publicadas"],
    [
      "Publicar tres casos conceptuales",
      2,
      18,
      42,
      "3 casos etiquetados como concept work",
    ],
    ["Publicar el método PLANOZERO", 2, 20, 42, "Página del método publicada"],
    ["Contenido de autoridad", 2, 21, 365, "2 publicaciones por semana"],
    ["Prospección España", 3, 30, 90, "10–15 prospectos por semana"],
    ["Prospección US Hispanic", 3, 30, 90, "10–15 prospectos por semana"],
    ["Cerrar los primeros proyectos", 4, 60, 120, "1–2 proyectos por mes"],
    [
      "Convertir proyectos a retainers",
      5,
      90,
      180,
      "30–50% de conversión a retainer",
    ],
    ["Red de alianzas estratégicas", 6, 150, 365, "10 partners por mercado"],
    ["Documentar casos internacionales", 6, 180, 365, "3 casos documentados"],
  ];
  state.initiatives = initiatives.map(([name, phase, start, end, kpi], i) => ({
    id: `init-${i}`,
    name,
    phase,
    start: dateOffset(start, state.settings.roadmapStart),
    end: dateOffset(end, state.settings.roadmapStart),
    kpi,
    market: i === 6 ? "España" : i === 7 ? "US Hispanic" : "Todos",
    owner: "Dirección",
    status: "Pendiente",
    progress: 0,
    objective: kpi,
    type: phase < 3 ? "Marca y contenido" : "Comercial",
    dependencies: i > 2 ? "init-0" : "",
  }));
  return state;
}
export function convert(value, from, to, settings) {
  const usd =
    from === "EUR"
      ? value * settings.eurUsd
      : from === "CLP"
        ? value / settings.usdClp
        : value;
  return to === "EUR"
    ? usd / settings.eurUsd
    : to === "CLP"
      ? usd * settings.usdClp
      : usd;
}
export function wonEffects(state, prospect, id = () => crypto.randomUUID()) {
  if (
    prospect.stage !== "Ganado" ||
    state.projects.some((p) => p.prospectId === prospect.id)
  )
    return [];
  const offer = state.offers.find((o) => o.id === prospect.offerId);
  const project = {
    id: id(),
    prospectId: prospect.id,
    name: prospect.name,
    market: prospect.market,
    owner: prospect.owner,
    offerId: prospect.offerId,
    value: prospect.value,
    currency: prospect.currency,
    recurring: !!offer?.recurring,
    status: "Activo",
    hours: offer?.hours || 24,
    cost: 0,
    date: today(),
    renewalDate: dateOffset(30),
    reviewDate: dateOffset(21),
    checklist: [
      "Agendar kickoff",
      "Solicitar accesos y activos",
      "Aprobar brief y alcance",
    ],
  };
  return [
    ["projects", project],
    ...project.checklist.map((name) => [
      "tasks",
      {
        id: id(),
        name: `${name} — ${prospect.name}`,
        date: dateOffset(3),
        owner: prospect.owner,
        market: prospect.market,
        status: "Pendiente",
        priority: "Alta",
        prospectId: prospect.id,
      },
    ]),
    [
      "tasks",
      {
        id: id(),
        name: `Revisión y propuesta de retainer — ${prospect.name}`,
        date: project.reviewDate,
        owner: prospect.owner,
        market: prospect.market,
        status: "Pendiente",
        priority: "Media",
        prospectId: prospect.id,
      },
    ],
  ];
}
export function csvString(rows) {
  if (!rows.length) return "\ufeffSin registros\r\n";
  const keys = Object.keys(rows[0]);
  const escape = (value) => {
    let s = String(value ?? "");
    if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\ufeff" +
    [
      keys.map(escape).join(";"),
      ...rows.map((row) => keys.map((key) => escape(row[key])).join(";")),
    ].join("\r\n")
  );
}
export function businessDaysSince(date, now = today()) {
  let count = 0;
  const d = new Date(date + "T12:00:00Z");
  const end = new Date(now + "T12:00:00Z");
  if (!Number.isFinite(d.getTime()) || !Number.isFinite(end.getTime()))
    return 0;
  while (d < end) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) count++;
  }
  return count;
}
