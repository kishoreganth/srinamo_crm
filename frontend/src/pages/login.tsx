import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth.store';
import { navigate } from '@/lib/navigate';
import api from '@/lib/api';
import { AsyncButton } from '@/components/motion/async-button';
import { Ambience } from '@/components/motion/ambience';
import { afterCheck, prefersReducedMotion } from '@/components/motion/reduced';
import { useRef, useState, useEffect, type PointerEvent } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { TreePine, Eye, EyeOff, Shield, UserCheck } from 'lucide-react';

const QUICK_LOGINS = [
  { label: 'Admin', email: 'admin@srinamo.com', password: 'admin123', icon: Shield },
  { label: 'Receptionist', email: 'reception@srinamo.com', password: 'reception123', icon: UserCheck },
] as const;

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { setAuth } = useAuthStore();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const shift = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const switchTo = params.get('switch');
    if (switchTo) {
      const preset = QUICK_LOGINS.find(q => q.label.toLowerCase() === switchTo);
      if (preset) {
        setValue('email', preset.email);
        setValue('password', preset.password);
      }
    }
  }, [setValue]);

  const onSubmit = async (data: LoginForm) => {
    setError('');
    setFailed(false);
    setLoading(true);
    try {
      const res = await api.post('/auth/login', data);
      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
      setLoading(false);
      afterCheck(() => navigate('/dashboard'));
    } catch {
      setFailed(true);
      setError('Invalid email or password');
      setLoading(false);
    }
  };

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const layer = shift.current;
    if (!layer || prefersReducedMotion() || window.matchMedia('(pointer: coarse)').matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-12, Math.min(12, ((event.clientX - rect.left) / rect.width) * 24 - 12));
    const y = Math.max(-12, Math.min(12, ((event.clientY - rect.top) / rect.height) * 24 - 12));
    layer.style.translate = `${x}px ${y}px`;
  };

  return (
    <div className="page-bg relative flex min-h-screen items-center justify-center overflow-hidden p-4" onPointerMove={onMove}>
      <div ref={shift} className="absolute inset-0">
        <Ambience />
      </div>
      <Card className="relative z-10 w-full max-w-md p-8">
        <div className="motion-stagger">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <TreePine className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-ink">SriNamo Farms Resort</h1>
          <p className="text-sm text-muted mt-1">Property Management System</p>
        </div>
        </div>

        <div className="motion-stagger">
        <div className="flex gap-2 mb-6">
          {QUICK_LOGINS.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => { setValue('email', q.email); setValue('password', q.password); }}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line bg-surface px-3 py-2.5 text-sm font-medium text-muted transition-all hover:border-accent hover:bg-tint hover:text-accent"
            >
              <q.icon className="h-4 w-4" />
              {q.label}
            </button>
          ))}
        </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="motion-stagger space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@srinamo.com"
              {...register('email')}
              className={errors.email ? 'border-danger' : ''}
            />
            {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
                className={errors.password ? 'border-danger pr-10' : 'pr-10'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-muted"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-danger">{errors.password.message}</p>}
          </div>

          {error && (
            <div className="rounded-lg border border-danger bg-[var(--status-maintenance-bg)] p-3">
              <p className="text-sm text-[var(--status-maintenance-fg)]">{error}</p>
            </div>
          )}

          <AsyncButton type="submit" className="w-full" pending={loading} failed={failed}>
            Sign In
          </AsyncButton>
        </form>
        </Card>
    </div>
  );
}
