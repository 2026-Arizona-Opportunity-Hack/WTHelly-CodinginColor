"use client";

import { useEffect, useId, useRef, useState } from "react";
import type {
  PythonRunnerRequest,
  PythonRunnerResponse,
} from "./python-runner.types";

const RUN_TIMEOUT_MS = 5_000;

type PythonRunnerProps = {
  prompt: string;
  starterCode?: string;
  code?: string;
  onChange?: (code: string) => void;
  embedded?: boolean;
};

type RunnerStatus =
  | "idle"
  | "loading"
  | "running"
  | "complete"
  | "stopped"
  | "timed-out"
  | "error";

export function PythonRunner({ prompt, starterCode = "", code: controlledCode, onChange, embedded = false }: PythonRunnerProps) {
  const editorId = useId();
  const [localCode, setLocalCode] = useState(starterCode);
  const code = controlledCode ?? localCode;
  function changeCode(value: string) {
    if (controlledCode === undefined) setLocalCode(value);
    onChange?.(value);
  }
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [pythonError, setPythonError] = useState("");
  const [status, setStatus] = useState<RunnerStatus>("idle");
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const nextRunIdRef = useRef(0);
  const activeRunIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  function clearRunTimeout() {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function discardWorker() {
    clearRunTimeout();
    workerRef.current?.terminate();
    workerRef.current = null;
  }

  function getWorker() {
    if (workerRef.current) return workerRef.current;

    const worker = new Worker("/python-runner.worker.js", { type: "module" });
    worker.onmessage = (event: MessageEvent<PythonRunnerResponse>) => {
      const message = event.data;
      if (workerRef.current !== worker || message.runId !== activeRunIdRef.current) {
        return;
      }

      if (message.type === "status") {
        setStatus(message.status);
        if (message.status === "running") {
          clearRunTimeout();
          timeoutRef.current = window.setTimeout(() => {
            if (
              workerRef.current !== worker ||
              activeRunIdRef.current !== message.runId
            ) {
              return;
            }

            activeRunIdRef.current = -1;
            discardWorker();
            setPythonError("");
            setStatus("timed-out");
          }, RUN_TIMEOUT_MS);
        }
      } else if (message.type === "output") {
        if (message.stream === "stdout") {
          setStdout((current) => current + message.text);
        } else {
          setStderr((current) => current + message.text);
        }
      } else if (message.type === "error") {
        clearRunTimeout();
        setPythonError(message.message);
        setStatus("error");
        if (message.phase === "initialization") {
          activeRunIdRef.current = -1;
          discardWorker();
        }
      } else {
        clearRunTimeout();
        setStatus("complete");
      }
    };
    worker.onerror = (event) => {
      event.preventDefault();
      if (workerRef.current !== worker) return;

      activeRunIdRef.current = -1;
      discardWorker();
      setPythonError("The Python worker stopped unexpectedly. Press Run to try again.");
      setStatus("error");
    };

    workerRef.current = worker;
    return worker;
  }

  function runCode() {
    const runId = ++nextRunIdRef.current;
    activeRunIdRef.current = runId;
    clearRunTimeout();
    setStdout("");
    setStderr("");
    setPythonError("");
    setStatus("loading");

    const request: PythonRunnerRequest = { type: "run", runId, code };
    try {
      getWorker().postMessage(request);
    } catch (error) {
      activeRunIdRef.current = -1;
      discardWorker();
      setPythonError(error instanceof Error ? error.message : String(error));
      setStatus("error");
    }
  }

  function stopCode() {
    if (status !== "loading" && status !== "running") return;

    activeRunIdRef.current = -1;
    discardWorker();
    setStatus("stopped");
  }

  function resetCode() {
    activeRunIdRef.current = -1;
    discardWorker();
    changeCode(starterCode);
    setStdout("");
    setStderr("");
    setPythonError("");
    setStatus("idle");
  }

  const isBusy = status === "loading" || status === "running";

  return (
    <section aria-label="Python practice" className={embedded ? "min-w-0 space-y-5" : "mx-auto w-full max-w-4xl space-y-5 rounded-[1.75rem] border border-border-strong bg-card p-4 shadow-[0_14px_40px_rgba(77,37,26,0.10)] sm:p-6"}>
      <div className="space-y-2">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Python practice
        </p>
        {!embedded && <h1 className="font-serif text-2xl font-semibold text-primary">Your code workspace</h1>}
        <p className="max-w-3xl break-words font-serif text-lg leading-7 text-foreground">{prompt}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor={editorId} className="text-sm font-semibold text-primary">
          Python code
        </label>
        <textarea
          id={editorId}
          aria-describedby={`${editorId}-help`}
          autoCapitalize="off"
          autoCorrect="off"
          className="min-h-64 w-full min-w-0 resize-y rounded-xl border border-border-strong bg-surface-raised px-4 py-3 font-mono text-sm leading-6 text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          spellCheck={false}
          value={code}
          onChange={(event) => changeCode(event.target.value)}
        />
        <p id={`${editorId}-help`} className="text-xs text-muted-foreground">
          Run checks your code here. Submit saves your code when you are ready.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-ring bg-primary px-5 py-3 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
          disabled={isBusy}
          onClick={runCode}
          type="button"
        >
          {status === "loading" ? "Starting Python…" : status === "running" ? "Running…" : "Run code"}
        </button>
        <button
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border-strong bg-surface px-5 py-3 font-semibold text-primary hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
          disabled={!isBusy}
          onClick={stopCode}
          type="button"
        >
          Stop
        </button>
        <button
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border-strong bg-surface px-5 py-3 font-semibold text-primary hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={resetCode}
          type="button"
        >
          Reset
        </button>
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {status === "idle" && "Ready when you are."}
          {status === "loading" && "Loading Python in your browser…"}
          {status === "running" && "Your code is running. It will stop after 5 seconds."}
          {status === "complete" && "Run finished."}
          {status === "stopped" && "Run stopped. Press Run to start a fresh worker."}
          {status === "timed-out" && "Your code was stopped after 5 seconds. Press Run to try again."}
          {status === "error" && "Run finished with an error."}
        </p>
      </div>

      <section aria-label="Python console" aria-live="polite" className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4 text-foreground">
        {embedded ? <h3 className="font-serif text-lg font-semibold text-primary">Console</h3> : <h2 className="font-serif text-lg font-semibold text-primary">Console</h2>}
        {!stdout && !stderr && !pythonError && (
          <p className="font-mono text-sm text-muted-foreground">Your program output will appear here.</p>
        )}
        {stdout && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">Output</p>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm">{stdout}</pre>
          </div>
        )}
        {stderr && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-destructive">Standard error</p>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm text-destructive">{stderr}</pre>
          </div>
        )}
        {pythonError && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-destructive">Python error</p>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm text-destructive">{pythonError}</pre>
          </div>
        )}
      </section>
    </section>
  );
}
