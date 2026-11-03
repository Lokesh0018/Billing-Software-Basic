import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { errorMessage } from '../../api/client';
import { TiffinMark } from '../../components/Layout';
import { Button } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';

export function LoginPage() {
  const { user, login } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';
  if (user) return <Navigate to={from} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Login failed'));
    } finally {
      setSubmitting(false);
    }
  };


  const shop = branding.shopName || branding.appName;

  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-brand-900 text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-14">
        <div className="flex items-center gap-3">
          <TiffinMark className="size-10" onDark />
          <div className="leading-tight">
            <p className="text-lg font-semibold">{branding.appName}</p>
            {branding.appTagline && <p className="text-sm text-brand-300">{branding.appTagline}</p>}
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-10">
          <div>
            <h2 className="max-w-md text-[40px] leading-[1.08] font-semibold tracking-[-0.025em] xl:text-[46px]">Every idly, every rupee, counted.</h2>
            <p className="mt-5 max-w-sm text-[17px] leading-relaxed text-brand-200">
              Bill the breakfast rush in seconds, print the receipt, and see the day's takings the moment they come in.
            </p>
          </div>

          {/* The product's own object: an 80mm counter receipt */}
          <div data-ui aria-hidden className="w-[230px] rotate-[3deg] bg-white px-5 pt-5 pb-6 font-mono text-[11px] leading-[1.55] text-brand-900 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.55)] xl:w-[250px]">
            <p className="text-center text-[13px] font-bold">{shop}</p>
            <p className="text-center text-brand-500">Bill receipt</p>
            <div className="my-2.5 border-t border-dashed border-brand-300" />
            {[
              ['Idly', '2', '80.00'],
              ['Masala Dosa', '1', '60.00'],
              ['Vada', '2', '60.00'],
              ['Filter Coffee', '2', '40.00'],
            ].map(([n, q, a]) => (
              <div key={n} className="flex justify-between gap-2">
                <span className="truncate">{n}</span>
                <span className="shrink-0">
                  {q} × <span className="inline-block w-12 text-right">{a}</span>
                </span>
              </div>
            ))}
            <div className="my-2.5 border-t border-dashed border-brand-300" />
            <div className="flex justify-between text-[14px] font-bold">
              <span>TOTAL</span>
              <span>₹240.00</span>
            </div>
            <p className="mt-1 text-brand-500">Paid by UPI</p>
            <div className="my-2.5 border-t border-dashed border-brand-300" />
            <p className="text-center">Thank you! Visit again.</p>
          </div>
        </div>

        <p className="text-sm text-brand-300">
          © {new Date().getFullYear()} {branding.appName}
        </p>
      </div>

      {/* Sign-in */}
      <div className="flex items-center justify-center px-6 py-12 sm:px-10">
        <form onSubmit={onSubmit} className="w-full max-w-[380px]" noValidate>
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <TiffinMark className="size-10" />
            <p className="text-lg font-semibold text-brand-900">{branding.appName}</p>
          </div>
          <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.015em] text-brand-900">Sign in</h1>
          <p className="mt-1.5 text-[15px] text-slate-600">to {shop}</p>

          {error && (
            <div role="alert" className="rise-in mt-6 rounded-[22px] border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="mt-8 space-y-5">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  autoFocus
                  required
                  className="input h-11 pl-10 text-[15px]"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="input h-11 pr-11 pl-10 text-[15px]"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-raised hover:text-brand-900"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </div>

          <Button type="submit" size="lg" className="mt-8 w-full" loading={submitting} disabled={!email || !password}>
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
