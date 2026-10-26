import { useState } from "react";
import {
  ArrowUpRight,
  Download,
  MapPin,
  Target,
  Copy,
  Globe2,
  Handshake,
  FileText,
  BookOpen,
} from "lucide-react";
import { useStore } from "./store";
import {
  AddButton,
  Avatar,
  Badge,
  Empty,
  Panel,
  Progress,
  Status,
  dateLabel,
  downloadCSV,
  money,
  toBase,
} from "./ui";
import { getMetrics, withinPeriod } from "./metrics";
import { canEdit } from "./permissions";
import { matches, type ViewProps } from "./WorkViews";
import { MarketMap } from "./Dashboard";
const marketInfo = [
  {
    name: "España",
    code: "ES",
    position: "Agencia boutique estratégica",
    title: "Pensamiento estratégico. Diseño sin fronteras.",
    cities: ["Madrid", "Barcelona", "Valencia", "Málaga"],
    sectors: [
      "Arquitectura",
      "Hospitality",
      "SaaS B2B",
      "Real estate",
      "Consultoría",
      "Wellness",
    ],
    budget: "EUR 3.850+",
    advantage: "20–30%",
    icp: "Empresas de 10–100 personas, con un negocio probado y una marca que necesita acompañar su próxima etapa.",
    message:
      "Un partner creativo desde Chile para empresas que necesitan elevar su marca y su presencia digital con pensamiento estratégico, diseño sólido y una estructura eficiente.",
  },
  {
    name: "US Hispanic",
    code: "US",
    position: "Partner creativo nearshore",
    title: "Una cultura compartida. Una ambición global.",
    cities: [
      "Miami / Orlando",
      "Texas",
      "California",
      "Nueva York / Nueva Jersey",
    ],
    sectors: [
      "Real estate",
      "Salud",
      "Legal",
      "Educación",
      "E-commerce",
      "Wellness",
      "B2B latino",
    ],
    budget: "USD 5.550+",
    advantage: "40–55%",
    icp: "Empresas fundadas por latinos o marcas que buscan conectar con público hispano. Tienen demanda y necesitan una presencia digital consistente.",
    message:
      "No traducimos campañas. Construimos sistemas de marca y crecimiento para empresas que necesitan conectar de forma real con audiencias hispanas.",
  },
];
export function Markets({ market, owner, edit }: ViewProps) {
  const { state, notify, user } = useStore();
  return (
    <>
      <div className="market-hero">
        <div>
          <span className="eyebrow">
            DISEÑADO EN CHILE. PENSADO PARA EL MUNDO.
          </span>
          <h2>
            Dos mercados.
            <br />
            Una visión de crecimiento.
          </h2>
          <p>
            Atención en español, un equipo senior y estándares internacionales.
          </p>
        </div>
        <MarketMap />
      </div>
      <div className="market-grid">
        {marketInfo
          .filter((m) => market === "Todos" || m.name === market)
          .map((m) => {
            const ps = state.prospects.filter(
              (p) =>
                p.market === m.name && (owner === "Todos" || p.owner === owner),
            );
            return (
              <section className="market-detail panel" key={m.name}>
                <div className="market-detail-head">
                  <span
                    className={`market-flag ${m.code === "ES" ? "es" : "us"}`}
                  >
                    {m.code}
                  </span>
                  <div>
                    <h2>{m.name}</h2>
                    <span>{m.position}</span>
                  </div>
                  <Globe2 size={23} />
                </div>
                <h3>{m.title}</h3>
                <div className="market-kpis">
                  <div>
                    <strong>
                      {
                        ps.filter(
                          (p) =>
                            !["Ganado", "Perdido", "Nurture"].includes(p.stage),
                        ).length
                      }
                    </strong>
                    <small>Activos</small>
                  </div>
                  <div>
                    <strong>
                      {ps.filter((p) => p.stage === "Ganado").length}
                    </strong>
                    <small>Ganados</small>
                  </div>
                  <div>
                    <strong>{m.budget}</strong>
                    <small>Presupuesto ICP</small>
                  </div>
                </div>
                <div className="market-section">
                  <span className="eyebrow">CLIENTE IDEAL</span>
                  <p>{m.icp}</p>
                </div>
                <div className="market-section">
                  <span className="eyebrow">CIUDADES FOCO</span>
                  <div className="chips">
                    {m.cities.map((c) => (
                      <Badge key={c}>
                        <MapPin size={11} />
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="market-section">
                  <span className="eyebrow">SECTORES PRIORITARIOS</span>
                  <div className="chips">
                    {m.sectors.map((s) => (
                      <Badge key={s}>{s}</Badge>
                    ))}
                  </div>
                </div>
                <div className="market-message">
                  <span className="eyebrow">MENSAJE COMERCIAL</span>
                  <p>“{m.message}”</p>
                  <button
                    className="text-button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(m.message);
                        notify("Mensaje copiado.");
                      } catch {
                        notify(
                          "No se pudo copiar. Selecciona el texto para copiarlo.",
                        );
                      }
                    }}
                  >
                    <Copy size={14} />
                    Copiar mensaje
                  </button>
                </div>
                <div className="market-bottom">
                  <span>
                    Posicionamiento de precio
                    <br />
                    <b>{m.advantage} bajo agencia local equivalente*</b>
                  </span>
                  <button
                    className="button"
                    disabled={!canEdit(user, "prospects")}
                    onClick={() =>
                      edit({
                        collection: "prospects",
                        defaults: {
                          market: m.name,
                          currency: m.code === "ES" ? "EUR" : "USD",
                        },
                      })
                    }
                  >
                    Prospectar
                    <ArrowUpRight size={16} />
                  </button>
                </div>
              </section>
            );
          })}
      </div>
      {market === "Chile" && (
        <Empty
          title="Chile es nuestra base operativa"
          text="El foco de expansión inicial está en España y US Hispanic. Puedes registrar oportunidades locales en Pipeline."
        />
      )}
      <p className="footnote">
        *Objetivo de posicionamiento definido en la estrategia PLANOZERO, sujeto
        a alcance y comparación comercial. No corresponde a un estudio
        actualizado de precios de mercado.
      </p>
    </>
  );
}
export function Partners({ market, owner, edit }: ViewProps) {
  const { state, user } = useStore();
  const records = state.partners.filter((p) => matches(p, market, owner));
  const [status, setStatus] = useState("Todos");
  const filtered = records.filter(
    (p) => status === "Todos" || p.status === status,
  );
  return (
    <>
      <div className="partner-overview">
        <div>
          <Handshake size={28} />
          <h2>Crecer también es conectar.</h2>
          <p>Un ecosistema de talento que se complementa.</p>
        </div>
        <div>
          <strong>
            {records.filter((p) => p.status === "Activo").length}
            <span>/ 20</span>
          </strong>
          <p>partners activos · meta internacional</p>
        </div>
      </div>
      <div className="page-toolbar">
        <select
          aria-label="Filtrar alianza por estado"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="Todos">Todos los estados</option>
          {["Identificado", "Conversación", "Activo", "Pausado"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <AddButton
          disabled={!canEdit(user, "partners")}
          onClick={() => edit({ collection: "partners" })}
        >
          Nueva alianza
        </AddButton>
      </div>
      <div className="partner-grid">
        {filtered.map((p) => (
          <button
            className="partner-card panel"
            key={p.id}
            onClick={() => edit({ collection: "partners", item: p })}
          >
            <div className="partner-top">
              <span className="company-mark">
                {p.name.slice(0, 2).toUpperCase()}
              </span>
              <Status value={p.status} />
            </div>
            <h3>{p.name}</h3>
            <p>
              {p.type} · {p.market}
            </p>
            <span className="eyebrow">COMPLEMENTA CON</span>
            <p className="partner-service">{p.service}</p>
            <Badge>{p.model}</Badge>
            <div className="partner-next">
              <span>
                Próximo paso
                <strong>{p.nextAction || "Definir siguiente paso"}</strong>
              </span>
              <ArrowUpRight size={18} />
            </div>
            <div className="card-bottom">
              <small>{dateLabel(p.date)}</small>
              <Avatar small name={p.owner} />
            </div>
          </button>
        ))}
      </div>
      {!filtered.length && <Empty title="Tu próxima alianza empieza aquí" />}
    </>
  );
}
export function Metrics({ market, owner, period, edit }: ViewProps) {
  const { state, notify } = useStore();
  const m = getMetrics(state, market, owner, period);
  const currency = state.settings.baseCurrency;
  const registeredCost = m.wonProjects.every((p) => p.cost > 0);
  const grossMargin =
    m.revenue && registeredCost
      ? ((m.revenue - m.cost) / m.revenue) * 100
      : null;
  const concentration = m.revenue
    ? (Math.max(0, ...m.wonProjects.map((p) => toBase(p, state.settings))) /
        m.revenue) *
      100
    : null;
  const metricRows = [
    {
      name: "Ingresos proyectados de cierres",
      value: m.revenue,
      unit: currency,
    },
    { name: "Ingreso recurrente activo", value: m.mrr, unit: currency },
    { name: "Pipeline ponderado actual", value: m.pipeline, unit: currency },
    { name: "Reuniones del periodo", value: m.meetings, unit: "reuniones" },
    ...m.ratios.map((r) => ({ name: r.name, value: r.value, unit: "%" })),
  ];
  return (
    <>
      <div className="page-toolbar">
        <span className="muted">
          Lo que medimos determina lo que podemos mejorar.
        </span>
        <button
          className="button"
          onClick={() => {
            downloadCSV(
              metricRows.map((r) => ({
                Métrica: r.name,
                Valor: r.value ?? "Sin datos",
                Unidad: r.unit,
                Mercado: market,
                Responsable: owner,
                Periodo: period,
              })),
              "planozero-metricas",
            );
            notify("Métricas exportadas.");
          }}
        >
          <Download size={16} />
          Exportar métricas
        </button>
      </div>
      <div className="metric-summary">
        <div className="panel">
          <span>Ingresos proyectados · cierres del periodo</span>
          <strong>{money(m.revenue, currency)}</strong>
          <small>{m.wonProjects.length} proyectos ganados</small>
        </div>
        <div className="panel">
          <span>Ticket promedio</span>
          <strong>
            {m.wonProjects.length
              ? money(m.revenue / m.wonProjects.length, currency)
              : "—"}
          </strong>
          <small>Ingreso proyectado / proyectos ganados</small>
        </div>
        <div className="panel">
          <span>Margen bruto estimado</span>
          <strong>
            {grossMargin === null ? "—" : Math.round(grossMargin) + "%"}
          </strong>
          <small>
            {registeredCost
              ? "Ingresos menos costos directos"
              : "Completa los costos de todos los proyectos"}
          </small>
        </div>
        <div className="panel">
          <span>Concentración de cliente</span>
          <strong>
            {concentration === null ? "—" : Math.round(concentration) + "%"}
          </strong>
          <small>Mayor proyecto / ingreso proyectado</small>
        </div>
      </div>
      <div className="ratio-grid">
        {m.ratios.map((r) => (
          <Panel title={r.name} key={r.name} action={<Target size={17} />}>
            <div className="ratio-value">
              {r.value === null ? "—" : Math.round(r.value) + "%"}
              <Badge
                tone={r.value !== null && r.value >= r.target ? "green" : ""}
              >
                Meta {r.target}%+
              </Badge>
            </div>
            <Progress value={r.value || 0} />
            <p className="footnote">{r.formula}</p>
          </Panel>
        ))}
      </div>
      <p className="footnote">
        Conversiones estimadas por la etapa actual de la cohorte creada en el
        periodo seleccionado; no representan un historial completo de
        transiciones. MRR, capacidad y pipeline muestran el estado actual.
      </p>
      <div className="two-col">
        <Panel title="Distribución por mercado" eyebrow="INGRESOS PROYECTADOS">
          {["España", "US Hispanic", "Chile"].map((name) => {
            const total = m.wonProjects
              .filter((p) => p.market === name)
              .reduce((s, p) => s + toBase(p, state.settings), 0);
            return (
              <div className="distribution-row" key={name}>
                <div>
                  <span>{name}</span>
                  <strong>{money(total, currency)}</strong>
                </div>
                <Progress value={m.revenue ? (total / m.revenue) * 100 : 0} />
              </div>
            );
          })}
          <div className="panel-foot">
            Mix internacional
            <strong>
              {m.revenue
                ? Math.round(
                    (m.wonProjects
                      .filter((p) => p.market !== "Chile")
                      .reduce((s, p) => s + toBase(p, state.settings), 0) /
                      m.revenue) *
                      100,
                  ) + "%"
                : "—"}
            </strong>
          </div>
        </Panel>
        <Panel
          title="Contenido que construye autoridad"
          eyebrow="PUBLICACIONES DEL PERIODO"
        >
          {["LinkedIn", "Instagram"].map((channel) => {
            const posts = state.content.filter(
              (c) =>
                m.match(c) &&
                c.channel === channel &&
                withinPeriod(c.date, period),
            );
            return (
              <div className="content-metric" key={channel}>
                <span className="social-mark">
                  {channel === "LinkedIn" ? "in" : "ig"}
                </span>
                <span>
                  {channel}
                  <small>
                    {posts.filter((p) => p.status === "Publicado").length}{" "}
                    publicadas / {posts.length} planificadas
                  </small>
                </span>
                <strong>{posts.length}</strong>
              </div>
            );
          })}
          <p className="footnote">
            Los resultados de cada publicación se registran en su ficha
            editorial.
          </p>
        </Panel>
      </div>
      <Panel
        title="Proyectos e ingresos"
        eyebrow="EDITA COSTOS, CAPACIDAD Y RENOVACIONES"
      >
        {m.projects.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Proyecto</th>
                  <th>Tipo</th>
                  <th>Ingreso proyectado</th>
                  <th>Costo directo</th>
                  <th>Capacidad mensual</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {m.projects.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button
                        className="table-link"
                        onClick={() =>
                          edit({ collection: "projects", item: p })
                        }
                      >
                        {p.name}
                        <ArrowUpRight size={13} />
                      </button>
                      <small>{p.market}</small>
                    </td>
                    <td>{p.recurring ? "Retainer" : "Proyecto"}</td>
                    <td>{money(p.value, p.currency)}</td>
                    <td>
                      {p.cost ? money(p.cost, p.currency) : "Por registrar"}
                    </td>
                    <td>{p.hours} h</td>
                    <td>
                      <Status value={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Los proyectos comienzan con una oportunidad ganada"
            text="Marca una oportunidad como Ganado en Pipeline para activar su proyecto."
          />
        )}
      </Panel>
    </>
  );
}
export function Library() {
  const { notify } = useStore();
  const [expanded, setExpanded] = useState("Método PLANOZERO");
  const guides: Record<string, string[]> = {
    "Método PLANOZERO": [
      "ZERO — Entender el punto de partida, los desafíos y la ambición del negocio.",
      "MAP — Investigar el contexto, la audiencia y las oportunidades.",
      "ARCHITECT — Diseñar el posicionamiento, la narrativa y el sistema de marca.",
      "BUILD — Convertir la estrategia en identidad y experiencias digitales.",
      "INTELLIGENCE — Integrar herramientas e IA que mejoren la operación.",
      "SCALE — Medir, aprender y acompañar el crecimiento.",
    ],
    "Cadencia de prospección": [
      "1. Investiga empresa, decisor y una señal concreta de necesidad.",
      "2. Interactúa con su contenido durante 5–7 días cuando sea posible.",
      "3. Envía un mensaje personalizado con una observación específica.",
      "4. Haz seguimiento a los 4–5 días hábiles.",
      "5. Invita a un diagnóstico de 30 minutos.",
      "6. Envía una propuesta de sprint dentro de 48 horas de la reunión.",
    ],
    "Revisión semanal": [
      "1. Revisa pipeline, ingresos y capacidad del equipo.",
      "2. Asigna una próxima acción a cada oportunidad activa.",
      "3. Confirma las tareas de contenido y prospección.",
      "4. Eleva iniciativas bloqueadas a Dirección.",
      "5. Elige las tres prioridades de la semana.",
    ],
    "Principios comerciales": [
      "Vende una transformación concreta como propuesta principal.",
      "Entra con un proyecto cerrado, breve y visible.",
      "Propón acompañamiento mensual cuando exista ajuste estratégico.",
      "Comunica eficiencia de estructura y experiencia senior.",
      "Cotiza por alcance y valor; usa horas solo internamente.",
    ],
    "Primer mensaje comercial": [
      "Hola [nombre], vi que [observación específica y respetuosa].",
      "Creo que hay una oportunidad para [resultado concreto de negocio].",
      "En PLANOZERO alineamos estrategia, marca y experiencia digital para empresas en crecimiento.",
      "¿Te haría sentido una conversación breve esta semana?",
    ],
  };
  return (
    <>
      <div className="library-hero">
        <BookOpen size={32} />
        <h2>El criterio también es un activo.</h2>
        <p>
          La estrategia, el método y las herramientas que alinean a nuestro
          equipo.
        </p>
        <a className="button" href="/api/strategy" download>
          <Download size={16} />
          Descargar documento maestro
        </a>
      </div>
      <div className="library-layout">
        <div className="library-nav">
          {Object.keys(guides).map((name) => (
            <button
              key={name}
              className={expanded === name ? "active" : ""}
              onClick={() => setExpanded(name)}
            >
              <FileText size={17} />
              {name}
              <ArrowUpRight size={15} />
            </button>
          ))}
        </div>
        <Panel
          title={expanded}
          eyebrow="PLAYBOOK PLANOZERO"
          action={
            <button
              className="icon-button"
              aria-label="Copiar guía"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    guides[expanded].join("\n\n"),
                  );
                  notify("Guía copiada.");
                } catch {
                  notify("Selecciona el texto para copiarlo.");
                }
              }}
            >
              <Copy size={17} />
            </button>
          }
        >
          <div className="guide-content">
            {guides[expanded].map((line, i) => (
              <div key={line}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <p>{line}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
