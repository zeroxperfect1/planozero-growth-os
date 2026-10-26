import { useState } from "react";
import { ArrowUpRight, LockKeyhole, ArrowRight } from "lucide-react";
import { BrandLogo } from "./Brand";
import { isCompanyEmail, normalizeEmail } from "../shared/auth.mjs";
import { useStore } from "./store";

export function LoginPage() {
  const { configured, setupProtected, connectionError, initialize, authenticate } =
    useStore();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <main className="login-page">
      <section className="login-brand">
        <a className="brand" href="/">
          <BrandLogo className="brand-logo brand-logo-login" />
          <span className="brand-caption">GROWTH OPERATING SYSTEM</span>
        </a>
        <div>
          <span className="eyebrow">ESTRATEGIA → ACCIÓN → CRECIMIENTO</span>
          <h1>
            El próximo
            <br />
            movimiento
            <br />
            <em>empieza aquí.</em>
          </h1>
          <p>
            Tu equipo. Nuestras capacidades.
            <br />
            Un solo lugar para hacer crecer el negocio.
          </p>
        </div>
        <span className="login-foot">
          SANTIAGO / ESPAÑA / US HISPANIC <ArrowUpRight size={18} />
        </span>
      </section>
      <section className="login-card">
        <LockKeyhole className="orange" size={26} />
        <span className="eyebrow">ACCESO PRIVADO · PLANOZERO</span>
        <h2>{configured ? "Bienvenido de vuelta." : "Activa tu espacio."}</h2>
        <p>
          {configured
            ? "Ingresa con la cuenta que Dirección creó para ti."
            : "Crea la cuenta de Dirección. Después podrás agregar a cada ejecutivo comercial."}
        </p>
        {connectionError ? (
          <div className="info-box">
            <p role="alert">{connectionError}</p>
            <button className="button" onClick={initialize}>
              Reintentar conexión
            </button>
          </div>
        ) : (
          <form
            className="auth-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const values = Object.fromEntries(new FormData(e.currentTarget));
              values.email = normalizeEmail(values.email);
              if (!isCompanyEmail(values.email)) {
                setError("El acceso es exclusivo para cuentas @planozero.cl.");
                setBusy(false);
                return;
              }
              try {
                await authenticate(configured ? "login" : "setup", values);
              } catch (err: any) {
                setError(err.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {!configured && (
              <label className="field">
                <span>Nombre</span>
                <input name="name" required autoComplete="name" />
              </label>
            )}
            {!configured && setupProtected && (
              <label className="field">
                <span>Código de activación</span>
                <input name="setupToken" type="password" required autoComplete="off" />
              </label>
            )}
            <label className="field">
              <span>Correo @planozero.cl</span>
              <input
                name="email"
                required
                type="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="raul@planozero.cl"
              />
            </label>
            <label className="field">
              <span>Contraseña{!configured ? " · mínimo 10 caracteres" : ""}</span>
              <input
                name="password"
                required
                type="password"
                minLength={configured ? undefined : 10}
                autoComplete={configured ? "current-password" : "new-password"}
              />
            </label>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              {busy
                ? "Conectando…"
                : configured
                  ? "Ingresar"
                  : "Crear cuenta de Dirección"}
              <ArrowRight size={17} />
            </button>
          </form>
        )}
        <small className="login-private">
          Acceso exclusivo para integrantes con correo @planozero.cl. Los servicios,
          tarifas y cotizaciones requieren iniciar sesión.
        </small>
      </section>
    </main>
  );
}
