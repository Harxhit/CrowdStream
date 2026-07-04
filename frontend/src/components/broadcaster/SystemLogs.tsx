interface Log {
  message: string;
  timestamp: Date;
}

interface SystemLogsProps {
  logs: Log[];
}

export default function SystemLogs({
  logs,
}: SystemLogsProps) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 shadow-lg">
      <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold">
            System Logs
          </h2>

          <p className="mt-1 text-sm text-neutral-400">
            Stream lifecycle events
          </p>
        </div>

        <div className="flex gap-2">
          <span className="h-3 w-3 rounded-full bg-red-500" />
          <span className="h-3 w-3 rounded-full bg-yellow-500" />
          <span className="h-3 w-3 rounded-full bg-green-500" />
        </div>
      </div>

      <div className="h-80 overflow-y-auto bg-black p-4 font-mono text-sm">
        {logs.length === 0 ? (
          <div className="text-neutral-500">
            Waiting for broadcaster...
          </div>
        ) : (
          logs.map((log, index) => (
            <LogEntry
              key={index}
              message={log.message}
              timestamp={log.timestamp}
            />
          ))
        )}
      </div>
    </section>
  );
}

interface LogEntryProps {
  message: string;
  timestamp: Date;
}

function LogEntry({
  message,
  timestamp,
}: LogEntryProps) {
  return (
    <div className="mb-2 flex gap-3">
      <span className="text-neutral-500">
        {timestamp.toLocaleTimeString()}
      </span>

      <span className="text-green-400">$</span>

      <span className="break-all text-neutral-200">
        {message}
      </span>
    </div>
  );
}