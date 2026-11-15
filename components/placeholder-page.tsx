// Temporary stand-in used by every route until its build step lands.
export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-muted-foreground">{description}</p>
      <p className="mt-6 text-sm text-muted-foreground">Coming soon.</p>
    </main>
  );
}
