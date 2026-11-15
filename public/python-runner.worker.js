import { loadPyodide, version } from "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs";

let pyodidePromise;

function send(message) {
  self.postMessage(message);
}

function getPyodide() {
  pyodidePromise ??= loadPyodide({
    indexURL: `https://cdn.jsdelivr.net/pyodide/v${version}/full/`,
  });

  return pyodidePromise;
}

function disableNetworkAccess() {
  self.fetch = () =>
    Promise.reject(new Error("Network access is disabled in this code runner."));
}

function createWriter(runId, stream, decoder) {
  return {
    write(buffer) {
      const text = decoder.decode(buffer, { stream: true });
      if (text) send({ type: "output", runId, stream, text });
      return buffer.byteLength;
    },
  };
}

self.onmessage = async (event) => {
  const request = event.data;
  if (
    !request ||
    request.type !== "run" ||
    !Number.isSafeInteger(request.runId) ||
    typeof request.code !== "string"
  ) {
    return;
  }

  const { runId, code } = request;

  send({ type: "status", runId, status: "loading" });

  let stdoutDecoder;
  let stderrDecoder;
  let failure;
  let failurePhase = "initialization";

  try {
    const pyodide = await getPyodide();
    disableNetworkAccess();

    stdoutDecoder = new TextDecoder();
    stderrDecoder = new TextDecoder();
    pyodide.setStdout(createWriter(runId, "stdout", stdoutDecoder));
    pyodide.setStderr(createWriter(runId, "stderr", stderrDecoder));
    pyodide.setStdin({ error: true });

    failurePhase = "execution";
    send({ type: "status", runId, status: "running" });
    await pyodide.runPythonAsync(code);
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  } finally {
    const stdoutTail = stdoutDecoder?.decode();
    const stderrTail = stderrDecoder?.decode();
    if (stdoutTail) send({ type: "output", runId, stream: "stdout", text: stdoutTail });
    if (stderrTail) send({ type: "output", runId, stream: "stderr", text: stderrTail });
  }

  if (failure) {
    send({ type: "error", runId, phase: failurePhase, message: failure });
  } else {
    send({ type: "complete", runId });
  }
};
