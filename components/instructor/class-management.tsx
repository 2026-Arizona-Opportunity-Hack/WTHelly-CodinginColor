"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

export type CohortOption = { id: string; name: string; school: string; program: string; term: string };
export type InstructorClass = {
  id: string;
  name: string;
  joinCode: string;
  cohortId: string | null;
  cohort: CohortOption | null;
};

/** Frontend values only. The backend owner supplies the API contract and adapter. */
export type CreateClassInput = { name: string; cohortId: string };
export type CreateClassResult = { id: string; name: string; joinCode: string };
export type CreateClassHandler = (input: CreateClassInput) => Promise<CreateClassResult>;

type Props = { initialClasses: InstructorClass[]; cohorts: CohortOption[]; onCreate?: CreateClassHandler };
const field = "mt-2 min-h-11 w-full rounded-lg border border-[#cda999] bg-white px-3 py-2 text-[#392b2a] outline-none focus-visible:ring-2 focus-visible:ring-[#77323e]";
const label = "block text-sm font-semibold text-[#5a3336]";

export function ClassManagement({ initialClasses, cohorts, onCreate }: Props) {
  const router = useRouter();
  const [classes, setClasses] = useState(initialClasses);
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [program, setProgram] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreateClassResult | null>(null);

  const schools = useMemo(() => [...new Set(cohorts.map((c) => c.school))].sort(), [cohorts]);
  const programs = [...new Set(cohorts.filter((c) => c.school === school).map((c) => c.program))].sort();
  const availableCohorts = cohorts.filter((c) => c.school === school && c.program === program);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCreated(null);
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 100) {
      setError("Enter a class name of 1 to 100 characters.");
      return;
    }
    const selected = availableCohorts.find((c) => c.id === cohortId);
    if (!selected) {
      setError("Choose a school, program and cohort.");
      return;
    }
    if (!onCreate) {
      setError("Class creation is awaiting the backend connection.");
      return;
    }
    setPending(true);
    try {
      const result = await onCreate({ name: trimmedName, cohortId: selected.id });
      if (!result.id || !result.joinCode) throw new Error("Class creation was not confirmed.");
      setClasses((current) => [
        { id: result.id, name: result.name, joinCode: result.joinCode, cohortId: selected.id, cohort: selected },
        ...current.filter((item) => item.id !== result.id),
      ]);
      setCreated(result);
      setName("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the class. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-9 text-[#392b2a]">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9a5c53]">Instructor workspace</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-[#682c38] sm:text-4xl">Your classes</h1>
        <p className="mt-2 max-w-2xl text-[#6f5a54]">Set up a class, then open it to manage its roster and lessons.</p>
      </header>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)] lg:items-start">
        <section aria-labelledby="class-list-title" className="rounded-2xl border border-[#e4cdbd] bg-[#fffdf8] p-5 shadow-sm sm:p-6">
          <h2 id="class-list-title" className="font-serif text-2xl font-semibold text-[#682c38]">Class list</h2>
          {classes.length === 0 ? (
            <p className="mt-5 rounded-xl bg-[#f8eee6] p-4 text-[#6f5a54]">You do not have a class yet.</p>
          ) : (
            <ul className="mt-5 space-y-3">
              {classes.map((item) => (
                <li key={item.id} className="rounded-xl border border-[#ead6c7] bg-white p-4">
                  <Link href={`/instructor/classes/${item.id}`} className="font-semibold text-[#682c38] underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#77323e]">{item.name}</Link>
                  <p className="mt-1 text-sm text-[#6f5a54]">{item.cohort ? `${item.cohort.school} · ${item.cohort.program} · ${item.cohort.name}` : "No cohort assigned"}</p>
                  <p className="mt-2 text-sm">Join code: <span className="font-mono font-semibold tracking-wider">{item.joinCode}</span></p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="create-class-title" className="rounded-2xl border border-[#e4cdbd] bg-[#fff8ee] p-5 shadow-sm sm:p-6">
          <h2 id="create-class-title" className="font-serif text-2xl font-semibold text-[#682c38]">Create a class</h2>
          <p className="mt-2 text-sm text-[#6f5a54]">Choose an existing cohort for its school and program.</p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className={label}>Class name<input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required disabled={pending} placeholder="e.g. Intro to Python · Period 1" /></label>
            <label className={label}>School<select className={field} value={school} onChange={(e) => { setSchool(e.target.value); setProgram(""); setCohortId(""); }} required disabled={pending || schools.length === 0}><option value="">Select a school</option>{schools.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className={label}>Program<select className={field} value={program} onChange={(e) => { setProgram(e.target.value); setCohortId(""); }} required disabled={pending || !school}><option value="">Select a program</option>{programs.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className={label}>Cohort<select className={field} value={cohortId} onChange={(e) => setCohortId(e.target.value)} required disabled={pending || !program}><option value="">Select a cohort</option>{availableCohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name} · {cohort.term}</option>)}</select></label>
            {cohorts.length === 0 && <p className="text-sm text-[#79343e]">No cohorts are available. Ask an admin to create one first.</p>}
            {!onCreate && <p className="rounded-lg border border-[#dec2b0] bg-white p-3 text-sm text-[#6f4f47]">Class creation will be available after the backend API is connected.</p>}
            {error && <p role="alert" className="text-sm font-medium text-[#912e39]">{error}</p>}
            {created && <p role="status" className="rounded-lg border border-[#b9d1b1] bg-[#f0f8ec] p-3 text-sm">Class created. Join code: <strong className="font-mono">{created.joinCode}</strong>. <Link href={`/instructor/classes/${created.id}`} className="underline">Open class</Link></p>}
            <button type="submit" disabled={pending || cohorts.length === 0} className="min-h-11 w-full rounded-lg bg-[#77323e] px-5 py-2 font-semibold text-white outline-none hover:bg-[#632933] focus-visible:ring-2 focus-visible:ring-[#77323e] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Creating class…" : "Create class"}</button>
          </form>
        </section>
      </div>
    </div>
  );
}
