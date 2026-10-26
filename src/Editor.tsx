import { useState } from "react";
import {
  Save,
  Trash2,
  Plus,
  CalendarDays,
  ArrowUpRight,
} from "lucide-react";
import { useStore } from "./store";
import {
  MARKETS,
  PHASES,
  STAGES,
  STATUSES,
  today,
  dateOffset,
} from "../shared/domain.mjs";
import { Modal, Status, dateLabel, money, Avatar } from "./ui";
import { zodMessages } from "../shared/errors.mjs";
import type { EditTarget, Entity } from "./types";
import { canEdit } from "./permissions";
type Field = {
  key: string;
  label: string;
  type?: string;
  options?: string[] | { value: string; label: string }[];
  required?: boolean;
  full?: boolean;
  min?: number;
  max?: number;
  hint?: string;
};
const text = (
  key: string,
  label: string,
  extra: Partial<Field> = {},
): Field => ({ key, label, ...extra });
export function Editor({
  target,
  close,
}: {
  target: EditTarget;
  close: () => void;
}) {
  const { state, save, remove, activity, user } = useStore();
  const { collection, item } = target;
  const writable = canEdit(user, collection, item);
  const defaultOwner = user?.name || "";
  const owners =
    user?.role === "Colaborador externo"
      ? [defaultOwner]
      : Array.from(
          new Set([
            defaultOwner,
            "Dirección",
            ...(state.team || []).map((t) => t.name),
            ...state.prospects.map((p) => p.owner),
          ]),
        );
  const common = [
    text("name", collection === "prospects" ? "Nombre de empresa" : "Nombre", {
      required: true,
      full: true,
    }),
    text("market", "Mercado", {
      options: collection === "prospects" ? MARKETS : ["Todos", ...MARKETS],
    }),
    text("owner", "Responsable", { options: owners }),
  ];
  const defaults: Record<string, Record<string, any>> = {
    prospects: {
      name: "",
      market: "España",
      owner: defaultOwner,
      city: "",
      sector: "",
      contact: "",
      url: "",
      signal: "",
      pain: "",
      offerId: state.offers[0]?.id || "",
      stage: "Investigado",
      value: 0,
      currency: "EUR",
      probability: 10,
      nextAction: "",
      nextDate: dateOffset(1),
      source: "Outbound",
      fit: "Alto",
    },
    initiatives: {
      name: "",
      market: "Todos",
      owner: defaultOwner,
      phase: 1,
      start: today(),
      end: dateOffset(14),
      status: "Pendiente",
      progress: 0,
      objective: "",
      kpi: "",
      type: "Comercial",
      dependencies: "",
    },
    tasks: {
      name: "",
      market: "Todos",
      owner: defaultOwner,
      date: today(),
      status: "Pendiente",
      priority: "Media",
    },
    content: {
      name: "",
      market: "Todos",
      owner: defaultOwner,
      channel: "LinkedIn",
      format: "Carrusel",
      pillar: "Estrategia",
      cta: "",
      date: today(),
      status: "Idea",
      result: "",
    },
    partners: {
      name: "",
      market: "España",
      owner: defaultOwner,
      type: "Fractional CMO",
      service: "",
      status: "Identificado",
      model: "Referidos",
      nextAction: "",
      date: dateOffset(3),
    },
    projects: {
      name: "",
      market: "España",
      owner: defaultOwner,
      prospectId: "",
      offerId: "",
      value: 0,
      currency: "EUR",
      recurring: false,
      status: "Activo",
      hours: 24,
      cost: 0,
      date: today(),
      renewalDate: dateOffset(30),
      reviewDate: dateOffset(21),
      checklist: [],
    },
    offers: {
      name: "",
      subtitle: "",
      description: "",
      eurMin: 0,
      eurMax: 0,
      usdMin: 0,
      usdMax: 0,
      clpMin: 0,
      clpMax: 0,
      duration: "",
      hours: 24,
      margin: 60,
      deliverables: "",
      recurring: false,
    },
  };
  const [values, setValues] = useState<Record<string, any>>({
    ...defaults[collection],
    ...item,
    ...target.defaults,
  });
  const [tab, setTab] = useState("Detalles");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState("Nota");
  const [noteDate, setNoteDate] = useState(today());
  const actualItem = state[collection].find((e) => e.id === item?.id) || item;
  const fields: Record<string, Field[]> = {
    prospects: [
      ...common,
      text("city", "Ciudad"),
      text("sector", "Sector"),
      text("contact", "Contacto y cargo"),
      text("url", "Web / LinkedIn", { type: "url" }),
      text("signal", "Señal de oportunidad", { type: "textarea", full: true }),
      text("pain", "Dolor observado", { type: "textarea", full: true }),
      text("fit", "Ajuste con ICP", { options: ["Alto", "Medio", "Bajo"] }),
      text("source", "Origen", {
        options: ["Outbound", "Referido", "Contenido", "Alianza", "Inbound"],
      }),
      text("offerId", "Oferta recomendada", {
        options: state.offers.map((o) => ({ value: o.id, label: o.name })),
        full: true,
      }),
      text("stage", "Etapa", { options: STAGES }),
      text("probability", "Probabilidad (%)", {
        type: "number",
        min: 0,
        max: 100,
      }),
      text("value", "Valor estimado", { type: "number", min: 0 }),
      text("currency", "Moneda", { options: ["EUR", "USD", "CLP"] }),
      text("nextAction", "Próxima acción", { full: true }),
      text("nextDate", "Fecha de próxima acción", { type: "date" }),
    ],
    initiatives: [
      ...common,
      text("phase", "Fase", {
        type: "number-select",
        options: PHASES.map((p, i) => ({
          value: String(i + 1),
          label: `0${i + 1} · ${p}`,
        })),
      }),
      text("type", "Tipo de iniciativa", {
        options: ["Comercial", "Marca y contenido", "Operaciones", "Alianzas"],
      }),
      text("objective", "Objetivo", { type: "textarea", full: true }),
      text("start", "Fecha inicio", { type: "date", required: true }),
      text("end", "Fecha fin", { type: "date", required: true }),
      text("status", "Estado", { options: STATUSES }),
      text("progress", "Progreso (%)", { type: "number", min: 0, max: 100 }),
      text("kpi", "KPI de término", { full: true }),
      text("dependencies", "Depende de", {
        options: [
          { value: "", label: "Sin dependencias" },
          ...state.initiatives
            .filter((e) => e.id !== item?.id)
            .map((e) => ({ value: e.id, label: e.name })),
        ],
        full: true,
      }),
    ],
    tasks: [
      ...common,
      text("date", "Fecha límite", { type: "date", required: true }),
      text("priority", "Prioridad", { options: ["Alta", "Media", "Baja"] }),
      text("status", "Estado", { options: STATUSES }),
    ],
    content: [
      ...common,
      text("channel", "Canal", { options: ["LinkedIn", "Instagram"] }),
      text("format", "Formato", {
        options: ["Carrusel", "Post", "Artículo", "Reel", "Story", "Video"],
      }),
      text("pillar", "Pilar", {
        options: ["Estrategia", "Marca", "Casos", "Metodología", "Cultura"],
      }),
      text("date", "Fecha de publicación", { type: "date", required: true }),
      text("cta", "Llamado a la acción", { full: true }),
      text("status", "Estado", {
        options: [
          "Idea",
          "En diseño",
          "En revisión",
          "Programado",
          "Publicado",
        ],
      }),
      text("result", "Resultado", {
        type: "textarea",
        full: true,
        hint: "Impresiones, interacciones, leads u observaciones.",
      }),
    ],
    partners: [
      ...common,
      text("type", "Tipo de aliado", {
        options: [
          "Fractional CMO",
          "Developer",
          "Agencia de performance",
          "Consultor",
          "Cámara de comercio",
          "Comunidad de founders",
        ],
      }),
      text("service", "Servicio complementario"),
      text("status", "Estado", {
        options: ["Identificado", "Conversación", "Activo", "Pausado"],
      }),
      text("model", "Modelo de colaboración", {
        options: ["Referidos", "Colaboración", "Revenue share", "Marca blanca"],
      }),
      text("nextAction", "Próximo paso", { full: true }),
      text("date", "Fecha de seguimiento", { type: "date" }),
    ],
    projects: [
      ...common,
      text("value", "Ingreso proyectado / mensual", { type: "number", min: 0 }),
      text("currency", "Moneda", { options: ["USD", "EUR", "CLP"] }),
      text("cost", "Costo directo estimado", {
        type: "number",
        min: 0,
        hint: "En la moneda del proyecto. 0 significa aún sin registrar.",
      }),
      text("hours", "Horas comprometidas este mes", { type: "number", min: 0 }),
      text("status", "Estado", {
        options: ["Activo", "Completado", "Pausado"],
      }),
      text("recurring", "Retainer mensual", { type: "checkbox" }),
      text("date", "Fecha de cierre", { type: "date" }),
      text("reviewDate", "Revisión estratégica", { type: "date" }),
      text("renewalDate", "Renovación", { type: "date" }),
    ],
    offers: [
      text("name", "Nombre de la oferta", { required: true, full: true }),
      text("subtitle", "Promesa", { full: true }),
      text("description", "Descripción", { type: "textarea", full: true }),
      ...["eur", "usd", "clp"].flatMap((c) => [
        text(`${c}Min`, `${c.toUpperCase()} mínimo`, {
          type: "number",
          min: 0,
        }),
        text(`${c}Max`, `${c.toUpperCase()} máximo`, {
          type: "number",
          min: 0,
        }),
      ]),
      text("duration", "Tiempo estimado"),
      text("hours", "Horas internas estimadas", { type: "number", min: 0 }),
      text("margin", "Margen objetivo (%)", {
        type: "number",
        min: 0,
        max: 100,
      }),
      text("recurring", "Retainer mensual", { type: "checkbox" }),
      text("deliverables", "Entregables (uno por línea)", {
        type: "textarea",
        full: true,
      }),
    ],
  };
  const labels = {
    prospects: "prospecto",
    initiatives: "iniciativa",
    tasks: "tarea",
    content: "publicación",
    partners: "alianza",
    projects: "proyecto",
    offers: "oferta",
  };
  function change(field: Field, value: any) {
    setValues((prev) => {
      const next = { ...prev, [field.key]: value };
      if (field.key === "market" && collection === "prospects")
        next.currency =
          value === "España" ? "EUR" : value === "Chile" ? "CLP" : "USD";
      if (
        field.key === "status" &&
        value === "Completado" &&
        collection === "initiatives"
      )
        next.progress = 100;
      if (field.key === "stage" && ["Ganado", "Perdido"].includes(value))
        next.probability = value === "Ganado" ? 100 : 0;
      return next;
    });
  }
  const errorMessage = (e: any) =>
    e.issues ? zodMessages(e) : e.message;
  return (
    <Modal
      title={item ? item.name : `Crear ${labels[collection]}`}
      close={close}
      drawer
    >
      {collection === "prospects" && item && (
        <div className="detail-summary">
          <div className="company-mark">
            {item.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <Status value={actualItem?.stage || item.stage} />
            <p>
              {item.city} · {item.market}
            </p>
          </div>
          <strong>{money(actualItem?.value || 0, item.currency)}</strong>
        </div>
      )}
      {collection === "prospects" && item && (
        <div className="tabs drawer-tabs">
          {["Detalles", "Actividad", "Proyecto"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={tab === t ? "active" : ""}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      {!writable && (
        <div className="info-box read-only-note">
          Vista de consulta. Tu rol no permite editar este registro.
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {tab === "Detalles" && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setError("");
            try {
              await save(collection, values, item);
              close();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="form-grid">
            {fields[collection].map((f) => (
              <label
                className={`field ${f.full ? "full" : ""} ${f.type === "checkbox" ? "checkbox-field" : ""}`}
                key={f.key}
              >
                <span>
                  {f.label}
                  {f.required && <b> *</b>}
                </span>
                {f.options ? (
                  <select
                    disabled={!writable}
                    value={values[f.key] ?? ""}
                    onChange={(e) =>
                      change(
                        f,
                        f.type === "number-select"
                          ? Number(e.target.value)
                          : e.target.value,
                      )
                    }
                  >
                    {f.options.map((o) =>
                      typeof o === "string" ? (
                        <option key={o}>{o}</option>
                      ) : (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ),
                    )}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    disabled={!writable}
                    rows={3}
                    value={values[f.key] ?? ""}
                    onChange={(e) => change(f, e.target.value)}
                  />
                ) : f.type === "checkbox" ? (
                  <input
                    disabled={!writable}
                    type="checkbox"
                    checked={!!values[f.key]}
                    onChange={(e) => change(f, e.target.checked)}
                  />
                ) : (
                  <input
                    disabled={!writable}
                    type={f.type || "text"}
                    value={values[f.key] ?? ""}
                    required={f.required}
                    min={f.min}
                    max={f.max}
                    step={f.type === "number" ? "any" : undefined}
                    onChange={(e) =>
                      change(
                        f,
                        f.type === "number"
                          ? Number(e.target.value)
                          : e.target.value,
                      )
                    }
                  />
                )}
                {f.hint && <small>{f.hint}</small>}
              </label>
            ))}
          </div>
          {collection === "prospects" &&
            values.stage === "Ganado" &&
            item?.stage !== "Ganado" && (
              <div className="info-box">
                Al guardar se creará un proyecto con tareas de onboarding y una
                revisión estratégica a 21 días.
              </div>
            )}
          <div className="form-footer">
            {item && writable && (
              <button
                className="icon-button danger"
                type="button"
                aria-label="Eliminar registro"
                onClick={() => setDeleting(true)}
              >
                <Trash2 size={18} />
              </button>
            )}
            <button className="button" type="button" onClick={close}>
              Cancelar
            </button>
            <button className="button primary" disabled={saving || !writable}>
              <Save size={15} />
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
          {deleting && (
            <div className="delete-confirm">
              <p>¿Eliminar este registro? Esta acción no se puede deshacer.</p>
              <button
                className="button"
                type="button"
                onClick={() => setDeleting(false)}
              >
                Conservar
              </button>
              <button
                className="button danger"
                type="button"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await remove(collection, item!);
                    close();
                  } catch (err) {
                    setError(errorMessage(err));
                    setDeleting(false);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Eliminar registro
              </button>
            </div>
          )}
        </form>
      )}
      {tab === "Actividad" && item && (
        <div className="drawer-body">
          {writable && (
            <form
              className="activity-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setSaving(true);
                try {
                  await activity(item, {
                    name: note,
                    type: noteType,
                    date: noteDate,
                  });
                  setNote("");
                } catch (err) {
                  setError(errorMessage(err));
                } finally {
                  setSaving(false);
                }
              }}
            >
              <div className="form-grid">
                <label className="field">
                  <span>Tipo</span>
                  <select
                    value={noteType}
                    onChange={(e) => setNoteType(e.target.value)}
                  >
                    {["Nota", "Llamada", "Reunión", "Email", "Propuesta"].map(
                      (t) => (
                        <option key={t}>{t}</option>
                      ),
                    )}
                  </select>
                </label>
                <label className="field">
                  <span>Fecha</span>
                  <input
                    aria-label="Fecha de actividad"
                    type="date"
                    required
                    value={noteDate}
                    onChange={(e) => setNoteDate(e.target.value)}
                  />
                </label>
                <label className="field full">
                  <span>Detalle de actividad</span>
                  <textarea
                    placeholder="Qué ocurrió y cuál es el siguiente paso…"
                    required
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
              </div>
              <button className="button primary" disabled={saving}>
                <Plus size={15} />
                Registrar actividad
              </button>
            </form>
          )}
          <div className="history">
            {[...(actualItem?.history || [])].reverse().map((h: any) => (
              <div className="history-item" key={h.id}>
                <Avatar small name={h.author} />
                <div>
                  <strong>{h.type}</strong>
                  <p>{h.text}</p>
                  <small>
                    {h.author} · {dateLabel(h.date)}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === "Proyecto" && item && (
        <div className="drawer-body">
          {state.projects.filter((p) => p.prospectId === item.id).length ? (
            state.projects
              .filter((p) => p.prospectId === item.id)
              .map((p) => (
                <div key={p.id}>
                  <Status value={p.status} />
                  <h3>{p.name}</h3>
                  <p>{state.offers.find((o) => o.id === p.offerId)?.name}</p>
                  <div className="project-facts">
                    <span>{p.hours} h comprometidas</span>
                    <span>
                      {money(p.value, p.currency)}
                      {p.recurring ? " / mes" : ""}
                    </span>
                  </div>
                  <h4>Onboarding</h4>
                  {state.tasks
                    .filter((t) => t.prospectId === item.id)
                    .map((t) => (
                      <div className="simple-row" key={t.id}>
                        <span>{t.name.split(" — ")[0]}</span>
                        <Status value={t.status} />
                      </div>
                    ))}
                  <p>
                    <CalendarDays size={14} /> Revisión estratégica:{" "}
                    {dateLabel(p.reviewDate, true)}
                  </p>
                </div>
              ))
          ) : (
            <div className="empty">
              <ArrowUpRight />
              <h3>El próximo paso es ganar</h3>
              <p>
                Al mover esta oportunidad a Ganado, se creará automáticamente su
                proyecto.
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
