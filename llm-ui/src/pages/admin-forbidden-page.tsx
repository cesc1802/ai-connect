import { Link } from '@tanstack/react-router';

export function AdminForbiddenPage() {
  return (
    <main
      role="main"
      aria-labelledby="admin-forbidden-heading"
      className="bg-background text-foreground flex h-full w-full items-center justify-center p-6"
    >
      <div className="max-w-md text-center">
        <h1
          id="admin-forbidden-heading"
          className="text-foreground text-3xl font-semibold"
        >
          Access denied
        </h1>
        <p className="text-muted-foreground mt-3">
          You do not have permission to view this page.
        </p>
        <Link
          to="/chat"
          className="text-primary hover:text-primary/80 focus-visible:ring-ring mt-6 inline-block underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2"
        >
          Return to chat
        </Link>
      </div>
    </main>
  );
}
