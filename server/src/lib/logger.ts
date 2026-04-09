import pino from "pino";

function usePrettyLogs(): boolean {
  if (process.env.LOG_PRETTY === "0") return false;
  return process.env.LOG_PRETTY === "1" || process.env.NODE_ENV === "development";
}

export const logger = usePrettyLogs()
  ? pino({
      level: process.env.LOG_LEVEL ?? "info",
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard" },
      },
    })
  : pino({ level: process.env.LOG_LEVEL ?? "info" });
