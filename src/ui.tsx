import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpRight, X, Check, Inbox, Plus } from "lucide-react";
import { businessDate, csvString, convert } from "../shared/domain.mjs";
import type { Entity, Settings } from "./types";
export const money = (value: number, currency = "USD", compact = false) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    ...(compact ? { notation: "compact" as const } : {}),
  }).format(value);
export const amount = (value: number) =>
  new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(value);
export const dateLabel = (date: string, full = false) => {
  const day = businessDate(date);
  return day
    ? new Date(day + "T12:00:00").toLocaleDateString("es-CL", {
        day: "numeric",
        month: full ? "long" : "short",
      })
    : "Sin fecha";
};
export const toBase = (item: Entity, settings: Settings) =>
  convert(item.value || 0, item.currency, settings.baseCurrency, settings);
export const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("");
export function Avatar({
  name,
  small = false,
}: {
  name: string;
  small?: boolean;
}) {
  return (
    <span className={`avatar ${small ? "small" : ""}`} title={name}>
      {initials(name)}
    </span>
  );
}
export function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Status({ value }: { value: string }) {
  return (
    <Badge
      tone={
        ["Ganado", "Completado", "Activo", "Publicado"].includes(value)
          ? "green"
          : ["Bloqueado", "Perdido", "Alta"].includes(value)
            ? "red"
            : [
                  "En curso",
                  "Propuesta enviada",
                  "Programado",
                  "Negociación",
                ].includes(value)
              ? "orange"
              : ""
      }
    >
      <i />
      {value}
    </Badge>
  );
}
export function Panel({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-header">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Empty({
  title = "Aquí comienza el próximo movimiento",
  text = "Crea un registro para empezar a construir tu sistema de crecimiento.",
  action,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Inbox size={28} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function LinkButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-button" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} />
    </button>
  );
}
export function AddButton({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button disabled={disabled} className="button primary" onClick={onClick}>
      <Plus size={16} />
      {children}
    </button>
  );
}
export function Progress({
  value,
  subtle = false,
}: {
  value: number;
  subtle?: boolean;
}) {
  return (
    <div
      className={`progress ${subtle ? "subtle" : ""}`}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
  wide = false,
  drawer = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(
      () =>
        ref.current
          ?.querySelector<HTMLElement>("input, button, select, textarea")
          ?.focus(),
      30,
    );
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const list = ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input, select, textarea, a[href]",
        );
        if (!list?.length) return;
        const first = list[0],
          last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", key);
      document.body.style.overflow = bodyOverflow;
      previous?.focus();
    };
  }, [close]);
  return (
    <div
      className={`modal-backdrop ${drawer ? "drawer-backdrop" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={`modal ${wide ? "wide" : ""} ${drawer ? "drawer" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={close} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function downloadCSV(rows: Record<string, any>[], filename: string) {
  const blob = new Blob([csvString(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename + ".csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function TaskCheck({
  checked,
  onClick,
  label,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      className={`task-check ${checked ? "checked" : ""}`}
      onClick={onClick}
      aria-label={label}
      aria-pressed={checked}
    >
      {checked && <Check size={13} />}
    </button>
  );
}
