import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearToken } from '../../api.js';

const TABS = [
  ['/admin', 'Overview', true],
  ['/admin/users', 'Users'],
  ['/admin/vendors', 'Vendors'],
  ['/admin/bookings', 'Bookings'],
  ['/admin/payments', 'Payments'],
  ['/admin/moderation', 'Moderation'],
];

export default function AdminLayout() {
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-paper">
      <header className="adire text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <span className="text-xl font-extrabold tracking-tight">Lyf <span className="font-medium text-white/70">Admin</span></span>
          <button
            onClick={() => { clearToken(); nav('/login'); }}
            className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold"
          >
            Sign out
          </button>
        </div>
        <nav aria-label="Admin" className="mx-auto max-w-6xl overflow-x-auto px-5">
          <ul className="flex gap-1 pb-3">
            {TABS.map(([to, label, end]) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `block whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${isActive ? 'bg-gold text-ink' : 'text-white/80'}`
                  }
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-6">
        <Outlet />
      </main>
    </div>
  );
}
