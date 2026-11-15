"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffWriter, idSchema, isAssignableInstructor } from "@/lib/class-setup/access";
import { generateJoinCode } from "@/lib/class-setup/join-code";
import { cleanText } from "@/lib/class-setup/roster";

export type NewClassState = {
  ok: boolean;
  message: string;
  field?: "name" | "cohortId" | "instructorId";
  values?: { name: string; cohortId: string; instructorId: string };
};

const newClassSchema = z.object({
  name: z.string().min(1, "Enter a class name.").max(80, "Class names are 80 characters or fewer."),
  cohortId: idSchema.or(z.literal("")).refine((v) => v !== "", "Pick a cohort."),
});

/** CLS-1: create a class with a unique join code, owned by the signed-in user (or, for admins, a chosen instructor). */
export async function createClass(_prev: NewClassState, formData: FormData): Promise<NewClassState> {
  const values = {
    name: cleanText(formData.get("name")),
    cohortId: String(formData.get("cohortId") ?? ""),
    instructorId: String(formData.get("instructorId") ?? ""),
  };
  const fail = (message: string, field?: NewClassState["field"]): NewClassState => ({
    ok: false,
    message,
    field,
    values,
  });

  const parsed = newClassSchema.safeParse(values);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue.message, issue.path[0] as "name" | "cohortId");
  }

  const staff = await getStaffWriter();
  if (!staff) return fail("Only instructors and admins can create classes.");
  const { supabase, user } = staff;

  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id")
    .eq("id", parsed.data.cohortId)
    .maybeSingle();
  if (!cohort) return fail("That cohort no longer exists. Pick another.", "cohortId");

  // Admins may assign the class to another instructor; everyone else owns their own.
  let instructorId = user.id;
  if (staff.role === "admin" && values.instructorId && values.instructorId !== user.id) {
    if (!(await isAssignableInstructor(supabase, values.instructorId))) {
      return fail("Pick an instructor from the list.", "instructorId");
    }
    instructorId = values.instructorId;
  }

  // Insert as the user: RLS only allows instructor_id = auth.uid() (or an admin).
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from("classes")
      .insert({
        name: parsed.data.name,
        cohort_id: cohort.id,
        instructor_id: instructorId,
        join_code: generateJoinCode(),
      })
      .select("id")
      .single();
    if (data) {
      revalidatePath("/instructor", "layout");
      redirect(`/instructor/classes/${data.id}/manage?created=1`);
    }
    if (error?.code !== "23505") {
      console.error("createClass failed", error?.code);
      return fail("We couldn't create the class. Try again in a moment.");
    }
    // 23505: join code collision. Try a new code.
  }
  return fail("We couldn't create a unique class code. Try again.");
}
