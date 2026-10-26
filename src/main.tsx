import React from "react";
import { createRoot } from "react-dom/client";
import { StoreProvider } from "./store";
import App from "./App";
import "./styles.css";
try {
  document.documentElement.dataset.theme =
    localStorage.getItem("pz-theme") === "dark" ? "dark" : "light";
} catch {
  document.documentElement.dataset.theme = "light";
}
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="loading-screen">
        <h1>Algo interrumpió la vista.</h1>
        <p>
          Tus datos del servidor siguen guardados. Recarga para volver a
          intentarlo.
        </p>
        <button className="button primary" onClick={() => location.reload()}>
          Recargar Growth OS
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <App />
      </StoreProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
