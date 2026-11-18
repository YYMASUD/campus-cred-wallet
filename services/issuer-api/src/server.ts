import express from "express";
import cors from "cors";
import { api } from "./routes.js";
import { migrate } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(api);
app.get("/health", (_req, res) => res.json({ ok: true, service: "issuer-api" }));

const port = Number(process.env.ISSUER_API_PORT ?? 3001);

migrate()
  .then(() => {
    app.listen(port, () => console.log(`issuer-api listening on :${port}`));
  })
  .catch((e) => {
    console.error("migration failed", e);
    process.exit(1);
  });
