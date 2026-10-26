import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import pg from "pg";

const { Client } = pg;
const dsn = process.env.TEST_DATABASE_URL || "";
const enabled = process.env.RUN_PG_TESTS === "1" && !!dsn;

test(
  "PostgreSQL locks concurrent wins and calculates quotes",
  { skip: enabled ? false : "Configura RUN_PG_TESTS=1 y TEST_DATABASE_URL" },
  async () => {
    assert.ok(
      ["127.0.0.1", "localhost"].includes(new URL(dsn).hostname),
      "TEST_DATABASE_URL debe apuntar a localhost.",
    );
    const client = new Client({ connectionString: dsn, ssl: false });
    try {
      await client.connect();
      await client.query(
        "DROP TABLE IF EXISTS sessions, login_attempts, records, config, users CASCADE",
      );
    } finally {
      await client.end();
    }

    const port = 15177;
    const url = `http://127.0.0.1:${port}`;
    const setupToken = "pg-only-setup-token-2026-long-enough";
    const child = spawn(process.execPath, ["server/index.mjs"], {
      env: {
        ...process.env,
        NODE_ENV: "production",
        VERCEL: "",
        COOKIE_SECURE: "false",
        SETUP_TOKEN: setupToken,
        PORT: String(port),
        DATABASE_URL: dsn,
        PG_NO_SSL: "1",
        DB_PATH: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (data) => (output += data));
    child.stderr.on("data", (data) => (output += data));
    const request = async (path, method = "GET", body, auth = "") => {
      const response = await fetch(url + "/api" + path, {
        method,
        headers: { "Content-Type": "application/json", Cookie: auth },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return {
        status: response.status,
        data: await response.json(),
        cookie: response.headers.get("set-cookie"),
      };
    };

    try {
      let started = false;
      for (let i = 0; i < 80; i++) {
        try {
          const health = await fetch(url + "/api/health");
          if (health.ok) {
            started = true;
            break;
          }
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.ok(started, "El servidor PostgreSQL no inició: " + output);

      const admin = {
        name: "PG Director",
        email: "pg-director@planozero.cl",
        password: "pg-test-password-2026",
      };
      const setup = await request("/setup", "POST", {
        ...admin,
        setupToken,
      });
      assert.equal(setup.status, 201, JSON.stringify(setup.data));
      assert.ok(setup.cookie, "El setup no devolvió sesión.");
      const cookie = setup.cookie.split(";")[0];
      const state = await request("/state", "GET", undefined, cookie);
      assert.equal(state.status, 200);
      assert.equal(state.data.offers.length, 39);

      const prospect = await request(
        "/prospects",
        "POST",
        {
          name: "PG Concurrente",
          market: "España",
          owner: admin.name,
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
        },
        cookie,
      );
      assert.equal(prospect.status, 201, JSON.stringify(prospect.data));

      const won = { ...prospect.data, stage: "Ganado" };
      const [first, second] = await Promise.all([
        request(`/prospects/${prospect.data.id}`, "PUT", won, cookie),
        request(`/prospects/${prospect.data.id}`, "PUT", won, cookie),
      ]);
      assert.equal(first.status, 200, JSON.stringify(first.data));
      assert.equal(second.status, 200, JSON.stringify(second.data));
      const after = await request("/state", "GET", undefined, cookie);
      assert.equal(
        after.data.projects.filter((p) => p.prospectId === prospect.data.id)
          .length,
        1,
      );
      assert.equal(
        after.data.tasks.filter((t) => t.prospectId === prospect.data.id).length,
        4,
      );

      const profile = after.data.profiles.find((p) => p.active);
      assert.ok(profile, "El catálogo no tiene perfiles activos.");
      const quote = await request(
        "/quotes",
        "POST",
        {
          name: "PG Cotización",
          client: "PG Cliente",
          currency: "CLP",
          serviceId: "S-01",
          status: "Borrador",
          notes: "",
          commission: 30,
          margin: 0,
          extraCost: 0,
          validUntil: "2026-12-31",
          lines: [{ profileId: profile.id, hours: 2 }],
        },
        cookie,
      );
      assert.equal(quote.status, 201, JSON.stringify(quote.data));
      assert.ok(quote.data.totals.net > 0);
    } finally {
      child.kill("SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  },
);
