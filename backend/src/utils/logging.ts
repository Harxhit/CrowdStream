import { createLogger, format, transports } from "winston";
const { combine, timestamp, printf, errors, colorize } = format;

const customFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} ${level}: ${stack || message}`;
});

const logger = createLogger({
  level: "info",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    customFormat
  ),
  transports: [
    // Logs all errors to this file
    new transports.File({ filename: "logs/error.log", level: "error" }),

    // Logs everything (info and above) here
    new transports.File({ filename: "logs/combined.log" }),
  ],
});

// Add console logging only in development
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        customFormat
      ),
    })
  );
}

export default logger;
