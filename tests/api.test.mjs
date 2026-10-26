import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { today } from "../shared/domain.mjs";

const dir = mkdtempSync(join(tmpdir(), "planozero-test-"));
const port = 15173;
const url = `http://127.0.0.1:${port}`;
const setupToken = "test-only-setup-token-2026-long-enough";
let child;
let cookie = "";
let prospect;
let executives = [];
const account = {
  name: "Test Director",
  email: "director@planozero.cl",
  password: "test-only-secret-2026",
};
const prospectBody = (over = {}) => ({
  name: "Prueba persistente",
  market: "España",
  owner: account.name,
  city: "",
  sector: "",
  contact: "",
  url: "",
  signal: "",
  pain: "",
  offerId: "S-01",
  stage: "Investigado",
  value: 1000,
  currency: "EUR",
  probability: 10,
  nextAction: "",
  nextDate: "",
  source: "Outbound",
  fit: "Alto",
  ...over,
});
async function request(path, method = "GET", body, auth = cookie, extra = {}) {
  const res = await fetch(url + "/api" + path, {
    method,
    headers: { "Content-Type": "application/json", Cookie: auth, ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: res.status,
    data: await res.json(),
    cookie: res.headers.get("set-cookie"),
  };
}
const login = async (user) => {
  const r = await request("/login", "POST", user, "");
  return r.cookie.split(";")[0];
};
before(async () => {
  child = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      SETUP_TOKEN: setupToken,
      PORT: String(port),
      DATABASE_URL: "",
      DB_PATH: join(dir, "test.sqlite"),
    },
    stdio: "pipe",
  });
  let output = "";
  child.stderr.on("data", (d) => (output += d));
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(url + "/api/health");
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Test server did not start: " + output);
});
after(async () => {
  child?.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 150));
  rmSync(dir, { recursive: true, force: true });
});
test("workspace API enforces authentication and same-origin writes", async () => {
  assert.equal((await request("/state")).status, 401);
  assert.equal(
    (
      await request("/setup", "POST", account, "", {
        Origin: "https://foreign.test",
      })
    ).status,
    403,
  );
});
test("first account initializes empty real workspace and a secure session cookie", async () => {
  const invalidDomain = await request("/setup", "POST", {
    ...account,
    email: "director@example.test",
    setupToken,
  }, "");
  assert.equal(invalidDomain.status, 400);
  assert.match(invalidDomain.data.error, /@planozero\.cl/);
  const r = await request("/setup", "POST", { ...account, setupToken });
  assert.equal(r.status, 201);
  assert.equal(r.data.role, "Dirección");
  assert.ok(!r.data.password);
  assert.match(r.cookie, /HttpOnly/);
  assert.match(r.cookie, /SameSite=Strict/);
  cookie = r.cookie.split(";")[0];
  const s = await request("/state");
  assert.equal(s.status, 200);
  assert.equal(s.data.prospects.length, 0);
  assert.equal(s.data.projects.length, 0);
  assert.equal(s.data.quotes.length, 0);
  assert.equal(s.data.offers.length, 39);
  assert.equal(s.data.profiles.length, 14);
  assert.equal(
    (await request("/setup", "POST", { ...account, setupToken })).status,
    409,
  );
});
test("Dirección provisiona las tres cuentas ejecutivas con claves aleatorias de un solo vistazo", async () => {
  const r = await request("/users/provision-executives", "POST", {});
  assert.equal(r.status, 201);
  executives = r.data.users;
  assert.deepEqual(
    executives.map((u) => u.email),
    ["raul@planozero.cl", "vale@planozero.cl", "dany@planozero.cl"],
  );
  assert.ok(executives.every((u) => u.created && u.role === "Comercial"));
  assert.ok(executives.every((u) => u.password.length >= 32));
  for (const u of executives) {
    const session = await login(u);
    assert.ok(session.startsWith("pz_session="));
  }
  const normalized = await request(
    "/login",
    "POST",
    {
      email: ` ${executives[0].email.toUpperCase()} `,
      password: executives[0].password,
    },
    "",
  );
  assert.equal(normalized.status, 200);
  const again = await request("/users/provision-executives", "POST", {});
  assert.equal(again.status, 201);
  assert.ok(again.data.users.every((u) => !u.created && !u.password));
});
test("invalid credentials and invalid records are rejected", async () => {
  assert.equal(
    (await request("/login", "POST", { ...account, password: "incorrect" }))
      .status,
    401,
  );
  const wrongDomain = await request("/login", "POST", {
    email: "director@example.test",
    password: account.password,
  });
  assert.equal(wrongDomain.status, 401);
  assert.equal(wrongDomain.data.error, "Correo o contraseña incorrectos.");
  assert.equal(
    (
      await request("/users", "POST", {
        name: "Outside User",
        email: "outside@gmail.com",
        password: "test-outside-password-2026",
        role: "Comercial",
      })
    ).status,
    400,
  );
  const noRole = await request("/users", "POST", {
    name: "No Role",
    email: "norole@planozero.cl",
    password: "test-no-role-password-2026",
  });
  assert.equal(noRole.status, 400);
  const malformed = await fetch(url + "/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.status, 400);
  assert.match((await malformed.json()).error, /JSON/);
  const db = new DatabaseSync(join(dir, "test.sqlite"));
  const salt = randomBytes(16).toString("hex");
  const legacyHash = salt + ":" + scryptSync("legacy-password", salt, 64).toString("hex");
  db.prepare("INSERT INTO users VALUES(?,?,?,?,?)").run(
    "legacy-id",
    "Legacy User",
    "legacy@example.test",
    legacyHash,
    "Comercial",
  );
  db.close();
  const legacyLogin = await request("/login", "POST", {
    email: "legacy@example.test",
    password: "legacy-password",
  });
  assert.equal(legacyLogin.status, 401);
  assert.equal(legacyLogin.data.error, wrongDomain.data.error);
  assert.equal(
    (await request("/prospects", "POST", prospectBody({ probability: 101 })))
      .status,
    400,
  );
  assert.equal(
    (
      await request(
        "/prospects",
        "POST",
        prospectBody({ offerId: "missing" }),
      )
    ).status,
    400,
  );
  const badDate = await request(
    "/prospects",
    "POST",
    prospectBody({ nextDate: "2026-02-30" }),
  );
  assert.equal(badDate.status, 400);
  assert.match(badDate.data.error, /Fecha inválida/);
  const badUrl = await request(
    "/prospects",
    "POST",
    prospectBody({ url: "javascript:alert(1)" }),
  );
  assert.equal(badUrl.status, 400);
  assert.match(badUrl.data.error, /enlace|http/);
});
test("prospect CRUD, activity, winning and idempotent project generation persist", async () => {
  let r = await request("/prospects", "POST", prospectBody());
  assert.equal(r.status, 201);
  prospect = r.data;
  r = await request("/activities", "POST", {
    name: "Reunión de diagnóstico",
    type: "Reunión",
    date: today(),
    prospectId: prospect.id,
  });
  assert.equal(r.status, 201);
  r = await request(`/prospects/${prospect.id}`, "PUT", {
    ...prospect,
    stage: "Ganado",
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.probability, 100);
  await request(`/prospects/${prospect.id}`, "PUT", {
    ...prospect,
    stage: "Ganado",
    name: "Prueba persistente 2",
  });
  const s = (await request("/state")).data;
  assert.equal(
    s.projects.filter((p) => p.prospectId === prospect.id).length,
    1,
  );
  assert.equal(s.tasks.filter((p) => p.prospectId === prospect.id).length, 4);
  assert.equal(s.prospects.find((p) => p.id === prospect.id).history.length, 1);
  assert.equal(
    (await request(`/prospects/${prospect.id}`, "DELETE", {})).status,
    409,
  );
});
test("external collaborator sees assigned records and cannot access CRM or change owner", async () => {
  const external = {
    name: "External Tester",
    email: "external@planozero.cl",
    password: "test-external-2026",
    role: "Colaborador externo",
  };
  assert.equal((await request("/users", "POST", external)).status, 201);
  const task = (
    await request("/tasks", "POST", {
      name: "Assigned test task",
      owner: external.name,
      market: "España",
      date: today(),
      status: "Pendiente",
      priority: "Media",
    })
  ).data;
  const externalCookie = await login(external);
  const s = (await request("/state", "GET", undefined, externalCookie)).data;
  assert.equal(s.prospects.length, 0);
  assert.equal(s.offers.length, 0);
  assert.equal(s.quotes.length, 0);
  assert.equal(s.tasks.length, 1);
  assert.equal(s.tasks[0].id, task.id);
  assert.equal(s.team.length, 1);
  assert.equal(s.team[0].name, external.name);
  assert.equal(s.settings.name, "PLANOZERO");
  assert.equal(s.settings.monthlyTarget, undefined);
  assert.equal(s.settings.teamHours, undefined);
  assert.equal(s.settings.agencyCommission, undefined);
  assert.equal(s.settings.eurUsd, undefined);
  assert.equal(
    (await request("/users", "GET", undefined, externalCookie)).status,
    403,
  );
  assert.equal(
    (await request("/prospects", "POST", prospectBody(), externalCookie)).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/tasks/" + task.id,
        "PUT",
        { ...task, status: "Completado" },
        externalCookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/tasks/" + task.id,
        "PUT",
        { ...task, owner: account.name },
        externalCookie,
      )
    ).status,
    403,
  );
});
test("quotes save with server totals and freeze the commercial snapshot once sent", async () => {
  const state = (await request("/state")).data;
  const profile = state.profiles.find((p) => p.active);
  const body = {
    name: "Cotización de prueba",
    client: "Cliente Uno",
    currency: "CLP",
    serviceId: "S-01",
    status: "Borrador",
    notes: "",
    commission: 30,
    margin: 10,
    extraCost: 0,
    validUntil: "2026-12-31",
    lines: [{ profileId: profile.id, hours: 4 }],
  };
  const created = await request("/quotes", "POST", body);
  assert.equal(created.status, 201);
  const labor = profile.cost * 4;
  const net = Math.round(labor / (1 - 0.4));
  assert.equal(created.data.totals.labor, labor);
  assert.equal(created.data.totals.net, net);
  assert.equal(created.data.totals.fee, Math.round(net * 0.3));
  assert.equal(created.data.totals.profit, Math.round(net * 0.1));
  assert.equal(created.data.lines[0].rate, profile.cost);
  assert.equal(created.data.owner, account.name);

  const sent = await request(`/quotes/${created.data.id}`, "PUT", {
    ...body,
    status: "Enviada",
  });
  assert.equal(sent.status, 200);
  assert.equal(sent.data.totals.net, net);

  const profileBump = await request(`/profiles/${profile.id}`, "PUT", {
    name: profile.name,
    area: profile.area,
    description: profile.description,
    cost: profile.cost * 2,
    currency: profile.currency,
    active: true,
    source: "Tarifa actualizada por Dirección",
  });
  assert.equal(profileBump.status, 200);

  const frozen = await request(`/quotes/${created.data.id}`, "PUT", {
    ...body,
    lines: [{ profileId: profile.id, hours: 99 }],
    status: "Enviada",
  });
  assert.equal(frozen.status, 200);
  assert.equal(frozen.data.totals.net, net);
  assert.equal(frozen.data.lines[0].hours, 4);

  const reopen = await request(`/quotes/${created.data.id}`, "PUT", {
    ...body,
    status: "Borrador",
  });
  assert.equal(reopen.status, 409);

  const accepted = await request(`/quotes/${created.data.id}`, "PUT", {
    ...body,
    status: "Aceptada",
  });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.data.totals.net, net);

  const copy = await request("/quotes", "POST", {
    ...body,
    name: "Cotización de prueba · copia",
    status: "Borrador",
  });
  assert.equal(copy.status, 201);
  assert.equal(copy.data.totals.net, Math.round((profile.cost * 2 * 4) / (1 - 0.4)));
});
test("inactive profiles stay valid in drafts and existing offer allocations", async () => {
  const state = (await request("/state")).data;
  const offer = state.offers.find((o) => o.allocations?.length);
  const profileId = offer.allocations[0].profileId;
  const profile = state.profiles.find((p) => p.id === profileId);
  const lines = offer.allocations.map((a) => ({
    profileId: a.profileId,
    hours: a.hours,
  }));
  const body = {
    name: "Borrador con perfil inactivo",
    client: "Cliente Dos",
    currency: "CLP",
    serviceId: offer.id,
    status: "Borrador",
    notes: "",
    commission: 30,
    margin: 0,
    extraCost: 0,
    validUntil: "2026-12-31",
    lines: [{ profileId, hours: 1 }],
  };
  const draft = await request("/quotes", "POST", body);
  assert.equal(draft.status, 201);
  try {
    const deactivated = await request(`/profiles/${profileId}`, "PUT", {
      ...profile,
      active: false,
    });
    assert.equal(deactivated.status, 200);
    const edited = await request(`/quotes/${draft.data.id}`, "PUT", {
      ...body,
      name: "Borrador con perfil inactivo editado",
    });
    assert.equal(edited.status, 200);
    const fromOffer = await request("/quotes", "POST", {
      ...body,
      name: "Cotización desde oferta",
      lines,
    });
    assert.equal(fromOffer.status, 201);
    const newLine = await request("/quotes", "POST", {
      ...body,
      name: "Intento de perfil inactivo",
      serviceId: "",
    });
    assert.equal(newLine.status, 400);
  } finally {
    await request(`/profiles/${profileId}`, "PUT", profile);
  }
});
test("automatic activity only tracks prospect changes", async () => {
  const before = (await request("/state")).data.activities.length;
  const state = (await request("/state")).data;
  const profile = state.profiles[0];
  const updated = await request(`/profiles/${profile.id}`, "PUT", profile);
  assert.equal(updated.status, 200);
  assert.equal((await request("/state")).data.activities.length, before);
});
test("each executive role writes and reads only what the role allows", async () => {
  const comercial = {
    name: "Comercial Uno",
    email: "comercial@planozero.cl",
    password: "test-comercial-2026",
    role: "Comercial",
  };
  const estrategia = {
    name: "Estrategia Una",
    email: "estrategia@planozero.cl",
    password: "test-estrategia-2026",
    role: "Estrategia / Diseño",
  };
  assert.equal((await request("/users", "POST", comercial)).status, 201);
  assert.equal((await request("/users", "POST", estrategia)).status, 201);
  const comercialCookie = await login(comercial);
  const estrategiaCookie = await login(estrategia);
  const state = (await request("/state")).data;
  const profile = state.profiles.find((p) => p.active);

  const quote = {
    name: "Cotización comercial",
    client: "Cliente Dos",
    currency: "CLP",
    serviceId: "",
    status: "Borrador",
    notes: "",
    commission: 30,
    margin: 0,
    extraCost: 0,
    validUntil: "2026-12-31",
    lines: [{ profileId: profile.id, hours: 2 }],
  };
  const created = await request("/quotes", "POST", quote, comercialCookie);
  assert.equal(created.status, 201);
  assert.equal(created.data.owner, comercial.name);

  const comercialState = (
    await request("/state", "GET", undefined, comercialCookie)
  ).data;
  assert.equal(comercialState.quotes.length, 1);
  assert.equal(comercialState.quotes[0].id, created.data.id);
  assert.equal(comercialState.offers.length, 39);
  assert.equal(comercialState.profiles.length, 14);

  const estrategiaState = (
    await request("/state", "GET", undefined, estrategiaCookie)
  ).data;
  assert.equal(estrategiaState.quotes.length, 0);
  assert.equal(estrategiaState.offers.length, 39);

  assert.equal(
    (await request("/quotes", "POST", quote, estrategiaCookie)).status,
    403,
  );
  assert.equal(
    (
      await request(
        `/users/${executives[0].id}/password`,
        "PUT",
        { newPassword: "Unauthorized-Reset-2026" },
        comercialCookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (await request(`/quotes/${created.data.id}`, "PUT", quote, estrategiaCookie))
      .status,
    403,
  );
  assert.equal(
    (
      await request(
        "/profiles/" + profile.id,
        "PUT",
        { ...profile, cost: profile.cost + 1 },
        comercialCookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/offers/" + state.offers[0].id,
        "PUT",
        { ...state.offers[0], name: "Renombrado" },
        comercialCookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/offers/" + state.offers[0].id,
        "PUT",
        { ...state.offers[0], name: "Renombrado" },
        estrategiaCookie,
      )
    ).status,
    403,
  );
  const other = {
    name: "Comercial Dos",
    email: "comercial2@planozero.cl",
    password: "test-comercial2-2026",
    role: "Comercial",
  };
  assert.equal((await request("/users", "POST", other)).status, 201);
  const otherCookie = await login(other);
  const otherState = (await request("/state", "GET", undefined, otherCookie)).data;
  assert.equal(otherState.quotes.length, 0);
  assert.equal(
    (
      await request(`/quotes/${created.data.id}`, "PUT", quote, otherCookie)
    ).status,
    403,
  );
});
test("password reset revokes the user's sessions and only the new password works", async () => {
  const raul = executives.find((u) => u.email === "raul@planozero.cl");
  const raulSession = await login(raul);
  assert.equal((await request("/state", "GET", undefined, raulSession)).status, 200);
  const newPassword = "Raul-Reset-Password-2026";
  const reset = await request(`/users/${raul.id}/password`, "PUT", { newPassword });
  assert.equal(reset.status, 200);
  assert.equal((await request("/state", "GET", undefined, raulSession)).status, 401);
  assert.equal(
    (await request("/login", "POST", raul, "")).status,
    401,
  );
  const fresh = await request(
    "/login",
    "POST",
    { email: raul.email, password: newPassword },
    "",
  );
  assert.equal(fresh.status, 200);
});
test("members can change their password while keeping only the current session", async () => {
  const otherSession = await login(account);
  assert.equal(
    (
      await request("/password", "POST", {
        currentPassword: "wrong-current-password",
        newPassword: "Updated-Director-Password-2026",
      })
    ).status,
    403,
  );
  const newPassword = "Updated-Director-Password-2026";
  const changed = await request("/password", "POST", {
    currentPassword: account.password,
    newPassword,
  });
  assert.equal(changed.status, 200);
  assert.equal((await request("/state")).status, 200);
  assert.equal((await request("/state", "GET", undefined, otherSession)).status, 401);
  assert.equal((await request("/login", "POST", account, "")).status, 401);
  account.password = newPassword;
  const fresh = await request("/login", "POST", account, "");
  assert.equal(fresh.status, 200);
  cookie = fresh.cookie.split(";")[0];
});
test("login limits failures per account but never counts successful logins", async () => {
  const locked = {
    name: "Locked Tester",
    email: "locked@planozero.cl",
    password: "locked-account-password-2026",
    role: "Comercial",
  };
  assert.equal((await request("/users", "POST", locked)).status, 201);
  for (let i = 0; i < 5; i++) {
    const bad = await request(
      "/login",
      "POST",
      { email: locked.email, password: "wrong-password" },
      "",
    );
    assert.equal(bad.status, 401);
  }
  assert.equal((await request("/login", "POST", locked, "")).status, 429);
  const raul = executives.find((u) => u.email === "raul@planozero.cl");
  const password = "Raul-Reset-Password-2026";
  for (let i = 0; i < 25; i++) {
    const success = await request(
      "/login",
      "POST",
      { email: raul.email, password },
      "",
    );
    assert.equal(success.status, 200, `login correcto #${i + 1}`);
  }
  assert.equal((await request("/login", "POST", locked, "")).status, 429);
});
test("logout invalidates the session while records survive fresh login", async () => {
  assert.equal((await request("/logout", "POST", {})).status, 200);
  assert.equal((await request("/state")).status, 401);
  const r = await request("/login", "POST", account);
  cookie = r.cookie.split(";")[0];
  assert.ok(
    (await request("/state")).data.prospects.some((p) => p.id === prospect.id),
  );
});
