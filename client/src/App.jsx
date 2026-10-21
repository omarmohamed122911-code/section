import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import { useLang } from "./LangContext.jsx";
import Home from "./pages/Home.jsx";
import MoviePage from "./pages/MoviePage.jsx";
import SeatsPage from "./pages/SeatsPage.jsx";
import CheckoutPage from "./pages/CheckoutPage.jsx";
import TicketsPage from "./pages/TicketsPage.jsx";
import { LoginPage, RegisterPage } from "./pages/AuthPages.jsx";
import StaffPage from "./pages/StaffPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";

function Guard({ roles, children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <div className="container">...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function Layout() {
  const { t, lang, setLang } = useLang();
  const { user, logout } = useAuth();
  return (
    <>
      <header className="nav">
        <div className="container nav-inner">
          <Link className="brand" to="/">
            <span className="brand-mark">N</span>
            {t.brand}
          </Link>
          <nav className="nav-links">
            <Link to="/">{t.movies}</Link>
            {user?.role === "customer" && <Link to="/tickets">{t.myTickets}</Link>}
            {user?.role === "staff" && <Link to="/staff">{t.staff}</Link>}
            {user?.role === "admin" && (
              <>
                <Link to="/staff">{t.staff}</Link>
                <Link to="/admin">{t.admin}</Link>
              </>
            )}
            <button className="btn-ghost" onClick={() => setLang(lang === "en" ? "ar" : "en")}>
              {lang === "en" ? "العربية" : "English"}
            </button>
            {user ? (
              <button onClick={logout}>{t.logout}</button>
            ) : (
              <>
                <Link to="/login">{t.login}</Link>
                <Link className="active" to="/register">{t.register}</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/movies/:id" element={<MoviePage />} />
        <Route
          path="/showtimes/:id/seats"
          element={
            <Guard roles={["customer", "staff", "admin"]}>
              <SeatsPage />
            </Guard>
          }
        />
        <Route
          path="/checkout/:bookingId"
          element={
            <Guard>
              <CheckoutPage />
            </Guard>
          }
        />
        <Route
          path="/tickets"
          element={
            <Guard roles={["customer"]}>
              <TicketsPage />
            </Guard>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/staff"
          element={
            <Guard roles={["staff", "admin"]}>
              <StaffPage />
            </Guard>
          }
        />
        <Route
          path="/admin"
          element={
            <Guard roles={["admin"]}>
              <AdminPage />
            </Guard>
          }
        />
      </Routes>
      <footer className="container footer">{t.emailFuture}</footer>
    </>
  );
}

export default function App() {
  return <Layout />;
}
