import type { ReactNode } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { useLogSheet } from '../lib/LogSheet';
import { useTheme } from '../lib/hooks';
import {
  AwardIcon,
  MoonIcon,
  PlusIcon,
  SlidersIcon,
  SunIcon,
  TrophyIcon,
  UsersIcon,
} from './Icons';

/**
 * App shell:
 * - Desktop: Sleek top header navigation with brand, links, theme toggle, and "+ Log Result" CTA.
 * - Mobile: Classic Arena bottom dock navigation around the lime FAB.
 */
export function Layout() {
  const { pathname } = useLocation();
  const log = useLogSheet();
  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Desktop Header Navigation (>= 768px) */}
      <header className="desktop-header">
        <div className="desktop-nav-shell">
          <Link to="/" className="desktop-brand">
            <span className="desktop-brand-badge">
              <TrophyIcon size={18} strokeWidth={2.4} />
            </span>
            <div className="desktop-brand-text">
              <span className="desktop-brand-title">PULL-UP LEADERBOARD</span>
              <span className="desktop-brand-tag">OFFICE ARENA</span>
            </div>
          </Link>

          <nav className="desktop-nav-links" aria-label="Desktop Main">
            <DesktopNavLink to="/" active={pathname === '/'} icon={<TrophyIcon size={17} />} label="Board" />
            <DesktopNavLink to="/awards" active={pathname.startsWith('/awards')} icon={<AwardIcon size={17} />} label="Awards" />
            <DesktopNavLink to="/users" active={pathname.startsWith('/users')} icon={<UsersIcon size={17} />} label="Athletes" />
            <DesktopNavLink to="/settings" active={pathname.startsWith('/settings')} icon={<SlidersIcon size={17} />} label="Settings" />
          </nav>

          <div className="desktop-nav-actions">
            <button
              type="button"
              className="desktop-theme-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
            </button>

            <button
              type="button"
              className="desktop-log-btn"
              onClick={() => log.open()}
              title="Log a result"
              aria-label="Log a result"
            >
              <PlusIcon size={17} strokeWidth={2.8} />
              <span>Log Result</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="app-main">
        <Outlet />
      </main>

      {/* Mobile Bottom Dock (< 768px) */}
      <div className="nav-dock">
        <nav className="nav-bar" aria-label="Main">
          <NavTab to="/" active={pathname === '/'} icon={<TrophyIcon size={23} />} label="Board" />
          <NavTab to="/awards" active={pathname.startsWith('/awards')} icon={<AwardIcon size={23} />} label="Awards" />
          <div className="nav-fab-slot">
            <button type="button" className="fab" onClick={() => log.open()} aria-label="Log a result" title="Log a result">
              <PlusIcon size={28} strokeWidth={2.6} />
            </button>
          </div>
          <NavTab
            to="/users"
            active={pathname.startsWith('/users')}
            icon={<UsersIcon size={23} />}
            label="Athletes"
          />
          <NavTab
            to="/settings"
            active={pathname.startsWith('/settings')}
            icon={<SlidersIcon size={23} />}
            label="Settings"
          />
        </nav>
      </div>
    </div>
  );
}

function DesktopNavLink({
  to,
  active,
  icon,
  label,
}: {
  to: string;
  active: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      className="desktop-nav-link"
      data-active={active}
      aria-current={active ? 'page' : undefined}
    >
      <span className="desktop-nav-icon">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

function NavTab({ to, active, icon, label }: { to: string; active: boolean; icon: ReactNode; label: string }) {
  return (
    <NavLink to={to} className="nav-item" data-active={active} aria-current={active ? 'page' : undefined}>
      <span style={{ display: 'grid', placeItems: 'center', strokeWidth: active ? 2.2 : 1.8 }}>{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}
