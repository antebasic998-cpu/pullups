import type { ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useAsync, useTheme } from '../lib/hooks';
import { useDataVersion } from '../lib/store';
import { MoonIcon, PlusIcon, SunIcon } from './Icons';

export function Layout() {
  const { theme, toggle } = useTheme();
  const version = useDataVersion();
  const { data: meta } = useAsync(() => api.meta(), [version]);
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
        <div className="shell flex min-h-14 flex-wrap items-center gap-x-2.5 gap-y-1 py-1.5 sm:gap-x-4 sm:py-0">
          {/* The wordmark is the first thing to go on a phone – each page has its own title. */}
          <NavLink
            to="/"
            className="hidden text-sm font-semibold no-underline sm:block"
            style={{ color: 'var(--text)' }}
          >
            Pull-Up & Chin-Up Leaderboard
          </NavLink>

          <nav className="flex items-center gap-1">
            <NavTab to="/" active={pathname === '/'}>
              Board
            </NavTab>
            <NavTab to="/awards" active={pathname.startsWith('/awards')}>
              Awards
            </NavTab>
            <NavTab to="/users" active={pathname.startsWith('/users')}>
              Athletes
            </NavTab>
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            {meta && meta.userCount > 0 ? (
              <span className="mr-1 hidden text-xs faint sm:inline">median {meta.medianMassKg} kg</span>
            ) : null}
            <button type="button" className="icon-btn" onClick={toggle} aria-label="Toggle light and dark theme" title="Toggle theme">
              {theme === 'dark' ? <SunIcon size={15} /> : <MoonIcon size={15} />}
            </button>
            <NavLink to="/users?new=1" className="btn btn-primary btn-sm no-underline">
              <PlusIcon size={14} />
              <span className="hidden sm:inline">Add athlete</span>
              <span className="sm:hidden">Add</span>
            </NavLink>
          </div>
        </div>
      </header>

      <main className="flex-1 py-7">
        <Outlet />
      </main>

      <footer className="shell pb-8 pt-2">
        <p className="m-0 text-xs faint">
          score = pull-ups × (bodyweight ÷ office median) ^ 0.67 ·{' '}
          <a href="/api/backup" className="no-underline" style={{ color: 'var(--muted)' }}>
            download backup
          </a>{' '}
          · data in <code>data/db.json</code>
        </p>
      </footer>
    </div>
  );
}

function NavTab({ to, active, children }: { to: string; active: boolean; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className="nav-tab rounded-lg px-2.5 py-1.5 text-sm no-underline transition-colors"
      style={{ color: active ? 'var(--text)' : 'var(--muted)', fontWeight: active ? 600 : 500 }}
    >
      {children}
    </NavLink>
  );
}
