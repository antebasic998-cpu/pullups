import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../lib/hooks';
import { useDataVersion } from '../lib/store';
import { useLogSheet } from '../lib/LogSheet';
import { daysAgo, formatKg, pluralize, reps } from '../lib/format';
import { Avatar, EmptyState, PageHeader } from '../components/Bits';
import { UserFormModal } from '../components/UserFormModal';
import { ExerciseSelector } from '../components/ExerciseSelector';
import { PlusIcon, SearchIcon } from '../components/Icons';
import type { ExerciseCategory } from '../types';

/**
 * The roster: who is on the board and their normalized PB, with one action per
 * row (log a result). Editing, importing and removing live on the profile, so
 * this page stays a clean list.
 */
export function UsersPage() {
  const [params, setParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | null>(null);
  const version = useDataVersion();
  const navigate = useNavigate();
  const log = useLogSheet();
  const { data, loading, error } = useAsync(() => api.users(selectedCategory?.slug), [selectedCategory?.slug, version]);

  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  // "Add athlete" deep-links to /users?new=1 (also used by the empty Log sheet).
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
      <PageHeader
        eyebrow="Personal bests"
        title="Athletes"
        right={
          <ExerciseSelector selected={selectedCategory} onSelect={setSelectedCategory} loading={loading} compact />
        }
      />
      <p className="blurb">
        {loading && !data ? (
          'Updating athlete roster...'
        ) : data && data.userCount > 0 ? (
          `${pluralize(data.userCount, 'athlete')} · median ${formatKg(data.medianMassKg)}`
        ) : data ? (
          'Nobody on the board yet'
        ) : (
          ''
        )}
      </p>

      <div className="acts" style={{ marginTop: 14 }}>
        <div className="search" style={{ marginTop: 0, flex: 1 }}>
          <SearchIcon size={17} strokeWidth={2} />
          <input
            className="input"
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search athletes"
          />
        </div>
        <button
          type="button"
          className="sq-btn"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)', border: 0, height: 46, width: 46 }}
          onClick={() => setAddOpen(true)}
          title="Add athlete"
          aria-label="Add athlete"
        >
          <PlusIcon size={22} strokeWidth={2.6} />
        </button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {loading && !data ? (
        <div className="lb-list fade-in" style={{ marginTop: 14 }} aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="lb-row">
              <div className="skeleton" style={{ width: '100%', height: 40 }} />
            </div>
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
        <div className="lb-list roster-grid fade-in" style={{ marginTop: 14, opacity: loading ? 0.55 : 1 }}>
          {users.map((user) => (
            <div key={user.id} className="lb-row">
              <Link to={`/users/${user.id}`} className="lb-main">
                <Avatar name={user.name} userId={user.id} size={40} />
                <div className="lb-who">
                  <b>
                    <span>{user.name}</span>
                  </b>
                  <small>
                    {[
                      user.age ? `${user.age}y` : null,
                      formatKg(user.weightKg),
                      user.sessionCount > 0
                        ? `${pluralize(user.sessionCount, 'attempt')} · ${daysAgo(user.lastResult?.date)}`
                        : 'no attempts yet',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </div>
                <div className="lb-val">
                  <b>
                    {user.sessionCount > 0 ? user.pbNormalized.toFixed(2) : <span className="faint">–</span>}
                    {user.sessionCount > 0 ? <small> pts</small> : null}
                  </b>
                  <small>{user.sessionCount > 0 ? reps(user.pbAbsolute) : ''}</small>
                </div>
              </Link>
              <button
                type="button"
                className="plus-btn"
                onClick={() => log.open({ userId: user.id, category: selectedCategory })}
                title={`Log a result for ${user.name}`}
                aria-label={`Log a result for ${user.name}`}
              >
                <PlusIcon size={18} strokeWidth={2.4} />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="foot">Open an athlete for their history, chart, and to edit, import or remove them.</p>

      <UserFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={(user) => navigate(`/users/${user.id}`)}
      />
    </div>
  );
}
