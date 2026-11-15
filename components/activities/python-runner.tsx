"use client";

import { useEffect, useRef, useState } from "react";
import type {
  PythonRunnerRequest,
  PythonRunnerResponse,
} from "./python-runner.types";

const RUN_TIMEOUT_MS = 5_000;

type PythonRunnerProps = {
  prompt: string;
  starterCode: string;
};

type RunnerStatus =
  | "idle"
  | "loading"
  | "running"
  | "complete"
  | "stopped"
  | "timed-out"
  | "error";

export function PythonRunner({ prompt, starterCode }: PythonRunnerProps) {
  const [code, setCode] = useState(starterCode);
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
    setCode(starterCode);
    setStdout("");
    setStderr("");
    setPythonError("");
    setStatus("idle");
  }

  const isBusy = status === "loading" || status === "running";

  return (
    <section className="mx-auto w-full max-w-5xl space-y-5 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Python practice
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Your code workspace</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{prompt}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="python-code" className="text-sm font-semibold">
          Python code
        </label>
        <textarea
          id="python-code"
          aria-describedby="python-editor-help"
          autoCapitalize="off"
          autoCorrect="off"
          className="min-h-64 w-full resize-y rounded-xl border bg-background px-4 py-3 font-mono text-sm leading-6 outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
          spellCheck={false}
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <p id="python-editor-help" className="text-xs text-muted-foreground">
          Your code runs in a separate browser worker. No app credentials are sent to it.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-60"
          disabled={isBusy}
          onClick={runCode}
          type="button"
        >
          {status === "loading" ? "Starting Python…" : status === "running" ? "Running…" : "Run code"}
        </button>
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-lg border px-5 text-sm font-semibold transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!isBusy}
          onClick={stopCode}
          type="button"
        >
          Stop
        </button>
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-lg border px-5 text-sm font-semibold transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onClick={resetCode}
          type="button"
        >
          Reset
        </button>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {status === "idle" && "Ready when you are."}
          {status === "loading" && "Loading Python in your browser…"}
          {status === "running" && "Your code is running. It will stop after 5 seconds."}
          {status === "complete" && "Run finished."}
          {status === "stopped" && "Run stopped. Press Run to start a fresh worker."}
          {status === "timed-out" && "Your code was stopped after 5 seconds. Press Run to try again."}
          {status === "error" && "Run finished with an error."}
        </p>
      </div>

      <section aria-label="Python console" aria-live="polite" className="space-y-3 rounded-xl bg-slate-950 p-4 text-slate-100">
        <h2 className="text-sm font-semibold">Console</h2>
        {!stdout && !stderr && !pythonError && (
          <p className="font-mono text-sm text-slate-400">Your program output will appear here.</p>
        )}
        {stdout && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">Output</h3>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm">{stdout}</pre>
          </div>
        )}
        {stderr && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-300">Standard error</h3>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm text-amber-100">{stderr}</pre>
          </div>
        )}
        {pythonError && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-rose-300">Python error</h3>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm text-rose-100">{pythonError}</pre>
          </div>
        )}
      </section>
    </section>
  );
}
