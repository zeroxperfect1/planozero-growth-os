import { useEffect, useState } from "react";
import {
  Save,
  Users,
  Plus,
  LogOut,
  ShieldCheck,
  ArrowUpRight,
  KeyRound,
} from "lucide-react";
import { useStore, api } from "./store";
import { Panel, Avatar, Badge, Modal } from "./ui";
import { isCompanyEmail, normalizeEmail } from "../shared/auth.mjs";
import type { Settings as SettingsType, User } from "./types";
export function Settings() {
  const { state, user, updateSettings, logout, notify, refresh } =
    useStore();
  const [values, setValues] = useState<SettingsType>(state.settings);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [team, setTeam] = useState<User[]>([]);
  const [add, setAdd] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [credentials, setCredentials] = useState<any[] | null>(null);
  const [passwordError, setPasswordError] = useState("");
  const admin = user?.role === "Dirección";
  const external = user?.role === "Colaborador externo";
  useEffect(() => {
    if (admin)
      api("/users")
        .then(setTeam)
        .catch((e: Error) => setError(e.message));
  }, [admin]);
  const fields = [
    ["agencyCommission", "Comisión de agencia recomendada (% del neto)", "number"],
    ["name", "Nombre del equipo", "text"],
    ["baseCurrency", "Moneda de reporting", "select"],
    ["monthlyTarget", "Meta mensual de ingresos", "number"],
    ["meetingTarget", "Meta de reuniones por periodo", "number"],
    ["teamHours", "Capacidad mensual del equipo (h)", "number"],
    ["roadmapStart", "Inicio del roadmap", "date"],
    ["eurUsd", "1 EUR equivale a USD", "number"],
    ["usdClp", "1 USD equivale a CLP", "number"],
    ["ratesDate", "Fecha de referencia de las tasas", "date"],
  ];
  return (
    <div className={`settings-layout ${external ? "settings-account" : ""}`}>
      {!external && (
      <Panel title="El sistema a tu medida" eyebrow="ESPACIO DE TRABAJO">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setError("");
            try {
              await updateSettings(values);
            } catch (err: any) {
              setError(err.message);
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="form-grid">
            {fields.map(([key, label, type]) => (
              <label className="field" key={key}>
                <span>{label}</span>
                {type === "select" ? (
                  <select
                    disabled={!admin}
                    value={values.baseCurrency}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, baseCurrency: e.target.value }))
                    }
                  >
                    {["USD", "EUR", "CLP"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    disabled={!admin}
                    type={type}
                    required
                    min={type === "number" ? ".0001" : undefined}
                    step={type === "number" ? "any" : undefined}
                    value={values[key as keyof SettingsType]}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        [key]:
                          type === "number"
                            ? Number(e.target.value)
                            : e.target.value,
                      }))
                    }
                  />
                )}
              </label>
            ))}
          </div>
          <div className="info-box">
            Las tasas son supuestos de planificación editables; no se actualizan
            automáticamente. Cambiar la moneda de reporting convierte las
            métricas, pero debes ajustar la meta mensual a esa moneda.
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-footer">
            <button className="button primary" disabled={saving || !admin}>
              <Save size={15} />
              {saving ? "Guardando…" : "Guardar configuración"}
            </button>
          </div>
        </form>
      </Panel>
      )}
      <div>
        <Panel title={external ? "Mi cuenta" : "Equipo y acceso"} action={<Users size={18} />}>
          <div className="settings-team">
            <>
                <div className="user-profile">
                  <Avatar name={user!.name} />
                  <div>
                    <strong>{user!.name}</strong>
                    <small>{user!.email}</small>
                  </div>
                </div>
                <Badge>
                  <ShieldCheck size={13} />
                  {user?.role}
                </Badge>
                {team.map((u) => (
                  <div className="team-row" key={u.id}>
                    <Avatar small name={u.name} />
                    <div>
                      <strong>{u.name}</strong>
                      <small>{u.role}</small>
                    </div>
                    {admin && u.id !== user?.id && (
                      <button
                        className="text-button"
                        onClick={() => {
                          setResetUser(u);
                          setPasswordError("");
                        }}
                      >
                        Restablecer clave
                      </button>
                    )}
                  </div>
                ))}
                {admin && (
                  <>
                    <button
                      className="button"
                      disabled={saving}
                      onClick={async () => {
                        setSaving(true);
                        setError("");
                        try {
                          const result = await api(
                            "/users/provision-executives",
                            "POST",
                            {},
                          );
                          setCredentials(result.users);
                          setTeam(await api("/users"));
                          await refresh();
                        } catch (err: any) {
                          setError(err.message);
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      <Users size={15} />
                      Generar cuentas de Raúl, Vale y Dany
                    </button>
                    <button className="button" onClick={() => setAdd(true)}>
                      <Plus size={15} />
                      Agregar integrante
                    </button>
                  </>
                )}
                <button
                  className="button"
                  onClick={() => {
                    setChangePasswordOpen(true);
                    setPasswordError("");
                  }}
                >
                  <KeyRound size={15} />
                  Cambiar mi contraseña
                </button>
                <button
                  className="button subtle"
                  onClick={() => logout().catch((e) => notify(e.message))}
                >
                  <LogOut size={15} />
                  Cerrar sesión
                </button>
              </>
          </div>
        </Panel>
        {!external && (
          <div className="settings-note">
            <ShieldCheck size={18} />
            <p>
              Los datos del equipo se guardan en el servidor. Cada
              integrante utiliza su propia cuenta.
            </p>
          </div>
        )}
      </div>
      {add && (
        <Modal title="Agregar integrante" close={() => setAdd(false)}>
          <form
            className="auth-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const formValues = Object.fromEntries(new FormData(form));
              formValues.email = normalizeEmail(String(formValues.email || ""));
              if (!isCompanyEmail(String(formValues.email || ""))) {
                setError("El correo debe pertenecer a @planozero.cl.");
                return;
              }
              setSaving(true);
              setError("");
              try {
                await api("/users", "POST", formValues);
                setTeam(await api("/users"));
                await refresh();
                setAdd(false);
                notify(
                  "Integrante creado. Comparte su acceso de forma privada.",
                );
              } catch (err: any) {
                setError(err.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <label className="field">
              <span>Nombre único</span>
              <input name="name" required />
            </label>
            <label className="field">
              <span>Correo @planozero.cl</span>
              <input
                name="email"
                type="email"
                placeholder="raul@planozero.cl"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
              />
            </label>
            <label className="field">
              <span>Contraseña inicial · mínimo 10 caracteres</span>
              <input
                name="password"
                type="password"
                minLength={10}
                required
                autoComplete="new-password"
              />
            </label>
            <label className="field">
              <span>Rol</span>
              <select name="role">
                {[
                  "Comercial",
                  "Estrategia / Diseño",
                  "Colaborador externo",
                  "Dirección",
                ].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="button primary" disabled={saving}>
              Crear integrante
            </button>
          </form>
        </Modal>
      )}
      {credentials && (
        <Modal title="Cuentas de ejecutivos" close={() => setCredentials(null)}>
          <p className="info-box">
            Guarda las claves ahora y entrégalas por un canal privado. Por
            seguridad, no volverán a mostrarse. Si cierras sin guardarlas,
            restablécelas desde la lista del equipo.
          </p>
          <div className="settings-team">
            {credentials.map((u) => (
              <div className="team-row" key={u.email}>
                <div>
                  <strong>{u.name}</strong>
                  <small>{u.email} · {u.role}</small>
                  <code>
                    {u.created
                      ? u.password
                      : "La cuenta ya existía; su clave se conservó."}
                  </code>
                </div>
              </div>
            ))}
          </div>
          <button className="button primary" onClick={() => setCredentials(null)}>
            Listo, ya guardé las claves
          </button>
        </Modal>
      )}
      {changePasswordOpen && (
        <Modal
          title="Cambiar mi contraseña"
          close={() => setChangePasswordOpen(false)}
        >
          <form
            className="auth-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const values = Object.fromEntries(new FormData(e.currentTarget));
              const currentPassword = String(values.currentPassword || "");
              const newPassword = String(values.newPassword || "");
              if (newPassword !== String(values.confirmPassword || "")) {
                setPasswordError("Las contraseñas nuevas no coinciden.");
                return;
              }
              setSaving(true);
              setPasswordError("");
              try {
                await api("/password", "POST", { currentPassword, newPassword });
                setChangePasswordOpen(false);
                notify("Contraseña actualizada; se cerraron las otras sesiones.");
              } catch (err: any) {
                setPasswordError(err.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <label className="field">
              <span>Contraseña actual</span>
              <input name="currentPassword" type="password" required autoComplete="current-password" />
            </label>
            <label className="field">
              <span>Nueva contraseña · mínimo 10 caracteres</span>
              <input name="newPassword" type="password" minLength={10} required autoComplete="new-password" />
            </label>
            <label className="field">
              <span>Confirmar nueva contraseña</span>
              <input name="confirmPassword" type="password" minLength={10} required autoComplete="new-password" />
            </label>
            {passwordError && <p className="form-error" role="alert">{passwordError}</p>}
            <button className="button primary" disabled={saving}>
              {saving ? "Actualizando…" : "Cambiar contraseña"}
            </button>
          </form>
        </Modal>
      )}
      {resetUser && (
        <Modal
          title={`Restablecer clave · ${resetUser.name}`}
          close={() => setResetUser(null)}
        >
          <form
            className="auth-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const values = Object.fromEntries(new FormData(e.currentTarget));
              const newPassword = String(values.newPassword || "");
              if (newPassword !== String(values.confirmPassword || "")) {
                setPasswordError("Las contraseñas nuevas no coinciden.");
                return;
              }
              setSaving(true);
              setPasswordError("");
              try {
                await api(`/users/${resetUser.id}/password`, "PUT", { newPassword });
                setResetUser(null);
                notify("Clave restablecida; se cerraron las sesiones del integrante.");
              } catch (err: any) {
                setPasswordError(err.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <label className="field">
              <span>Nueva contraseña · mínimo 10 caracteres</span>
              <input name="newPassword" type="password" minLength={10} required autoComplete="new-password" />
            </label>
            <label className="field">
              <span>Confirmar nueva contraseña</span>
              <input name="confirmPassword" type="password" minLength={10} required autoComplete="new-password" />
            </label>
            {passwordError && <p className="form-error" role="alert">{passwordError}</p>}
            <button className="button primary" disabled={saving}>
              {saving ? "Restableciendo…" : "Restablecer clave"}
            </button>
          </form>
        </Modal>
      )}
      </div>
  );
}
