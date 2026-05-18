import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import { taskRouter } from "./routes/task.routes";

export async function createApp() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/aslenix_tasks");
  }

  const app = express();
  app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || true, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/tasks", taskRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ message: "Unexpected server error" });
  });

  return app;
}
