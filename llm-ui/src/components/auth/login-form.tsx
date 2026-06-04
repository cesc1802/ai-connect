import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormFieldError } from '@/components/feedback/form-field-error';
import { LoginRequest, type LoginRequest as LoginRequestType } from '@/schemas/auth';
import { useLogin } from '@/hooks/use-login';
import { ApiError, NetworkError } from '@/api/errors';

export function LoginForm() {
  const emailId = useId();
  const passwordId = useId();
  const rootErrorId = useId();
  const navigate = useNavigate();
  const loginMutation = useLogin();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequestType>({
    resolver: zodResolver(LoginRequest),
    defaultValues: { email: '', password: '' },
    mode: 'onSubmit',
  });

  const pending = isSubmitting || loginMutation.isPending;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await loginMutation.mutateAsync(values);
      await navigate({ to: '/workspaces/pick' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('root', { message: 'Invalid email or password' });
        return;
      }
      if (err instanceof NetworkError) {
        toast.error('Network error — please check your connection.');
        return;
      }
      setError('root', { message: 'Something went wrong. Try again.' });
    }
  });

  const rootError = errors.root?.message;
  const emailError = errors.email?.message;
  const passwordError = errors.password?.message;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor={emailId}>Email</Label>
        <Input
          id={emailId}
          type="email"
          autoComplete="email"
          aria-invalid={!!emailError}
          aria-describedby={emailError ? `${emailId}-error` : undefined}
          disabled={pending}
          {...register('email')}
        />
        <FormFieldError id={`${emailId}-error`} message={emailError} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={passwordId}>Password</Label>
        <Input
          id={passwordId}
          type="password"
          autoComplete="current-password"
          aria-invalid={!!passwordError}
          aria-describedby={passwordError ? `${passwordId}-error` : undefined}
          disabled={pending}
          {...register('password')}
        />
        <FormFieldError id={`${passwordId}-error`} message={passwordError} />
      </div>

      <FormFieldError id={rootErrorId} message={rootError} />

      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Signing in…
          </>
        ) : (
          'Sign in'
        )}
      </Button>
    </form>
  );
}
