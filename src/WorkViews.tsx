import { useState } from "react";
import {
  LayoutGrid,
  List,
  Download,
  Plus,
  ArrowUpRight,
  GripVertical,
  CalendarDays,
  Search,
  Flag,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { useStore } from "./store";
import { STAGES, PHASES, STATUSES, today } from "../shared/domain.mjs";
import {
  AddButton,
  Avatar,
  Badge,
  Empty,
  Panel,
  Progress,
  Status,
  TaskCheck,
  dateLabel,
  downloadCSV,
  money,
} from "./ui";
import { canEdit } from "./permissions";
import type { EditTarget, Entity } from "./types";
export type ViewProps = {
  market: string;
  owner: string;
  period: string;
  edit: (t: EditTarget) => void;
};
export const matches = (e: Entity, market: string, owner: string) =>
  (market === "Todos" || e.market === market || e.market === "Todos") &&
  (owner === "Todos" || e.owner === owner);
export function Pipeline({ market, owner, edit }: ViewProps) {
  const { state, save, notify, user } = useStore();
  const [mode, setMode] = useState("kanban");
  const [stage, setStage] = useState("Todas");
  const [query, setQuery] = useState("");
  const [drag, setDrag] = useState("");
  const records = state.prospects.filter(
    (p) =>
      matches(p, market, owner) &&
      (stage === "Todas" || p.stage === stage) &&
      `${p.name} ${p.contact} ${p.city}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  async function move(item: Entity, next: string) {
    if (!canEdit(user, "prospects", item)) return;
    if (item.stage === next) return;
    try {
      await save("prospects", { ...item, stage: next }, item);
    } catch (e: any) {
      notify(e.message);
    }
  }
  function exportData() {
    downloadCSV(
      records.map((p) => ({
        Empresa: p.name,
        Mercado: p.market,
        Ciudad: p.city,
        Sector: p.sector,
        Contacto: p.contact,
        URL: p.url,
        Etapa: p.stage,
        Valor: p.value,
        Moneda: p.currency,
        Probabilidad: p.probability,
        "Valor ponderado local": (p.value * p.probability) / 100,
        Responsable: p.owner,
        "Próxima acción": p.nextAction,
        Fecha: p.nextDate,
        Origen: p.source,
      })),
      "planozero-prospectos",
    );
    notify("CSV de prospectos exportado.");
  }
  return (
    <>
      <div className="page-toolbar">
        <div className="tabs">
          <button
            className={mode === "kanban" ? "active" : ""}
            onClick={() => setMode("kanban")}
          >
            <LayoutGrid size={15} />
            Kanban
          </button>
          <button
            className={mode === "table" ? "active" : ""}
            onClick={() => setMode("table")}
          >
            <List size={16} />
            Tabla
          </button>
        </div>
        <span className="toolbar-count">{records.length} oportunidades</span>
        <div className="toolbar-right">
          <button className="button" onClick={exportData}>
            <Download size={15} />
            Exportar CSV
          </button>
          <AddButton
            disabled={!canEdit(user, "prospects")}
            onClick={() => edit({ collection: "prospects" })}
          >
            Nuevo prospecto
          </AddButton>
        </div>
      </div>
      <div className="filter-bar">
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="Buscar prospectos"
            placeholder="Buscar empresa, contacto o ciudad…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filtrar por etapa"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
        >
          <option>Todas</option>
          {STAGES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <span className="muted small-text">
          Arrastra una tarjeta o cambia su etapa.
        </span>
      </div>
      {mode === "kanban" ? (
        <div className="kanban">
          {STAGES.filter((s) => stage === "Todas" || s === stage).map(
            (s, index) => (
              <section
                key={s}
                className={`kanban-column ${drag === s ? "drag-over" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(s);
                }}
                onDragLeave={() => setDrag("")}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag("");
                  const item = state.prospects.find(
                    (p) => p.id === e.dataTransfer.getData("text/plain"),
                  );
                  if (item) move(item, s);
                }}
              >
                <div className="kanban-heading">
                  <span className={`stage-dot dot-${index}`} />
                  <h3>{s}</h3>
                  <span>{records.filter((p) => p.stage === s).length}</span>
                  <button
                    className="icon-button"
                    disabled={!canEdit(user, "prospects")}
                    aria-label={`Agregar a ${s}`}
                    onClick={() =>
                      edit({ collection: "prospects", defaults: { stage: s } })
                    }
                  >
                    <Plus size={15} />
                  </button>
                </div>
                <div className="kanban-body">
                  {records
                    .filter((p) => p.stage === s)
                    .map((p) => (
                      <article
                        className="prospect-card"
                        key={p.id}
                        draggable={canEdit(user, "prospects", p)}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", p.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => setDrag("")}
                      >
                        <div className="card-topline">
                          <Badge>
                            {p.market === "España"
                              ? "ES"
                              : p.market === "Chile"
                                ? "CL"
                                : "US"}{" "}
                            · {p.city}
                          </Badge>
                          <GripVertical size={14} />
                        </div>
                        <button
                          className="card-title"
                          onClick={() =>
                            edit({ collection: "prospects", item: p })
                          }
                        >
                          {p.name}
                          <ArrowUpRight size={15} />
                        </button>
                        <p>{p.sector}</p>
                        <div className="deal-value">
                          <strong>{money(p.value, p.currency)}</strong>
                          <span>{p.probability}%</span>
                        </div>
                        <Progress value={p.probability} subtle />
                        <div className="card-next">
                          <Flag size={12} />
                          <span>
                            {p.nextAction || "Define la próxima acción"}
                          </span>
                        </div>
                        <div className="card-bottom">
                          <span
                            className={
                              p.nextDate &&
                              p.nextDate < today() &&
                              !["Ganado", "Perdido"].includes(p.stage)
                                ? "overdue"
                                : ""
                            }
                          >
                            <CalendarDays size={12} />
                            {dateLabel(p.nextDate)}
                          </span>
                          <Avatar small name={p.owner} />
                        </div>
                        <select
                          className="stage-select"
                          disabled={!canEdit(user, "prospects", p)}
                          aria-label={`Etapa de ${p.name}`}
                          value={p.stage}
                          onChange={(e) => move(p, e.target.value)}
                        >
                          {STAGES.map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </article>
                    ))}
                  {!records.some((p) => p.stage === s) && (
                    <button
                      className="kanban-empty"
                      disabled={!canEdit(user, "prospects")}
                      onClick={() =>
                        edit({
                          collection: "prospects",
                          defaults: { stage: s },
                        })
                      }
                    >
                      <Plus size={15} />
                      Agregar oportunidad
                    </button>
                  )}
                </div>
              </section>
            ),
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empresa / contacto</th>
                <th>Mercado</th>
                <th>Etapa</th>
                <th>Valor</th>
                <th>Probabilidad</th>
                <th>Próxima acción</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody>
              {records.map((p) => (
                <tr key={p.id}>
                  <td>
                    <button
                      className="table-link"
                      onClick={() => edit({ collection: "prospects", item: p })}
                    >
                      {p.name}
                      <ArrowUpRight size={13} />
                    </button>
                    <small>{p.contact}</small>
                  </td>
                  <td>
                    {p.market}
                    <small>{p.city}</small>
                  </td>
                  <td>
                    <select
                      disabled={!canEdit(user, "prospects", p)}
                      aria-label={`Etapa de ${p.name}`}
                      value={p.stage}
                      onChange={(e) => move(p, e.target.value)}
                    >
                      {STAGES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="nowrap">{money(p.value, p.currency)}</td>
                  <td>{p.probability}%</td>
                  <td>
                    {p.nextAction}
                    <small
                      className={
                        p.nextDate && p.nextDate < today() ? "overdue" : ""
                      }
                    >
                      {dateLabel(p.nextDate)}
                    </small>
                  </td>
                  <td>
                    <Avatar small name={p.owner} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!records.length && (
            <Empty
              title="Sin oportunidades en esta vista"
              text="Cambia los filtros o crea un nuevo prospecto."
            />
          )}
        </div>
      )}
    </>
  );
}
export function Tasks({ market, owner, edit }: ViewProps) {
  const { state, save, notify, user } = useStore();
  const [scope, setScope] = useState("Pendientes");
  const [priority, setPriority] = useState("Todas");
  const [query, setQuery] = useState("");
  const scoped = state.tasks.filter((t) => matches(t, market, owner));
  const active = scoped.filter((t) => t.status !== "Archivado");
  const isOpen = (t: Entity) => !["Completado", "Archivado"].includes(t.status);
  const open = scoped.filter(isOpen);
  const done = scoped.filter((t) => t.status === "Completado");
  const overdue = open.filter((t) => t.date < today());
  const dueToday = open.filter((t) => t.date === today());
  const inProgress = open.filter((t) => t.status === "En curso").length;
  const blocked = open.filter((t) => t.status === "Bloqueado").length;
  const completion = active.length
    ? Math.round((done.length / active.length) * 100)
    : 0;
  const records = scoped
    .filter((t) =>
      scope === "Todas"
        ? true
        : scope === "Completadas"
          ? t.status === "Completado"
          : isOpen(t),
    )
    .filter((t) => priority === "Todas" || t.priority === priority)
    .filter((t) =>
      `${t.name} ${t.owner} ${t.market}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) => {
      const aDone = a.status === "Completado" ? 1 : 0;
      const bDone = b.status === "Completado" ? 1 : 0;
      return aDone - bDone || a.date.localeCompare(b.date);
    });
  const title =
    scope === "Completadas"
      ? "Tareas completadas"
      : scope === "Todas"
        ? "Todas las tareas"
        : "Tareas pendientes";
  function toggle(t: Entity) {
    save(
      "tasks",
      {
        ...t,
        status: t.status === "Completado" ? "Pendiente" : "Completado",
      },
      t,
    ).catch((e) => notify(e.message));
  }
  return (
    <>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">
            Tareas pendientes
            <ListChecks size={17} />
          </div>
          <div className="kpi-number">{open.length}</div>
          <div className="kpi-meta">
            <span>
              {inProgress} en curso · {blocked} bloqueadas
            </span>
          </div>
          <Progress value={completion} subtle />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">
            Vencidas
            <AlertTriangle size={17} />
          </div>
          <div className="kpi-number">
            {overdue.length}
            <Badge tone={overdue.length ? "red" : "green"}>
              <i />
              {overdue.length ? "Atención" : "Al día"}
            </Badge>
          </div>
          <div className="kpi-meta">
            <span>Fecha límite superada</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">
            Para hoy
            <CalendarDays size={17} />
          </div>
          <div className="kpi-number">{dueToday.length}</div>
          <div className="kpi-meta">
            <span>
              {dueToday.length ? "Vencen hoy" : "Sin tareas para hoy"}
            </span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">
            Completadas
            <CheckCircle2 size={17} />
          </div>
          <div className="kpi-number">{done.length}</div>
          <div className="kpi-meta">
            <span>{completion}% del total</span>
          </div>
          <Progress value={completion} subtle />
        </div>
      </div>
      <div className="page-toolbar">
        <div className="tabs">
          {["Pendientes", "Completadas", "Todas"].map((value) => (
            <button
              key={value}
              className={scope === value ? "active" : ""}
              onClick={() => setScope(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <span className="toolbar-count">{records.length} tareas</span>
        <div className="toolbar-right">
          <AddButton
            disabled={!canEdit(user, "tasks")}
            onClick={() => edit({ collection: "tasks" })}
          >
            Nueva tarea
          </AddButton>
        </div>
      </div>
      <div className="filter-bar">
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="Buscar tareas"
            placeholder="Buscar tarea, responsable o mercado…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filtrar por prioridad"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="Todas">Todas las prioridades</option>
          <option>Alta</option>
          <option>Media</option>
          <option>Baja</option>
        </select>
        <span className="muted small-text">
          Las tareas vencidas se destacan en rojo.
        </span>
      </div>
      <Panel
        title={title}
        eyebrow="PLAN DE TRABAJO"
        action={
          <span className="toolbar-count">
            {done.length} de {active.length} completadas
          </span>
        }
      >
        <div className="table-wrap">
          <table className="task-table">
            <thead>
              <tr>
                <th aria-label="Completar" />
                <th>Tarea</th>
                <th>Mercado</th>
                <th>Fecha límite</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th>Responsable</th>
                <th aria-label="Editar" />
              </tr>
            </thead>
            <tbody>
              {records.map((t) => {
                const complete = t.status === "Completado";
                const late = !complete && t.date < today();
                return (
                  <tr key={t.id}>
                    <td>
                      <TaskCheck
                        checked={complete}
                        label={`Marcar ${t.name} como ${complete ? "pendiente" : "completada"}`}
                        onClick={() => toggle(t)}
                      />
                    </td>
                    <td>
                      <button
                        className={`table-link ${complete ? "task-done" : ""}`}
                        onClick={() =>
                          edit({ collection: "tasks", item: t })
                        }
                      >
                        {t.name}
                        <ArrowUpRight size={13} />
                      </button>
                    </td>
                    <td>{t.market}</td>
                    <td className={`task-date-cell ${late ? "overdue" : ""}`}>
                      {late ? "Vencida · " : t.date === today() ? "Hoy · " : ""}
                      {dateLabel(t.date)}
                    </td>
                    <td>
                      <Badge tone={t.priority === "Alta" ? "orange" : ""}>
                        {t.priority}
                      </Badge>
                    </td>
                    <td>
                      <Status value={t.status} />
                    </td>
                    <td className="task-owner-cell">
                      <Avatar small name={t.owner} />
                      {t.owner}
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Editar ${t.name}`}
                        onClick={() => edit({ collection: "tasks", item: t })}
                      >
                        <ArrowUpRight size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!records.length && (
            <Empty
              title="Sin tareas en esta vista"
              text="Cambia los filtros o crea una nueva tarea."
            />
          )}
        </div>
      </Panel>
    </>
  );
}
export function Roadmap({ market, owner, edit }: ViewProps) {
  const { state, user } = useStore();
  const [phase, setPhase] = useState("Todas");
  const [status, setStatus] = useState("Todos");
  const [type, setType] = useState("Todos");
  const start = new Date(state.settings.roadmapStart + "T12:00:00");
  const end = new Date(start);
  end.setMonth(end.getMonth() + 12);
  const range = end.getTime() - start.getTime();
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);
    return d;
  });
  const records = state.initiatives.filter(
    (i) =>
      matches(i, market, owner) &&
      (phase === "Todas" || i.phase === Number(phase)) &&
      (status === "Todos" || i.status === status) &&
      (type === "Todos" || i.type === type),
  );
  const done = records.filter((i) => i.status === "Completado").length;
  const progress = records.length
    ? Math.round(records.reduce((s, i) => s + i.progress, 0) / records.length)
    : 0;
  const todayPercent = ((Date.now() - start.getTime()) / range) * 100;
  return (
    <>
      <div className="roadmap-intro">
        <div>
          <span className="eyebrow">UN HORIZONTE DE 12 MESES</span>
          <h2>De las fundaciones a la escala.</h2>
          <p>Una secuencia de decisiones que construye el siguiente nivel.</p>
        </div>
        <div className="roadmap-score">
          <strong>{progress}%</strong>
          <span>
            progreso global
            <br />
            {done} de {records.length} iniciativas
          </span>
        </div>
      </div>
      <div className="page-toolbar">
        <div className="filter-bar">
          <select
            aria-label="Filtrar fase"
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
          >
            <option value="Todas">Todas las fases</option>
            {PHASES.map((p, i) => (
              <option key={p} value={i + 1}>
                0{i + 1} · {p}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar estado"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="Todos">Todos los estados</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="Filtrar tipo de iniciativa"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="Todos">Todos los tipos</option>
            {["Comercial", "Marca y contenido", "Operaciones", "Alianzas"].map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
          </select>
        </div>
        <AddButton
          disabled={!canEdit(user, "initiatives")}
          onClick={() => edit({ collection: "initiatives" })}
        >
          Nueva iniciativa
        </AddButton>
      </div>
      <div className="timeline-scroll">
        <div className="timeline">
          <div className="timeline-header">
            <div>INICIATIVA / RESPONSABLE</div>
            <div className="timeline-months">
              {months.map((d) => (
                <span key={d.toISOString()}>
                  {d.toLocaleDateString("es-CL", { month: "short" })}
                  <small>{d.getFullYear()}</small>
                </span>
              ))}
            </div>
          </div>
          {PHASES.map((p, index) => {
            const items = records.filter((i) => i.phase === index + 1);
            if (!items.length) return null;
            return (
              <div key={p} className="timeline-phase">
                <div className="timeline-phase-label">
                  <span>0{index + 1}</span>
                  {p}
                  <small>{items.length} iniciativas</small>
                </div>
                {items.map((i) => {
                  const left = Math.max(
                    0,
                    ((new Date(i.start + "T12:00:00").getTime() -
                      start.getTime()) /
                      range) *
                      100,
                  );
                  const right = Math.min(
                    100,
                    ((new Date(i.end + "T12:00:00").getTime() -
                      start.getTime()) /
                      range) *
                      100,
                  );
                  const barLeft = Math.min(left, 99.6);
                  const barWidth = Math.min(
                    Math.max(right - left, 0.4),
                    100 - barLeft,
                  );
                  return (
                    <div className="timeline-row" key={i.id}>
                      <button
                        className="timeline-name"
                        onClick={() =>
                          edit({ collection: "initiatives", item: i })
                        }
                      >
                        <strong>{i.name}</strong>
                        <span>
                          <Avatar small name={i.owner} />
                          {i.owner}
                          <i /> {i.status}
                        </span>
                      </button>
                      <div className="timeline-lane">
                        {todayPercent >= 0 && todayPercent <= 100 && (
                          <span
                            className="today-line"
                            style={{ left: `${todayPercent}%` }}
                          />
                        )}
                        {right >= left ? (
                          <button
                            className={`timeline-bar ${i.status === "Completado" ? "done" : i.status === "Bloqueado" ? "blocked" : ""}`}
                            style={{
                              left: `${barLeft}%`,
                              width: `${barWidth}%`,
                            }}
                            title={`${i.name}: ${dateLabel(i.start)} — ${dateLabel(i.end)} · ${i.progress}%`}
                            onClick={() =>
                              edit({ collection: "initiatives", item: i })
                            }
                          >
                            <span style={{ width: `${i.progress}%` }} />
                            <b>{i.progress}%</b>
                          </button>
                        ) : (
                          <button
                            className="out-of-range"
                            onClick={() =>
                              edit({ collection: "initiatives", item: i })
                            }
                          >
                            Fuera del horizonte · editar fechas
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      {!records.length && <Empty title="Sin iniciativas con estos filtros" />}
      <div className="timeline-legend">
        <span>
          <i className="legend-swatch" />
          Planificado
        </span>
        <span>
          <i className="legend-swatch orange" />
          En curso
        </span>
        <span>
          <i className="legend-swatch green" />
          Completado
        </span>
        <span>
          Haz clic en una iniciativa para editar fechas, responsables y
          dependencias.
        </span>
      </div>
    </>
  );
}
export function Content({ market, owner, edit }: ViewProps) {
  const { state, user } = useStore();
  const [month, setMonth] = useState(() => {
    const [year, month] = today().split("-").map(Number);
    return new Date(year, month - 1, 1);
  });
  const [mode, setMode] = useState("calendar");
  const [channel, setChannel] = useState("Todos");
  const records = state.content.filter(
    (c) =>
      matches(c, market, owner) &&
      (channel === "Todos" || c.channel === channel),
  );
  const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const visible = records.filter((c) => c.date.startsWith(prefix));
  const offset = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from(
    { length: Math.ceil((offset + days) / 7) * 7 },
    (_, i) => i - offset + 1,
  );
  return (
    <>
      <div className="page-toolbar">
        <div className="tabs">
          <button
            className={mode === "calendar" ? "active" : ""}
            onClick={() => setMode("calendar")}
          >
            <CalendarDays size={16} />
            Calendario
          </button>
          <button
            className={mode === "list" ? "active" : ""}
            onClick={() => setMode("list")}
          >
            <List size={16} />
            Lista
          </button>
        </div>
        <select
          aria-label="Filtrar canal"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
        >
          <option value="Todos">Todos los canales</option>
          <option>LinkedIn</option>
          <option>Instagram</option>
        </select>
        <div className="toolbar-right">
          <AddButton
            disabled={!canEdit(user, "content")}
            onClick={() => edit({ collection: "content" })}
          >
            Nueva publicación
          </AddButton>
        </div>
      </div>
      <Panel
        title={month.toLocaleDateString("es-CL", {
          month: "long",
          year: "numeric",
        })}
        action={
          <div className="month-nav">
            <span>{visible.length} publicaciones</span>
            <button
              className="icon-button"
              aria-label="Mes anterior"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="button"
              onClick={() => {
                const [year, month] = today().split("-").map(Number);
                setMonth(new Date(year, month - 1, 1));
              }}
            >
              Hoy
            </button>
            <button
              className="icon-button"
              aria-label="Mes siguiente"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              <ChevronRight size={18} />
            </button>
          </div>
        }
        className="calendar-panel"
      >
        {mode === "calendar" ? (
          <div className="calendar-scroll">
            <div className="calendar-grid">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                <div className="calendar-weekday" key={d}>
                  {d}
                </div>
              ))}
              {cells.map((day, i) => {
                const date = `${prefix}-${String(day).padStart(2, "0")}`;
                return (
                  <div
                    key={i}
                    className={`calendar-day ${day < 1 || day > days ? "outside" : ""} ${date === today() ? "today" : ""}`}
                  >
                    {day > 0 && day <= days && (
                      <>
                        <button
                          className="day-number"
                          disabled={!canEdit(user, "content")}
                          aria-label={`Crear publicación el ${date}`}
                          onClick={() =>
                            edit({ collection: "content", defaults: { date } })
                          }
                        >
                          {day}
                        </button>
                        {records
                          .filter((c) => c.date === date)
                          .map((c) => (
                            <button
                              className={`calendar-event ${c.channel === "Instagram" ? "instagram" : ""}`}
                              key={c.id}
                              onClick={() =>
                                edit({ collection: "content", item: c })
                              }
                            >
                              <span>
                                {c.channel === "LinkedIn" ? "in" : "ig"} ·{" "}
                                {c.format}
                              </span>
                              <strong>{c.name}</strong>
                              <small>{c.status}</small>
                            </button>
                          ))}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="content-list">
            {visible.map((c) => (
              <button
                className="content-list-row"
                onClick={() => edit({ collection: "content", item: c })}
                key={c.id}
              >
                <span className="content-date">{dateLabel(c.date)}</span>
                <span>
                  <strong>{c.name}</strong>
                  <small>
                    {c.channel} · {c.market} · {c.format}
                  </small>
                </span>
                <Status value={c.status} />
                <ArrowUpRight size={18} />
              </button>
            ))}
            {!visible.length && (
              <Empty
                title="Un mes por escribir"
                text="Agrega tu primera publicación a este mes."
              />
            )}
          </div>
        )}
      </Panel>
      <div className="info-box">
        Ritmo recomendado: 2 publicaciones por semana y 2 auditorías públicas al
        mes. Los casos conceptuales deben etiquetarse como concept work.
      </div>
    </>
  );
}
