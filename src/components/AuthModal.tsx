import React, { useState, useId } from 'react';
import {
  User,
  KeyRound,
  LogIn,
  UserPlus,
  X,
  Shield,
  Eye,
  EyeOff,
  Mail,
  CheckCircle2,
  AlertCircle,
  Lock,
  Sparkles,
  Zap,
} from 'lucide-react';
import { UserAccount } from '../types/game.ts';
import { AVATAR_OPTIONS, getAvatarById } from '../utils/avatars.ts';
import { AvatarBadge } from './AvatarBadge.tsx';

interface AuthModalProps {
  onSuccess: (user: UserAccount, token: string, rememberMe?: boolean) => void;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

function calculatePasswordStrength(pass: string): {
  score: number; // 0..4
  label: string;
  color: string;
} {
  if (!pass) return { score: 0, label: 'None', color: 'bg-slate-700' };

  let score = 0;
  if (pass.length >= 6) score += 1;
  if (pass.length >= 10) score += 1;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
  if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score += 1;

  if (score === 1) return { score: 1, label: 'Weak', color: 'bg-rose-500' };
  if (score === 2) return { score: 2, label: 'Fair', color: 'bg-amber-500' };
  if (score === 3) return { score: 3, label: 'Good', color: 'bg-sky-400' };
  if (score >= 4) return { score: 4, label: 'Strong', color: 'bg-emerald-400' };
  return { score: 0, label: 'Too short', color: 'bg-rose-500' };
}

export const AuthModal: React.FC<AuthModalProps> = ({
  onSuccess,
  onClose,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [selectedAvatarId, setSelectedAvatarId] = useState('avatar-falcon');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const rememberMeId = useId();

  const passwordStrength = calculatePasswordStrength(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUser = username.trim();
    if (!cleanUser) {
      setErrorMessage('Please enter a username.');
      return;
    }
    if (cleanUser.length < 3 || cleanUser.length > 20) {
      setErrorMessage('Username must be between 3 and 20 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanUser)) {
      setErrorMessage('Username can only contain letters, numbers, hyphens, and underscores.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter a password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match. Please re-enter your password.');
        return;
      }
      if (email && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setErrorMessage('Please provide a valid email address or leave it blank.');
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload =
        mode === 'register'
          ? {
              username: cleanUser,
              password,
              avatarId: selectedAvatarId,
              email: email.trim() || undefined,
            }
          : { username: cleanUser, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setErrorMessage(data.error || 'Authentication failed. Please verify credentials.');
        setLoading(false);
        return;
      }

      if (rememberMe) {
        localStorage.setItem('nueve_auth_token', data.token);
        sessionStorage.removeItem('nueve_auth_token');
        localStorage.setItem('nueve_auth_remember', 'true');
      } else {
        sessionStorage.setItem('nueve_auth_token', data.token);
        localStorage.removeItem('nueve_auth_token');
        localStorage.removeItem('nueve_auth_remember');
      }

      // Automatically import guest progress if available
      try {
        const guestSaved = localStorage.getItem('nueve_guest_stats');
        if (guestSaved && data.token) {
          const parsedGuest = JSON.parse(guestSaved);
          if (parsedGuest && parsedGuest.gamesPlayed > 0) {
            await fetch('/api/auth/merge-guest-stats', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${data.token}`,
              },
              body: JSON.stringify({ guestStats: parsedGuest }),
            });
          }
        }
      } catch {}

      onSuccess(data.user, data.token, rememberMe);
      onClose();
    } catch {
      setErrorMessage('Network error connecting to authentication service.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'MasterSolver9', password: 'solver123' }),
      });
      const data = await res.json();
      if (data.ok && data.user && data.token) {
        if (rememberMe) {
          localStorage.setItem('nueve_auth_token', data.token);
          sessionStorage.removeItem('nueve_auth_token');
        } else {
          sessionStorage.setItem('nueve_auth_token', data.token);
          localStorage.removeItem('nueve_auth_token');
        }
        onSuccess(data.user, data.token, rememberMe);
        onClose();
      } else {
        setErrorMessage(data.error || 'Quick demo login failed.');
      }
    } catch {
      setErrorMessage('Network error connecting to demo account.');
    } finally {
      setLoading(false);
    }
  };

  const selectedAvatar = getAvatarById(selectedAvatarId);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[#131B2E] border border-slate-700/90 rounded-2xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-2xl max-h-[92dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base sm:text-lg font-semibold text-slate-50 truncate">
                {mode === 'login' ? 'Sign In to Account' : 'Create Competitor Account'}
              </h2>
              <p className="text-xs text-slate-400 truncate">
                {mode === 'login'
                  ? 'Access your saved win history and personal records.'
                  : 'Track your career stats, match rankings, and leaderboards.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-1 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Toggle: Sign In vs Create Account */}
        <div className="flex items-center p-1 bg-[#0B0F17] rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage(null);
            }}
            className={`flex-1 min-h-[40px] py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
              mode === 'login'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMessage(null);
            }}
            className={`flex-1 min-h-[40px] py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
              mode === 'register'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Account
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-tight">{errorMessage}</span>
          </div>
        )}

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Username Field */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Username Handle
            </label>
            <div className="relative">
              <input
                type="text"
                required
                maxLength={20}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="e.g. MasterSolver9"
                className="w-full pl-9 pr-4 py-2.5 bg-[#0B0F17] border border-slate-800 focus:border-amber-400 rounded-xl text-slate-100 placeholder-slate-500 text-sm font-medium focus:outline-none transition-colors"
              />
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              3–20 characters (letters, numbers, hyphens, and underscores)
            </p>
          </div>

          {/* Optional Email in Register Mode */}
          {mode === 'register' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-300">
                  Email Address
                </label>
                <span className="text-[10px] text-slate-500">Optional</span>
              </div>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="solver@example.com"
                  className="w-full pl-9 pr-4 py-2.5 bg-[#0B0F17] border border-slate-800 focus:border-amber-400 rounded-xl text-slate-100 placeholder-slate-500 text-sm font-medium focus:outline-none transition-colors"
                />
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Password Field with Show/Hide Toggle */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300">
                Password
              </label>
              {mode === 'register' && password.length > 0 && (
                <span className="text-[10px] font-mono text-slate-400">
                  Strength:{' '}
                  <strong className={passwordStrength.score >= 3 ? 'text-emerald-400' : 'text-amber-400'}>
                    {passwordStrength.label}
                  </strong>
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="At least 6 characters"
                className="w-full pl-9 pr-10 py-2.5 bg-[#0B0F17] border border-slate-800 focus:border-amber-400 rounded-xl text-slate-100 placeholder-slate-500 text-sm font-medium focus:outline-none transition-colors"
              />
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password strength progress bar in Register Mode */}
            {mode === 'register' && password.length > 0 && (
              <div className="mt-1.5 space-y-1">
                <div className="grid grid-cols-4 gap-1.5 h-1">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={`h-full rounded-full transition-colors ${
                        passwordStrength.score >= step
                          ? passwordStrength.color
                          : 'bg-slate-800'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password Field in Register Mode */}
          {mode === 'register' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-300">
                  Confirm Password
                </label>
                {confirmPassword.length > 0 && (
                  <span className="text-[10px] font-mono flex items-center gap-1">
                    {passwordsMatch ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Matches</span>
                      </span>
                    ) : (
                      <span className="text-rose-400">Does not match</span>
                    )}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="Re-type your password"
                  className={`w-full pl-9 pr-10 py-2.5 bg-[#0B0F17] border rounded-xl text-slate-100 placeholder-slate-500 text-sm font-medium focus:outline-none transition-colors ${
                    confirmPassword.length > 0
                      ? passwordsMatch
                        ? 'border-emerald-500/60 focus:border-emerald-400'
                        : 'border-rose-500/60 focus:border-rose-400'
                      : 'border-slate-800 focus:border-amber-400'
                  }`}
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Registration Starter Insignia Chooser */}
          {mode === 'register' && (
            <div className="space-y-2 pt-1 border-t border-slate-800/60">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300">Choose Starter Insignia</span>
                <span className="text-amber-400 text-[11px] font-mono">{selectedAvatar.name}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                {AVATAR_OPTIONS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedAvatarId(a.id)}
                    className={`p-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      selectedAvatarId === a.id
                        ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/30'
                        : 'bg-[#0B0F17] hover:bg-slate-800/80 border-slate-800'
                    }`}
                  >
                    <AvatarBadge avatarId={a.id} size="sm" />
                    <span className="text-[10px] text-slate-300 font-medium truncate max-w-full">
                      {a.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Remember Me Option */}
          <div className="flex items-center justify-between pt-1">
            <label htmlFor={rememberMeId} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                id={rememberMeId}
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-[#0B0F17] border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
              />
              <span className="text-xs text-slate-300">Keep me signed in</span>
            </label>
            <span className="text-[10px] text-slate-500 font-mono">Secure Token</span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer shadow-md shadow-amber-500/20"
          >
            {mode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>{loading ? 'Verifying Credentials...' : 'Sign In'}</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>{loading ? 'Creating Account...' : 'Complete Registration'}</span>
              </>
            )}
          </button>

          {/* Quick Demo Solver Account 1-Click Test Button */}
          <button
            type="button"
            disabled={loading}
            onClick={handleQuickDemoLogin}
            className="w-full py-2.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Instant Demo Account (MasterSolver9)</span>
          </button>
        </form>

        <div className="pt-2 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-400">
            {mode === 'login'
              ? "Don't have an account yet? "
              : 'Already have an existing account? '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setErrorMessage(null);
              }}
              className="text-amber-400 hover:underline font-semibold cursor-pointer ml-1"
            >
              {mode === 'login' ? 'Create one now' : 'Sign In instead'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
