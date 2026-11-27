import { Routes, Route, Navigate, NavLink, Link, useLocation } from 'react-router-dom';
import { getToken, getRole, homeFor } from './api.js';
import Icon from './components/Icon.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Account from './pages/Account.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminOverview from './pages/admin/Overview.jsx';
import AdminUsers from './pages/admin/Users.jsx';
import AdminVendors from './pages/admin/Vendors.jsx';
import AdminBookings from './pages/admin/Bookings.jsx';
import AdminPayments from './pages/admin/Payments.jsx';
import AdminModeration from './pages/admin/Moderation.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CreateEvent from './pages/CreateEvent.jsx';
import EventDetail from './pages/EventDetail.jsx';
import Vendors from './pages/Vendors.jsx';
import VendorDashboard from './pages/VendorDashboard.jsx';
import VendorSetup from './pages/VendorSetup.jsx';
import VendorPortfolio from './pages/VendorPortfolio.jsx';

const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password'];

// role can be one role, or a list for pages every signed-in person uses.
function Protected({ role, children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(getRole())) return <Navigate to={homeFor(getRole())} replace />;
  return children;
}

const PLANNER_LINKS = [
  ['/', 'Home', 'home', true],
  ['/events/new', 'New event', 'plus'],
  ['/account', 'Account', 'user'],
];
const VENDOR_LINKS = [
  ['/vendor', 'Requests', 'inbox', true],
  ['/vendor/portfolio', 'Work', 'image'],
  ['/vendor/setup', 'Business', 'building'],
  ['/account', 'Account', 'user'],
];

// Laptop: logo and links along the top. Phone: a flat tab bar along the bottom.
function Navigation({ links, home }) {
  return (
    <>
      <header className="sticky top-0 z-20 hidden border-b border-line bg-white/90 backdrop-blur md:block">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <Link to={home} className="display text-2xl" aria-label="Lyf home">Lyf</Link>
          <nav aria-label="Main" className="flex items-center gap-1">
            {links.map(([to, label, , end]) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `rounded-lg px-3.5 py-2 text-sm font-semibold ${isActive ? 'bg-paper text-ink' : 'text-ink/60 hover:text-ink'}`}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur md:hidden">
        <ul className="mx-auto flex max-w-md items-stretch justify-around pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          {links.map(([to, label, icon, end]) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `relative flex flex-col items-center gap-1 px-2 py-2.5 text-xs font-semibold ${isActive ? 'text-ink' : 'text-ink/50'}`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-gold" aria-hidden="true" />}
                    <Icon name={icon} size={22} />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

export default function App() {
  const { pathname } = useLocation();
  const signedIn = !!getToken();
  const hideNav = pathname === '/events/new';
  const role = getRole();
  const showNav = signedIn && !hideNav && role !== 'admin';
  const vendor = role === 'vendor';

  // The admin portal is a laptop-sized page, so it skips the phone-width frame.
  if (pathname.startsWith('/admin')) {
    return (
      <Routes>
        <Route path="/admin" element={<Protected role="admin"><AdminLayout /></Protected>}>
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="vendors" element={<AdminVendors />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="moderation" element={<AdminModeration />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    );
  }

  // Signed-out visitors see the landing page at "/".
  if (pathname === '/' && !signedIn) return <Landing />;

  if (AUTH_PAGES.includes(pathname)) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {showNav && <Navigation links={vendor ? VENDOR_LINKS : PLANNER_LINKS} home={homeFor(role)} />}
      <main className={`mx-auto w-full max-w-3xl ${showNav ? 'pb-28 md:pb-16' : 'pb-10'}`}>
        <Routes>
          <Route path="/account" element={<Protected role={['planner', 'vendor']}><Account /></Protected>} />

          <Route path="/" element={<Protected role="planner"><Dashboard /></Protected>} />
          <Route path="/events/new" element={<Protected role="planner"><CreateEvent /></Protected>} />
          <Route path="/events/:id" element={<Protected role="planner"><EventDetail /></Protected>} />
          <Route path="/events/:id/vendors" element={<Protected role="planner"><Vendors /></Protected>} />

          <Route path="/vendor" element={<Protected role="vendor"><VendorDashboard /></Protected>} />
          <Route path="/vendor/setup" element={<Protected role="vendor"><VendorSetup /></Protected>} />
          <Route path="/vendor/portfolio" element={<Protected role="vendor"><VendorPortfolio /></Protected>} />

          <Route path="*" element={<Navigate to={homeFor(role)} replace />} />
        </Routes>
      </main>
    </div>
  );
}
