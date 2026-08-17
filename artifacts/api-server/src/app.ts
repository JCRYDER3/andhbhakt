import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  cloudflareOnlyMiddleware,
  blocklistMiddleware,
  globalLimiter,
  writeLimiter,
  sessionLimiter,
} from "./middlewares/rate-limit";
import { cacheHeaders } from "./middlewares/cache";
import { verifySessionMiddleware } from "./middlewares/verify-session";

const app: Express = express();

// Trust Replit's reverse-proxy so req.ip and x-forwarded-for are correct
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// CORS — restrict to a specific origin in production via ALLOWED_ORIGIN env var.
// If unset in production, warn loudly and fall through to the Cloudflare-only
// gate (which already blocks direct hits), but any operator should set this.
const allowedOrigin = process.env.ALLOWED_ORIGIN;
if (process.env.NODE_ENV === "production" && !allowedOrigin) {
  // Not a hard throw — the Cloudflare gate + session cookie still protect the
  // API — but this makes the misconfiguration visible in logs immediately.
  console.warn(
    "[startup] WARNING: ALLOWED_ORIGIN is not set. " +
    "CORS will be fully open in production. " +
    "Set ALLOWED_ORIGIN=https://your-domain.com to restrict cross-origin requests."
  );
}
app.use(
  cors(
    allowedOrigin
      ? { origin: allowedOrigin, credentials: true }
      : {},
  ),
);

app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb" }));

// Parse cookies (needed for session verification)
app.use(cookieParser());

// Security: require Cloudflare proxy in production, then block bad IPs
app.use(cloudflareOnlyMiddleware);
app.use(blocklistMiddleware);

// Rate limiting — global tier first (covers all methods incl. GET),
// then the stricter write tier (POST / PATCH / PUT / DELETE).
// The session endpoint gets its own tight limit because each call
// contacts Cloudflare's Turnstile API.
app.use("/api", globalLimiter);
app.use("/api", writeLimiter);
app.use("/api/session/verify", sessionLimiter);

// Cache headers — allows browsers and CDNs to cache read-only responses
app.use("/api", cacheHeaders);

// Session gate: every request in production must carry a valid Turnstile-issued
// cookie. Bypasses: POST /api/session/verify and GET /api/healthz|/api/health.
app.use("/api", verifySessionMiddleware);

app.use("/api", router);

export default app;
