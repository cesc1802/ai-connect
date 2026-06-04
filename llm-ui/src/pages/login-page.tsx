import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LoginForm } from '@/components/auth/login-form';

export function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-[420px]">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Sign in to LLM-UI</CardTitle>
          <CardDescription>Enter your email and password to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
        <CardFooter>
          <button
            type="button"
            disabled
            className="text-muted-foreground text-sm underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
            aria-disabled="true"
          >
            Forgot password?
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
