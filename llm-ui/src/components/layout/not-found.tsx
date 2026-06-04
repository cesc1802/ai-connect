import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

export function NotFound() {
  return (
    <div className="bg-background flex h-full w-full items-center justify-center p-4">
      <div className="bg-card w-full max-w-[420px] rounded-xl border p-6 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          That URL doesn't exist in this app.
        </p>
        <Button asChild className="mt-4">
          <Link to="/chat">Go to chat</Link>
        </Button>
      </div>
    </div>
  );
}
