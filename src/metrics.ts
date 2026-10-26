import {
  businessDate,
  businessDaysSince,
  today,
  dateOffset,
} from "../shared/domain.mjs";
import { toBase } from "./ui";
import type { State, Entity } from "./types";
export function withinPeriod(date: string, period: string) {
  if (period === "Todo") return true;
  const day = today();
  const target = businessDate(date);
  if (period === "Esta semana") {
    const weekday = new Date(day + "T12:00:00Z").getUTCDay();
    const monday = dateOffset(-((weekday + 6) % 7), day);
    return target >= monday && target <= dateOffset(6, monday);
  }
  if (period === "Este trimestre") {
    const [year, month] = day.split("-").map(Number);
    const quarterStart = Math.floor((month - 1) / 3) * 3 + 1;
    const start = `${year}-${String(quarterStart).padStart(2, "0")}-01`;
    const end = dateOffset(
      -1,
      new Date(Date.UTC(year, quarterStart + 2, 1, 12)),
    );
    return target >= start && target <= end;
  }
  return target.slice(0, 7) === day.slice(0, 7);
}
export function getMetrics(
  state: State,
  market: string,
  owner: string,
  period: string,
) {
  const match = (e: Entity) =>
    (market === "Todos" || e.market === market || e.market === "Todos") &&
    (owner === "Todos" || e.owner === owner);
  const prospects = state.prospects.filter(match);
  const open = prospects.filter(
    (p) => !["Ganado", "Perdido", "Nurture"].includes(p.stage),
  );
  const projects = state.projects.filter(match);
  const activeProjects = projects.filter((p) => p.status === "Activo");
  const wonProjects = projects.filter((p) => withinPeriod(p.date, period));
  const activities = state.activities
    .filter(match)
    .filter((a) => withinPeriod(a.date, period));
  const pipeline = open.reduce(
    (s, p) => s + (toBase(p, state.settings) * p.probability) / 100,
    0,
  );
  const mrr = activeProjects
    .filter((p) => p.recurring)
    .reduce((s, p) => s + toBase(p, state.settings), 0);
  const hours = activeProjects.reduce((s, p) => s + p.hours, 0);
  const meetings = activities.filter((a) => a.type === "Reunión").length;
  const cohort = prospects.filter((p) => withinPeriod(p.createdAt, period));
  const stage = (values: string[]) =>
    cohort.filter((p) => values.includes(p.stage)).length;
  const contacts = cohort.filter((p) => p.stage !== "Investigado").length;
  const responses = stage([
    "Conversación",
    "Diagnóstico",
    "Propuesta enviada",
    "Negociación",
    "Ganado",
    "Perdido",
    "Nurture",
  ]);
  const diagnosed = stage([
    "Diagnóstico",
    "Propuesta enviada",
    "Negociación",
    "Ganado",
    "Perdido",
  ]);
  const proposals = stage([
    "Propuesta enviada",
    "Negociación",
    "Ganado",
    "Perdido",
  ]);
  const won = stage(["Ganado"]);
  const revenue = wonProjects.reduce(
    (s, p) => s + toBase(p, state.settings),
    0,
  );
  const cost = wonProjects.reduce(
    (s, p) => s + toBase({ ...p, value: p.cost }, state.settings),
    0,
  );
  const ratios = [
    {
      name: "Tasa de respuesta",
      value: contacts ? (responses / contacts) * 100 : null,
      target: 15,
      formula: "Conversaciones o etapas posteriores / contactados",
    },
    {
      name: "Tasa de diagnóstico",
      value: contacts ? (diagnosed / contacts) * 100 : null,
      target: 8,
      formula: "Diagnóstico o etapas posteriores / contactados",
    },
    {
      name: "Conversión a propuesta",
      value: diagnosed ? (proposals / diagnosed) * 100 : null,
      target: 50,
      formula: "Propuestas o etapas posteriores / diagnosticados",
    },
    {
      name: "Win rate",
      value: proposals ? (won / proposals) * 100 : null,
      target: 25,
      formula: "Ganados / propuestas o etapas posteriores",
    },
    {
      name: "Conversión a retainer",
      value: wonProjects.length
        ? (wonProjects.filter((p) => p.recurring).length / wonProjects.length) *
          100
        : null,
      target: 30,
      formula: "Proyectos recurrentes / proyectos ganados del periodo",
    },
    {
      name: "Pipeline por referidos",
      value: open.length
        ? (open.filter((p) => ["Referido", "Alianza"].includes(p.source))
            .length /
            open.length) *
          100
        : null,
      target: 20,
      formula: "Oportunidades abiertas por referido o alianza / abiertas",
    },
  ];
  const alerts: { title: string; text: string; prospect?: Entity }[] = [];
  open.forEach((p) => {
    if (!p.nextAction || !p.nextDate)
      alerts.push({
        title: `${p.name} necesita un siguiente paso`,
        text: "Asigna una acción y una fecha.",
        prospect: p,
      });
    else if (
      p.stage === "Propuesta enviada" &&
      businessDaysSince(businessDate(p.stageChangedAt || p.updatedAt)) >= 5
    )
      alerts.push({
        title: `Dar seguimiento a ${p.name}`,
        text: "Propuesta abierta por 5 días hábiles o más.",
        prospect: p,
      });
    else if ((Date.now() - new Date(p.updatedAt).getTime()) / 86400000 >= 7)
      alerts.push({
        title: `${p.name} lleva 7 días sin actividad`,
        text: "Retoma la conversación con una acción concreta.",
        prospect: p,
      });
  });
  if (pipeline < state.settings.monthlyTarget * 3)
    alerts.push({
      title: "Refuerza el pipeline",
      text: "El valor ponderado está bajo 3× la meta mensual.",
    });
  if (hours / state.settings.teamHours > 0.85)
    alerts.push({
      title: "Capacidad del equipo en riesgo",
      text: "La capacidad comprometida supera el 85%.",
    });
  activeProjects
    .filter(
      (p) =>
        p.recurring &&
        p.renewalDate &&
        p.renewalDate >= today() &&
        p.renewalDate <= dateOffset(30),
    )
    .forEach((p) =>
      alerts.push({
        title: `Renovación de ${p.name}`,
        text: `Próxima renovación: ${p.renewalDate}.`,
      }),
    );
  return {
    match,
    prospects,
    open,
    projects,
    activeProjects,
    wonProjects,
    activities,
    pipeline,
    mrr,
    hours,
    meetings,
    revenue,
    cost,
    ratios,
    alerts,
    capacity: Math.round((hours / state.settings.teamHours) * 100),
  };
}
