"use client";

import { useState } from "react";
import { ActivityPlayer, type PlayerActivity, type PlayerAnswers } from "@/components/activities/activity-player";

const activities: PlayerActivity[] = [
  {
    id: "video",
    title: "Loops in motion",
    content: { type: "video", url: "https://www.youtube.com/watch?v=M7lc1UVf-VE", notes: "Preview video content. A real lesson supplies its own video and notes." },
  },
  {
    id: "check",
    title: "Quick check",
    content: { type: "check", prompt: "Which word starts a Python loop over a sequence?", options: ["for", "print", "return"] },
  },
  {
    id: "worksheet",
    title: "Practice sheet",
    content: { type: "worksheet", questions: [{ id: "reflection", kind: "short", prompt: "Where could you use a loop?" }] },
  },
  {
    id: "code",
    title: "Try a Python loop",
    content: { type: "code", prompt: "Print the numbers 1 through 5 using a loop.", starterCode: "for number in range(1, 4):\n    print(number)" },
  },
  {
    id: "exit",
    title: "Exit reflection",
    content: { type: "exit", kind: "short", prompt: "What is one thing you learned about loops?" },
  },
];

export default function ActivityPlayerDemo() {
  const [selectedId, setSelectedId] = useState(activities[0].id);
  const [answers, setAnswers] = useState<PlayerAnswers>({});
  const selected = activities.find((activity) => activity.id === selectedId) ?? activities[0];

  return (
    <main id="main" className="min-h-screen bg-[#f3e6d4] px-4 py-8 text-[#382a26] sm:px-6">
      <div className="mx-auto mb-5 max-w-4xl rounded-2xl border border-[#d7b89f] bg-[#fffaf1] p-4 text-sm shadow-[0_3px_0_rgba(120,73,51,0.08)] sm:p-5">
        <p className="font-serif text-2xl font-semibold text-[#5d2028]">Activity player preview</p>
        <p className="mt-2 leading-6">Choose a screen to inspect. This preview does not save answers. Join a class and open /learn to test real submission.</p>
        <label htmlFor="preview-activity" className="mt-4 block font-semibold text-[#5d2028]">Preview activity</label>
        <select id="preview-activity" value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setAnswers({}); }} className="mt-2 min-h-12 w-full rounded-xl border border-[#b98770] bg-[#fffdf8] px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-[#7a2932] sm:max-w-sm">
          {activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}
        </select>
      </div>
      <ActivityPlayer key={selected.id} moduleTitle="Introduction to Loops" activities={[selected]} preview onChange={setAnswers} />
      <p aria-live="polite" className="mx-auto mt-4 max-w-4xl text-sm text-[#765d51]">Local answer: {JSON.stringify(answers[selected.id] ?? null)}</p>
    </main>
  );
}
