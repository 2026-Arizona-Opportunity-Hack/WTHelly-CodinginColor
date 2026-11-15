"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/action-message";
import {
  checkRoster,
  MAX_IMPORT_ROWS,
  type ActionResult,
  type CheckedRow,
} from "@/lib/class-setup/roster";
import { importRoster } from "./actions";

const SAMPLE_CSV = "data:text/csv;charset=utf-8," + encodeURIComponent("name,school\nMaya R,Maryvale High\nJordan T,Maryvale High\n");

/** CLS-2: upload a CSV → preview with each row checked → import the valid rows. */
export function RosterImport({ classId, existingNames }: { classId: string; existingNames: string[] }) {
  const [rows, setRows] = useState<CheckedRow[] | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const valid = rows?.filter((r) => !r.problem) ?? [];
  const invalidCount = (rows?.length ?? 0) - valid.length;

  function reset() {
    setRows(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    setResult(null);
    setRows(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const fail = (message: string) => setResult({ ok: false, message });
    if (file.size > 200_000) return fail("That file is too big. A roster CSV should be under 200 KB.");

    Papa.parse<Record<string, string | undefined>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        if (!res.meta.fields?.includes("name")) {
          return fail('The CSV needs a "name" column in its first row (and optionally "school").');
        }
        if (!res.data.length) return fail("The CSV has no student rows.");
        if (res.data.length > MAX_IMPORT_ROWS) {
          return fail(`That's ${res.data.length} rows. Import up to ${MAX_IMPORT_ROWS} at a time.`);
        }
        // Any "class" column is ignored: every row goes into this class.
        setRows(
          checkRoster(
            res.data.map((r) => ({ name: r.name ?? "", school: r.school ?? "" })),
            existingNames,
          ),
        );
      },
      error: () => fail("We couldn't read that file. Save it as CSV (comma separated) and try again."),
    });
  }

  function confirm() {
    startTransition(async () => {
      const res = await importRoster(
        classId,
        valid.map(({ name, school }) => ({ name, school })),
      );
      setResult(res);
      if (res.ok) reset();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="roster-file" className="text-sm font-medium">
          Roster CSV file
        </label>
        <p id="roster-hint" className="text-sm text-muted-foreground">
          Columns: <code>name</code> (required, first name + last initial) and <code>school</code>{" "}
          (optional).{" "}
          <a
            href={SAMPLE_CSV}
            download="roster-sample.csv"
            className="rounded-sm underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Download a sample CSV
          </a>
        </p>
        <input
          ref={fileRef}
          id="roster-file"
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          aria-describedby="roster-hint"
          className="block w-full max-w-md text-sm file:mr-3 file:h-10 file:rounded-lg file:border file:border-border file:bg-background file:px-3 file:font-medium focus-visible:outline-2 focus-visible:outline-ring"
        />
      </div>

      <ActionMessage result={result} />

      {rows && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <caption className="px-4 py-3 text-left font-medium">
                Preview: {valid.length} ready to import
                {invalidCount ? `, ${invalidCount} will be skipped` : ""}
              </caption>
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {["Row", "Name", "School", "Status"].map((h) => (
                    <th key={h} scope="col" className="px-4 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.row} className={r.problem ? "bg-destructive/5" : undefined}>
                    <td className="px-4 py-2 text-muted-foreground">{r.row}</td>
                    <th scope="row" className="px-4 py-2 font-medium">
                      {r.name || <span className="text-muted-foreground">(empty)</span>}
                    </th>
                    <td className="px-4 py-2">{r.school || "—"}</td>
                    <td className="px-4 py-2">
                      {r.problem ? (
                        <span className="font-medium text-destructive">✗ Invalid: {r.problem}</span>
                      ) : (
                        <span>✓ Valid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={confirm}
              disabled={pending || !valid.length}
              className="h-10 px-4 text-base"
            >
              {pending
                ? "Importing…"
                : `Import ${valid.length} student${valid.length === 1 ? "" : "s"}`}
            </Button>
            <Button type="button" variant="outline" onClick={reset} disabled={pending} className="h-10 px-4">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
