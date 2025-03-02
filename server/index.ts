
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
setupDebugLogging(app);
setupResponseLogging(app);

// Error handling
app.use(errorHandler);

// Start server
(async () => {
  const server = await registerRoutes(app);
  
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = 5001;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();

// Middleware functions
function setupDebugLogging(app: express.Express) {
  app.use((req, _res, next) => {
    console.debug(`[DEBUG] ${req.method} ${req.path}`, {
      query: req.query,
      body: req.body,
      headers: req.headers
    });
    next();
  });
}

function setupResponseLogging(app: express.Express) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => logResponse(req, res, start, path, capturedJsonResponse));
    next();
  });
}

function logResponse(
  req: Request, 
  res: Response, 
  start: number,
  path: string, 
  jsonResponse?: Record<string, any>
) {
  const duration = Date.now() - start;
  if (path.startsWith("/api")) {
    let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
    if (jsonResponse) {
      logLine += ` :: ${JSON.stringify(jsonResponse)}`;
    }
    log(logLine.length > 80 ? logLine.slice(0, 79) + "…" : logLine);
  }
}

function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
  throw err;
}
