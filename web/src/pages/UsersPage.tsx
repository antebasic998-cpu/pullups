import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../lib/hooks';
import { useDataVersion } from '../lib/store';
import { daysAgo, formatKg, pluralize, reps } from '../lib/format';
import { Avatar, EmptyState } from '../components/Bits';
import { AttemptFormModal } from '../components/AttemptFormModal';
import { UserFormModal } from '../components/UserFormModal';
import { PlusIcon, SearchIcon } from '../components/Icons';
import type { UserSummary } from '../types';

/**
 * The roster: who is on the board and their normalized PB, with one action per
 * row (log a result). Editing, importing and removing live on the profile, so
 * this page stays a clean list.
 */
export function UsersPage() {
  const [params, setParams] = useSearchParams();
  const version = useDataVersion();
  const navigate = useNavigate();
  const { data, loading, error } = useAsync(() => api.users(), [version]);

  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [logging, setLogging] = useState<UserSummary | null>(null);

  // The header's "Add athlete" button deep-links to /users?new=1
  useEffect(() => {
    if (params.get('new') === '1') {
      setAddOpen(true);
      params.delete('new');
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const users = useMemo(() => {
    const list = (data?.users ?? []).filter((u) => u.name.toLowerCase().includes(query.trim().toLowerCase()));
    return [...list].sort((a, b) => b.pbNormalized - a.pbNormalized || a.name.localeCompare(b.name));
  }, [data, query]);

  return (
    <div className="shell">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-xl font-semibold tracking-tight">Athletes</h1>
          <p className="m-0 mt-1 text-sm muted">
            {data && data.userCount > 0
              ? `${pluralize(data.userCount, 'athlete')} · median ${formatKg(data.medianMassKg)}`
              : data
                ? 'Nobody on the board yet'
                : 'Personal bests'}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
          <PlusIcon size={15} />
          Add athlete
        </button>
      </header>

      <div className="relative mb-4 max-w-xs">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 faint">
          <SearchIcon size={14} />
        </span>
        <input
          className="input pl-8"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search athletes"
        />
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {loading && !data ? (
        <div className="panel p-1">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="skeleton my-1.5" style={{ height: 46 }} />
          ))}
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          title={query ? 'No match' : 'No athletes yet'}
          message={
            query
              ? 'Nothing matches that search.'
              : 'Add someone with their name, age and bodyweight. You can log a personal best right away, or import a history from a spreadsheet.'
          }
          action={
            query ? (
              <button type="button" className="btn mt-2" onClick={() => setQuery('')}>
                Clear search
              </button>
            ) : (
              <button type="button" className="btn btn-primary mt-2" onClick={() => setAddOpen(true)}>
                Add athlete
              </button>
            )
          }
        />
      ) : (
        <div className="panel fade-in">
          {users.map((user) => (
            <div key={user.id} className="row roster-cols">
              <Link
                to={`/users/${user.id}`}
                className="flex min-w-0 items-center gap-2.5 no-underline"
                style={{ color: 'inherit' }}
              >
                <Avatar name={user.name} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{user.name}</span>
                  <span className="block truncate text-xs muted">
                    {[
                      user.age ? `${user.age}y` : null,
                      formatKg(user.weightKg),
                      user.sessionCount > 0
                        ? `${pluralize(user.sessionCount, 'attempt')} · ${daysAgo(user.lastResult?.date)}`
                        : 'no attempts yet',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </Link>

              <span className="num text-right font-semibold">
                {user.sessionCount > 0 ? user.pbNormalized.toFixed(2) : <span className="faint">–</span>}
              </span>

              <span className="flex items-center justify-end gap-2">
                <span className="roster-detail num text-xs muted">
                  {user.sessionCount > 0 ? reps(user.pbAbsolute) : ''}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-quiet"
                  onClick={() => setLogging(user)}
                  title={`Log a result for ${user.name}`}
                >
                  Log
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs faint">
        Open an athlete for their history, chart, and to edit, import or remove them.
      </p>

      <UserFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={(user) => navigate(`/users/${user.id}`)}
      />
      {logging && data ? (
        <AttemptFormModal open user={logging} medianMassKg={data.medianMassKg} onClose={() => setLogging(null)} />
      ) : null}
    </div>
  );
}
