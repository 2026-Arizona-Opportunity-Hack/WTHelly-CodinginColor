import { PythonRunner } from "@/components/activities/python-runner";
import Link from "next/link";

export default function PythonRunnerDemoPage() {
  return (
    <main id="main" className="min-h-screen bg-[#f3e6d4] px-4 py-8 text-[#382a26] sm:px-8 sm:py-12">
      <div className="mx-auto mb-6 max-w-4xl">
        <Link className="text-sm font-semibold text-[#64252e] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#752a32]" href="/">
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
