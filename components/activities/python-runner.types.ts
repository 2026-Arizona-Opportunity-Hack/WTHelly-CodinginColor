export type PythonRunnerRequest = {
  type: "run";
  runId: number;
  code: string;
};

export type PythonRunnerResponse =
  | { type: "status"; runId: number; status: "loading" | "running" }
  | {
      type: "output";
      runId: number;
      stream: "stdout" | "stderr";
      text: string;
    }
  | { type: "complete"; runId: number }
  | {
      type: "error";
      runId: number;
      phase: "initialization" | "execution";
      message: string;
    };
