import {
  ArrowUpRight,
  ArrowRight,
  Target,
  CalendarDays,
  Users,
  Activity,
  Check,
  CircleDot,
  Clock3,
  Zap,
  TrendingUp,
} from "lucide-react";
import { useStore } from "./store";
import {
  Panel,
  Badge,
  Progress,
  Avatar,
  LinkButton,
  money,
  amount,
  dateLabel,
  TaskCheck,
  Empty,
} from "./ui";
import { PHASES, STAGES, businessDate, today } from "../shared/domain.mjs";
import { getMetrics, withinPeriod } from "./metrics";
import type { EditTarget, View } from "./types";
export function MarketMap() {
  return (
    <svg
      className="market-map"
      viewBox="0 0 650 250"
      role="img"
      aria-label="Conexión entre Santiago de Chile, Estados Unidos y España"
    >
      <defs>
        <pattern
          id="map-grid"
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
        >
          <circle className="map-grid-dot" cx="1" cy="1" r=".8" />
        </pattern>
        <linearGradient id="route" x1="0" y1="1" x2="1" y2="0">
          <stop className="map-route-stop" stopOpacity=".2" />
          <stop className="map-route-stop" offset="1" />
        </linearGradient>
      </defs>
      <rect width="650" height="250" fill="url(#map-grid)" opacity=".35" />
      <g className="map-land">
        <path d="M75 47l20-15 45-9 32 7 19-8 40 9 22 19-9 19-32 7-13 20-19 13-11 18-14-3-15-19-24-6-9-18-20-9-12-16z" />
        <path d="M168 122l24 8 12 15 28 10 15 23-13 23-14 15-9 25-15 4-5-24-12-25-9-30-13-20z" />
        <path d="M293 25l27-13 18 6-5 32-24 4z" />
        <path d="M369 58l12-17 21 3 17-11 25 2 15-9 43 8 26-4 38 18 13 23-16 10-31-7-16 11-34-3-10 15-17-12-15-3-11-12-23 1-15-8-12 3z" />
        <path d="M373 86l24-9 24 13 18 27-6 21-16 11-10 30-19-2-10-20-17-23-4-26z" />
        <path d="M495 151l29-6 20 14 8 18-22 14-37-11-4-14z" />
      </g>
      <g fill="none" stroke="url(#route)" strokeWidth="1.5">
        <path d="M193 207 Q130 123 181 89" />
        <path d="M193 207 Q252 30 381 78" />
      </g>
      <g className="map-node">
        <circle cx="193" cy="207" r="4" />
        <circle cx="181" cy="89" r="4" />
        <circle cx="381" cy="78" r="4" />
      </g>
      <g className="map-node-ring" fill="none" opacity=".35">
        <circle cx="193" cy="207" r="9" />
        <circle cx="181" cy="89" r="10" />
        <circle cx="381" cy="78" r="10" />
      </g>
      <g className="map-label" fontSize="10" fontFamily="inherit">
        <text x="201" y="212">
          SANTIAGO · BASE
        </text>
        <text x="194" y="87">
          US HISPANIC
        </text>
        <text x="393" y="78">
          ESPAÑA
        </text>
      </g>
    </svg>
  );
}
export function Dashboard({
  market,
  owner,
  period,
  navigate,
  edit,
}: {
  market: string;
  owner: string;
  period: string;
  navigate: (v: View) => void;
  edit: (t: EditTarget) => void;
}) {
  const { state, save, notify } = useStore();
  const m = getMetrics(state, market, owner, period);
  const currency = state.settings.baseCurrency;
  const initiatives = state.initiatives
    .filter(m.match)
    .filter((i) => i.status !== "Archivado");
  const currentPhase =
    initiatives.find((i) => i.status !== "Completado")?.phase || 6;
  const phaseItems = initiatives.filter((i) => i.phase === currentPhase);
  const phaseProgress = phaseItems.length
    ? Math.round(
        phaseItems.reduce((s, i) => s + i.progress, 0) / phaseItems.length,
      )
    : 0;
  const taskList = state.tasks
    .filter(m.match)
    .filter((t) => !["Completado", "Archivado"].includes(t.status))
    .sort((a, b) => a.date.localeCompare(b.date));
  const activityList = state.activities
    .filter(m.match)
    .filter((a) => businessDate(a.date) <= today())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);
  const meetingOwners = [
    ...new Set(
      state.activities
        .filter(
          (a) =>
            a.type === "Reunión" &&
            m.match(a) &&
            withinPeriod(a.date, period),
        )
        .map((a) => a.owner),
    ),
  ].slice(0, 2);
  const counts = STAGES.slice(0, 6).map((s) => ({
    stage: s,
    count: m.open.filter((p) => p.stage === s).length,
  }));
  const max = Math.max(1, ...counts.map((c) => c.count));
  return (
    <>
      <div className="overview-line">
        <span>
          <i className="live-dot" />
          Tu crecimiento, en tiempo real
        </span>
        <span className="mono">BASE SANTIAGO, CL → ESPAÑA / US</span>
      </div>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">
            Ingresos recurrentes
            <TrendingUp size={17} />
          </div>
          <div className="kpi-number">
            <small>{currency}</small>
            {amount(m.mrr)}
          </div>
          <div className="kpi-meta">
            <span>Meta {money(state.settings.monthlyTarget, currency)}</span>
            <b className="orange-text">
              {Math.round((m.mrr / (state.settings.monthlyTarget || 1)) * 100)}%
            </b>
          </div>
          <Progress
            value={(m.mrr / (state.settings.monthlyTarget || 1)) * 100}
          />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">
            Pipeline ponderado
            <Target size={17} />
          </div>
          <div className="kpi-number">
            <small>{currency}</small>
            {amount(m.pipeline)}
          </div>
          <div className="kpi-meta">
            <span>{m.open.length} oportunidades activas</span>
            <span className="subtle-tag">
              {(m.pipeline / (state.settings.monthlyTarget || 1)).toFixed(1)}×
              meta
            </span>
          </div>
          <div className="mini-bars" aria-hidden="true">
            {Array.from({ length: 32 }, (_, i) => (
              <i
                key={i}
                className={
                  i <
                  Math.min(
                    32,
                    (m.pipeline / (state.settings.monthlyTarget || 1) / 3) * 32,
                  )
                    ? "filled"
                    : ""
                }
              />
            ))}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">
            Reuniones del periodo
            <CalendarDays size={17} />
          </div>
          <div className="kpi-number">
            {String(m.meetings).padStart(2, "0")}
            <span className="number-denom">
              / {state.settings.meetingTarget}
            </span>
          </div>
          <div className="kpi-meta">
            <span>{period}</span>
            {meetingOwners.length > 0 && (
              <span className="overlapping-avatars">
                {meetingOwners.map((name) => (
                  <Avatar small name={name} key={name} />
                ))}
              </span>
            )}
          </div>
          <Progress
            value={(m.meetings / state.settings.meetingTarget) * 100}
            subtle
          />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">
            Capacidad del equipo
            <Users size={17} />
          </div>
          <div className="kpi-number">
            {m.capacity}
            <span className="number-denom">%</span>
            <Badge
              tone={
                m.capacity > 100 ? "red" : m.capacity > 85 ? "orange" : "green"
              }
            >
              <i />
              {m.capacity > 100
                ? "Saturada"
                : m.capacity > 85
                  ? "En riesgo"
                  : "Disponible"}
            </Badge>
          </div>
          <div className="kpi-meta">
            <span>
              {m.hours} de {state.settings.teamHours} h / mes
            </span>
            <span>Umbral 85%</span>
          </div>
          <Progress value={m.capacity} subtle />
        </div>
      </div>
      <div className="dashboard-columns">
        <div className="dashboard-main">
          <Panel
            title="Una ruta. El siguiente movimiento."
            eyebrow="ROADMAP DE EXPANSIÓN"
            action={
              <LinkButton onClick={() => navigate("Roadmap")}>
                Ver roadmap
              </LinkButton>
            }
            className="roadmap-card"
          >
            <div className="phase-track">
              {PHASES.map((p, i) => (
                <button
                  key={p}
                  className={
                    i + 1 < currentPhase
                      ? "complete"
                      : i + 1 === currentPhase
                        ? "current"
                        : ""
                  }
                  onClick={() => navigate("Roadmap")}
                  title={p}
                >
                  <span>
                    {i + 1 < currentPhase ? (
                      <Check size={13} />
                    ) : (
                      String(i + 1).padStart(2, "0")
                    )}
                  </span>
                  <small>
                    {
                      [
                        "Fundaciones",
                        "Autoridad",
                        "Prospección",
                        "Conversión",
                        "Retainers",
                        "Escala",
                      ][i]
                    }
                  </small>
                </button>
              ))}
            </div>
            <div className="phase-highlight">
              <div>
                <Badge tone="orange">FASE 0{currentPhase} · EN FOCO</Badge>
                <h3>{PHASES[currentPhase - 1]}</h3>
                <p>
                  {phaseItems[0]?.objective ||
                    "Construye un sistema de crecimiento sostenible."}
                </p>
              </div>
              <div className="phase-percent">
                {phaseProgress}
                <span>%</span>
                <small>completado</small>
              </div>
            </div>
            <Progress value={phaseProgress} />
            <div className="milestone">
              <span>
                <CircleDot size={15} />
                <span>Próximo hito</span>
              </span>
              <button
                onClick={() =>
                  phaseItems[0] &&
                  edit({ collection: "initiatives", item: phaseItems[0] })
                }
              >
                {phaseItems.find((i) => i.status !== "Completado")?.name ||
                  "Revisar resultados"}
                <ArrowRight size={15} />
              </button>
            </div>
          </Panel>
          <Panel
            title="El crecimiento no tiene fronteras."
            eyebrow="MERCADOS ACTIVOS"
            action={
              <LinkButton onClick={() => navigate("Mercados")}>
                Explorar
              </LinkButton>
            }
            className="market-card"
          >
            <MarketMap />
            <div className="market-stats">
              {["España", "US Hispanic"].map((name, i) => {
                const ps = m.open.filter((p) => p.market === name);
                return (
                  <button key={name} onClick={() => navigate("Mercados")}>
                    <span className={`market-flag ${i ? "us" : "es"}`}>
                      {i ? "US" : "ES"}
                    </span>
                    <span>
                      <strong>{name}</strong>
                      <small>
                        {i
                          ? "Partner creativo nearshore"
                          : "Agencia boutique estratégica"}
                      </small>
                    </span>
                    <span className="market-count">
                      {ps.length}
                      <small>prospectos</small>
                    </span>
                    <ArrowUpRight size={17} />
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>
        <div className="dashboard-side">
          <Panel
            title="Pipeline en movimiento"
            action={
              <LinkButton onClick={() => navigate("Pipeline")}>
                Ver todo
              </LinkButton>
            }
          >
            <div className="pipeline-total">
              <strong>{m.open.length}</strong>
              <span>
                oportunidades
                <br />
                abiertas
              </span>
              <Badge>
                {market === "Todos" ? "Todos los mercados" : market}
              </Badge>
            </div>
            <div className="funnel-bars">
              {counts.map((c, i) => (
                <button key={c.stage} onClick={() => navigate("Pipeline")}>
                  <div>
                    <span>
                      <i className={`stage-dot dot-${i}`} />
                      {c.stage}
                    </span>
                    <b>{String(c.count).padStart(2, "0")}</b>
                  </div>
                  <div className="funnel-track">
                    <span
                      style={{
                        width: `${(c.count / max) * 100}%`,
                        opacity: 0.3 + i * 0.13,
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
            <div className="panel-foot">
              <span>
                <i className="live-dot" />
                {m.prospects.filter((p) => p.stage === "Ganado").length}{" "}
                oportunidades ganadas
              </span>
              <ArrowUpRight size={16} />
            </div>
          </Panel>
          <Panel
            title="Actividad reciente"
            action={<Activity size={16} className="muted" />}
          >
            <div className="activity-list">
              {activityList.length ? (
                activityList.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      const p = state.prospects.find(
                        (p) => p.id === a.prospectId,
                      );
                      if (p) edit({ collection: "prospects", item: p });
                    }}
                  >
                    <span className="activity-icon">
                      {a.type === "Reunión" ? (
                        <CalendarDays size={14} />
                      ) : a.type === "Propuesta" ? (
                        <ArrowUpRight size={14} />
                      ) : (
                        <CircleDot size={14} />
                      )}
                    </span>
                    <span>
                      <strong>{a.name}</strong>
                      <small>
                        {a.market} · {dateLabel(a.date)}
                      </small>
                    </span>
                  </button>
                ))
              ) : (
                <Empty
                  title="Todo comienza aquí"
                  text="La actividad de tu equipo aparecerá en este espacio."
                />
              )}
            </div>
          </Panel>
        </div>
      </div>
      <Panel
        title="Prioriza lo que mueve la aguja."
        eyebrow="PRÓXIMAS MEJORES ACCIONES"
        action={
          <LinkButton onClick={() => navigate("Tareas")}>
            Todas las tareas
          </LinkButton>
        }
        className="actions-panel"
      >
        {taskList.length ? (
          <div className="action-list">
            {taskList.slice(0, 4).map((t) => (
              <div className="action-row" key={t.id}>
                <TaskCheck
                  checked={false}
                  label={`Completar ${t.name}`}
                  onClick={() => {
                    save("tasks", { ...t, status: "Completado" }, t).catch(
                      (e) => notify(e.message),
                    );
                  }}
                />
                <button onClick={() => edit({ collection: "tasks", item: t })}>
                  {t.name}
                </button>
                <span className="action-market">{t.market}</span>
                <span
                  className={`task-date ${t.date < today() ? "overdue" : ""}`}
                >
                  <Clock3 size={13} />
                  {t.date < today()
                    ? "Vencida · "
                    : t.date === today()
                      ? "Hoy · "
                      : ""}
                  {dateLabel(t.date)}
                </span>
                <Avatar small name={t.owner} />
                <Badge tone={t.priority === "Alta" ? "orange" : ""}>
                  {t.priority}
                </Badge>
                <button
                  className="icon-button"
                  aria-label={`Editar ${t.name}`}
                  onClick={() => edit({ collection: "tasks", item: t })}
                >
                  <ArrowUpRight size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="Sin tareas pendientes"
            text="Define el siguiente paso para mantener el crecimiento en movimiento."
          />
        )}
      </Panel>
      <div className="dashboard-footer">
        <span>
          <Zap size={13} />
          Estrategia que se convierte en movimiento.
        </span>
        <span>
          PLANOZERO GROWTH OS <b>V.01</b>
        </span>
      </div>
    </>
  );
}
