import { PythonRunner } from "@/components/activities/python-runner";
import Link from "next/link";

export default function PythonRunnerDemoPage() {
  return (
    <main className="min-h-screen bg-muted/40 px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto mb-6 max-w-5xl">
        <Link className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline" href="/">
          ← Back to Coding in Color
        </Link>
      </div>
      <PythonRunner
        prompt="Practice using a loop. Run the starter code, then change it to print the numbers from 1 to 5."
        starterCode={'for number in range(1, 4):\n    print(number)'}
      />
    </main>
  );
}
