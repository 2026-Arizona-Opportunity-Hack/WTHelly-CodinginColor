import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="outline" className="h-9">
        Sign out
      </Button>
    </form>
  );
}
