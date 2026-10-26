import { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Route,
  Globe2,
  Kanban,
  Layers3,
  ListChecks,
  CalendarDays,
  Handshake,
  ChartNoAxesCombined,
  BookOpen,
  Settings2,
  Search,
  Bell,
  ArrowUpRight,
  Plus,
  ChevronDown,
  Menu,
  CircleDot,
  Check,
  Calculator,
  Moon,
  Sun,
} from "lucide-react";
import { BrandLogo, BrandMark } from "./Brand";
import { useStore } from "./store";
import { Dashboard } from "./Dashboard";
import { Pipeline, Roadmap, Tasks, Content } from "./WorkViews";
import { Markets, Partners, Metrics, Library } from "./StrategyViews";
import { Services, QuoteBuilder } from "./Commercial";
import { LoginPage } from "./LoginPage";
import { Settings } from "./Settings";
import { Editor } from "./Editor";
import { Modal, Avatar, Empty } from "./ui";
import { getMetrics } from "./metrics";
import { today } from "../shared/domain.mjs";
import { canEdit } from "./permissions";
import type { Collection, EditableCollection, EditTarget, Entity, View } from "./types";
const navigation = [
  ["Command Center", LayoutDashboard],
  ["Roadmap", Route],
  ["Mercados", Globe2],
  ["Pipeline", Kanban],
  ["Tareas", ListChecks],
  ["Servicios", Layers3],
  ["Cotizador HH", Calculator],
  ["Contenido", CalendarDays],
  ["Alianzas", Handshake],
  ["Métricas", ChartNoAxesCombined],
  ["Biblioteca", BookOpen],
] as const;
const descriptions: Record<View, string> = {
  "Command Center": "La visión completa. El siguiente movimiento.",
  Roadmap: "De la estrategia a la acción, un hito a la vez.",
  Mercados: "Oportunidades internacionales. Relaciones cercanas.",
  Pipeline: "Cada conversación puede abrir una nueva etapa.",
  Tareas: "Todo lo que mueve la aguja, ordenado por fecha e impacto.",
  "Cotizador HH": "El alcance correcto. Un precio que cuida tu negocio.",
  Servicios: "Estrategia, marca y experiencias digitales con un propósito.",
  Contenido: "Ideas que construyen autoridad y abren conversaciones.",
  Alianzas: "Conecta capacidades. Multiplica oportunidades.",
  Métricas: "Decisiones con datos. Crecimiento con dirección.",
  Biblioteca: "Nuestro conocimiento, siempre a mano.",
  Configuración: "Las bases de tu sistema de crecimiento.",
};
export default function App() {
  const { state, user, ready, toast } = useStore();
  const valid = (s: string) =>
    [...navigation.map((n) => n[0]), "Configuración"].includes(s as any);
  const [view, setView] = useState<View>(() => {
    const s = decodeURIComponent(location.hash.slice(1));
    return valid(s) ? (s as View) : "Command Center";
  });
  const [market, setMarket] = useState("Todos");
  const [owner, setOwner] = useState("Todos");
  const [period, setPeriod] = useState("Este mes");
  const [target, setTarget] = useState<EditTarget | null>(null);

  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [alerts, setAlerts] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [newMenu, setNewMenu] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );
  const closeEditor = useCallback(() => setTarget(null), []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("pz-theme", theme);
    } catch {}
  }, [theme]);

  const closeSearch = useCallback(() => setSearch(false), []);
  const closeAlerts = useCallback(() => setAlerts(false), []);
  function navigate(next: View) {
    setView(next);
    location.hash = next;
    setMobile(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function edit(t: EditTarget) {
    setTarget(t);
    setNewMenu(false);
    setSearch(false);
  }
  useEffect(() => {
    function hash() {
      const value = decodeURIComponent(location.hash.slice(1));
      if (valid(value)) setView(value as View);
    }
    window.addEventListener("hashchange", hash);
    function keys(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
    }
    window.addEventListener("keydown", keys);
    return () => {
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("keydown", keys);
    };
  }, []);
  const external = user?.role === "Colaborador externo";
  useEffect(() => {
    if (
      external &&
      !["Roadmap", "Tareas", "Contenido", "Biblioteca", "Configuración"].includes(
        view,
      )
    )
      navigate("Roadmap");
  }, [external, view]);
  const props = { market, owner, period, edit };
  const alertsList: ReturnType<typeof getMetrics>["alerts"] = external
    ? []
    : getMetrics(state, market, owner, period).alerts;
  const owners = Array.from(
    new Set([
      ...(state.team || []).map((u) => u.name),
      ...["prospects", "initiatives", "tasks", "content", "partners"].flatMap(
        (c) => (state[c as Collection] || []).map((p) => p.owner),
      ),
    ]),
  ).filter(Boolean);
  const searchCollections: [EditableCollection, string][] = [
    ["prospects", "Prospecto"],
    ["initiatives", "Iniciativa"],
    ["content", "Contenido"],
    ["partners", "Alianza"],
    ["tasks", "Tarea"],
    ["offers", "Oferta"],
    ["projects", "Proyecto"],
  ];
  const found = searchCollections
    .flatMap(([collection, label]) =>
      state[collection]
        .filter((e) => e.name.toLowerCase().includes(query.toLowerCase()))
        .map((item) => ({ collection, label, item })),
    )
    .slice(0, 20);
  if (!ready)
    return (
      <div className="loading-screen">
        <BrandMark className="brand-icon" />
        <span>Preparando tu siguiente movimiento…</span>
      </div>
    );
  if (!user) return <LoginPage />;
  return (
    <div className="app-shell">
      {mobile && (
        <div className="nav-overlay" onClick={() => setMobile(false)} />
      )}
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <a
          className="brand"
          href="#Command%20Center"
          onClick={() => navigate("Command Center")}
          aria-label="PLANOZERO Command Center"
        >
          <BrandLogo className="brand-logo" />
          <span className="brand-caption">GROWTH OPERATING SYSTEM</span>
        </a>
        <button
          className="workspace-switch"
          onClick={() => navigate("Configuración")}
        >
          <span className="workspace-icon">PZ</span>
          <span>
            <strong>{state.settings.name || "PLANOZERO"}</strong>
            <small>Workspace del equipo</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Navegación principal">
          {navigation
            .filter(
              ([name]) =>
                !external ||
                ["Roadmap", "Tareas", "Contenido", "Biblioteca"].includes(name),
            )
            .map(([name, Icon]) => (
              <button
                className={`nav-item ${view === name ? "active" : ""} ${name === "Métricas" ? "nav-separated" : ""}`}
                key={name}
                onClick={() => navigate(name)}
              >
                <Icon size={18} />
                <span>{name}</span>
                {name === "Pipeline" && (
                  <span className="nav-counter">
                    {
                      state.prospects.filter(
                        (p) =>
                          !["Ganado", "Perdido", "Nurture"].includes(p.stage),
                      ).length
                    }
                  </span>
                )}
                {view === name && <i />}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="growth-note">
            <span>
              <i className="live-dot" />
              EXPANSIÓN INTERNACIONAL
            </span>
            <p>
              El siguiente nivel
              <br />
              se construye hoy.
            </p>
            <div>
              <span>CL</span>
              <i />
              <span>ES</span>
              <i />
              <span>US</span>
              <ArrowUpRight size={15} />
            </div>
          </div>
          <button
            className={`nav-item ${view === "Configuración" ? "active" : ""}`}
            onClick={() => navigate("Configuración")}
          >
            <Settings2 size={18} />
            <span>Configuración</span>
          </button>
          <button
            className="sidebar-user"
            onClick={() => navigate("Configuración")}
          >
            <Avatar name={user.name} />
            <span>
              <strong>{user?.name}</strong>
              <small>{user?.role}</small>
            </span>
            <ArrowUpRight size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobile(true)}
            aria-label="Abrir navegación"
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumbs">
            <span>Workspace</span>
            <span>/</span>
            <strong>{view}</strong>
          </div>
          <div className="topbar-right">
            <span className="date-top">
              {new Date(today() + "T12:00:00Z").toLocaleDateString("es-CL", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "UTC",
              })}
            </span>
            <button
              className="search-trigger"
              onClick={() => setSearch(true)}
              aria-label="Buscar en el espacio"
            >
              <Search size={17} />
              <span>Buscar</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="icon-button theme-toggle"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              aria-label={
                theme === "light" ? "Activar modo oscuro" : "Activar modo claro"
              }
              title={
                theme === "light" ? "Activar modo oscuro" : "Activar modo claro"
              }
            >
              {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            <span className="topbar-divider" />
            <button
              className="icon-button notifications"
              onClick={() => setAlerts(true)}
              aria-label={`Alertas: ${alertsList.length}`}
            >
              <Bell size={19} />
              {alertsList.length > 0 && <i />}
            </button>
            <button
              className="profile-button"
              onClick={() => navigate("Configuración")}
              aria-label="Mi cuenta"
            >
              <Avatar small name={user.name} />
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                PLANOZERO / GROWTH OS <span className="heading-slash">—</span>{" "}
                <span>
                  {view === "Command Center"
                    ? "VISIÓN GENERAL"
                    : view.toUpperCase()}
                </span>
              </div>
              <h1>
                {view}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {external && view === "Configuración"
                  ? "Tu cuenta y seguridad."
                  : descriptions[view]}
              </p>
            </div>
            <div className="heading-actions">
              {!external && (
                <div className="new-wrapper">
                  <button
                    className="button primary"
                    onClick={() => setNewMenu((v) => !v)}
                    aria-expanded={newMenu}
                  >
                    <Plus size={16} />
                    Crear nuevo
                    <ChevronDown size={13} />
                  </button>
                  {newMenu && (
                    <>
                      <div
                        className="menu-dismiss"
                        onClick={() => setNewMenu(false)}
                      />
                      <div className="new-menu">
                        {[
                          ["prospects", "Prospecto"],
                          ["initiatives", "Iniciativa"],
                          ["tasks", "Tarea"],
                          ["content", "Publicación"],
                          ["partners", "Alianza"],
                        ]
                          .filter(([c]) => canEdit(user, c as EditableCollection))
                          .map(([collection, label]) => (
                            <button
                              key={collection}
                              onClick={() =>
                                edit({ collection: collection as EditableCollection })
                              }
                            >
                              <Plus size={14} />
                              {label}
                            </button>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          {!["Configuración", "Biblioteca", "Servicios", "Cotizador HH"].includes(view) && (
            <div className="global-filters">
              <div className="filter-group">
                <Globe2 size={14} />
                <select
                  aria-label="Mercado"
                  value={market}
                  onChange={(e) => setMarket(e.target.value)}
                >
                  <option value="Todos">Todos los mercados</option>
                  <option>España</option>
                  <option>US Hispanic</option>
                  <option>Chile</option>
                </select>
              </div>
              <div className="filter-group">
                <UsersIcon />
                <select
                  aria-label="Responsable"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                >
                  <option value="Todos">Todo el equipo</option>
                  {owners.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
              {["Command Center", "Métricas"].includes(view) && (
                <div className="filter-group period-filter">
                  <CalendarDays size={14} />
                  <select
                    aria-label="Periodo"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                  >
                    {["Esta semana", "Este mes", "Este trimestre", "Todo"].map(
                      (p) => (
                        <option key={p}>{p}</option>
                      ),
                    )}
                  </select>
                </div>
              )}
              <span className="filter-context">
                {market === "Todos"
                  ? "VISIÓN INTERNACIONAL"
                  : market.toUpperCase()}
              </span>
            </div>
          )}
          <div className="view-content" key={view}>
            {view === "Command Center" && (
              <Dashboard {...props} navigate={navigate} />
            )}
            {view === "Pipeline" && <Pipeline {...props} />}
            {view === "Tareas" && <Tasks {...props} />}
            {view === "Roadmap" && <Roadmap {...props} />}
            {view === "Mercados" && <Markets {...props} />}
            {view === "Servicios" && <Services edit={edit} quote={(service) => { sessionStorage.setItem("pz-quote-service", service.id); navigate("Cotizador HH"); }} />}
            {view === "Cotizador HH" && <QuoteBuilder />}
            {view === "Contenido" && <Content {...props} />}
            {view === "Alianzas" && <Partners {...props} />}
            {view === "Métricas" && <Metrics {...props} />}
            {view === "Biblioteca" && <Library />}
            {view === "Configuración" && (
              <Settings />
            )}
          </div>
        </main>
      </div>
      {target && (
        <Editor
          key={`${target.collection}-${target.item?.id || "new"}`}
          target={target}
          close={closeEditor}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {search && (
        <Modal title="Encuentra tu siguiente movimiento" close={closeSearch}>
          <div className="search-modal">
            <label className="search-field">
              <Search size={19} />
              <input
                autoFocus
                placeholder="Busca oportunidades, iniciativas, contenido…"
                aria-label="Búsqueda global"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="search-results">
              {found.map(({ item, collection, label }) => (
                <button
                  key={item.id}
                  onClick={() => edit({ collection, item })}
                >
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {label} · {item.market || "Catálogo"}
                    </small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
              {!found.length && (
                <Empty
                  title="Sin resultados"
                  text="Prueba con otro nombre o crea un registro."
                />
              )}
            </div>
          </div>
        </Modal>
      )}
      {alerts && (
        <Modal title="Lo que necesita tu atención" close={closeAlerts} drawer>
          <div className="alerts-list">
            {alertsList.map((a, i) => (
              <button
                key={i}
                onClick={() => {
                  setAlerts(false);
                  if (a.prospect)
                    edit({ collection: "prospects", item: a.prospect });
                  else navigate("Métricas");
                }}
              >
                <span className="alert-symbol">
                  <CircleDot size={18} />
                </span>
                <span>
                  <strong>{a.title}</strong>
                  <p>{a.text}</p>
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
            {!alertsList.length && (
              <Empty
                title="Todo bajo control"
                text="No hay alertas para los filtros seleccionados."
              />
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
function UsersIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m3 10v-3a6 6 0 0 0-2-4" />
    </svg>
  );
}
