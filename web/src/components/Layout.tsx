import type { ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useLogSheet } from '../lib/LogSheet';
import { AwardIcon, PlusIcon, SlidersIcon, TrophyIcon, UsersIcon } from './Icons';

/**
 * App shell: page content plus the Arena bottom nav – four destinations around a
 * big lime "+" that opens the Log sheet from anywhere.
 */
export function Layout() {
  const { pathname } = useLocation();
  const log = useLogSheet();

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="app-main">
        <Outlet />
      </main>

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

function NavTab({ to, active, icon, label }: { to: string; active: boolean; icon: ReactNode; label: string }) {
  return (
    <NavLink to={to} className="nav-item" data-active={active} aria-current={active ? 'page' : undefined}>
      <span style={{ display: 'grid', placeItems: 'center', strokeWidth: active ? 2.2 : 1.8 }}>{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}
