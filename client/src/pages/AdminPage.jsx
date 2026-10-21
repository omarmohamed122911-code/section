import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { api } from "../api.js";
import { useLang } from "../LangContext.jsx";
import { useAuth } from "../AuthContext.jsx";

function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span className="muted">{label}</span>
      {children}
    </label>
  );
}

function MoviesTab({ t, onError }) {
  const [movies, setMovies] = useState([]);
  const [form, setForm] = useState({ title: "", description: "", poster: "", genre: "", durationMinutes: 120, ageRating: "PG", language: "English" });
  const [editId, setEditId] = useState(null);

  async function load() {
    try {
      setMovies(await api("/api/movies"));
    } catch (err) {
      onError(err.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    try {
      if (editId) {
        await api(`/api/admin/movies/${editId}`, { method: "PUT", body: form });
      } else {
        await api("/api/admin/movies", { method: "POST", body: form });
      }
      setEditId(null);
      setForm({ title: "", description: "", poster: "", genre: "", durationMinutes: 120, ageRating: "PG", language: "English" });
      load();
    } catch (err) {
      onError(err.message);
    }
  }

  async function remove(id) {
    try {
      await api(`/api/admin/movies/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <>
      <div className="panel">
        <h3>{editId ? t.edit : t.add}</h3>
        <form className="form" onSubmit={save}>
          <Field label={t.title}>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </Field>
          <Field label={t.description}>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label={t.poster}>
            <input value={form.poster} onChange={(e) => setForm({ ...form, poster: e.target.value })} />
          </Field>
          <div className="row">
            <Field label={t.genre}>
              <input value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} />
            </Field>
            <Field label={t.duration}>
              <input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} />
            </Field>
            <Field label={t.ageRating}>
              <input value={form.ageRating} onChange={(e) => setForm({ ...form, ageRating: e.target.value })} />
            </Field>
            <Field label={t.language}>
              <input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} />
            </Field>
          </div>
          <div className="row">
            <button className="btn btn-primary" type="submit">{t.save}</button>
            {editId && (
              <button className="btn" type="button" onClick={() => setEditId(null)}>{t.cancel}</button>
            )}
          </div>
        </form>
      </div>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr><th>{t.title}</th><th>{t.genre}</th><th>{t.duration}</th><th>{t.actions}</th></tr>
          </thead>
          <tbody>
            {movies.map((m) => (
              <tr key={m.id}>
                <td>{m.title}</td>
                <td>{m.genre}</td>
                <td>{m.durationMinutes}</td>
                <td>
                  <div className="row">
                    <button className="btn" onClick={() => { setEditId(m.id); setForm({ title: m.title, description: m.description, poster: m.poster, genre: m.genre, durationMinutes: m.durationMinutes, ageRating: m.ageRating, language: m.language }); }}>{t.edit}</button>
                    <button className="btn btn-danger" onClick={() => remove(m.id)}>{t.delete}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ShowtimesTab({ t, onError }) {
  const [shows, setShows] = useState([]);
  const [movies, setMovies] = useState([]);
  const [halls, setHalls] = useState([]);
  const [form, setForm] = useState({ movieId: "", hallId: "", startAt: "", priceStandard: 100, priceVip: 160 });

  async function load() {
    try {
      const [s, m, h] = await Promise.all([
        api("/api/showtimes"),
        api("/api/movies"),
        api("/api/admin/halls"),
      ]);
      setShows(s);
      setMovies(m);
      setHalls(h);
      setForm((f) => ({ movieId: f.movieId || m[0]?.id || "", hallId: f.hallId || h[0]?.id || "", startAt: f.startAt, priceStandard: 100, priceVip: 160 }));
    } catch (err) {
      onError(err.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    try {
      await api("/api/admin/showtimes", { method: "POST", body: form });
      load();
    } catch (err) {
      onError(err.message);
    }
  }

  async function updatePrices(show) {
    try {
      await api(`/api/admin/showtimes/${show.id}`, {
        method: "PUT",
        body: { priceStandard: show.priceStandard, priceVip: show.priceVip },
      });
      load();
    } catch (err) {
      onError(err.message);
    }
  }

  async function cancelShow(id) {
    try {
      await api(`/api/admin/showtimes/${id}/cancel`, { method: "POST" });
      load();
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <>
      <div className="panel">
        <h3>{t.createShowtime}</h3>
        <form className="form" onSubmit={create}>
          <div className="row">
            <Field label={t.pickMovie}>
              <select value={form.movieId} onChange={(e) => setForm({ ...form, movieId: e.target.value })} required>
                {movies.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </Field>
            <Field label={t.pickHall}>
              <select value={form.hallId} onChange={(e) => setForm({ ...form, hallId: e.target.value })} required>
                {halls.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </Field>
            <Field label={t.startAt}>
              <input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} required />
            </Field>
            <Field label={t.priceStandard}>
              <input type="number" value={form.priceStandard} onChange={(e) => setForm({ ...form, priceStandard: Number(e.target.value) })} />
            </Field>
            <Field label={t.priceVip}>
              <input type="number" value={form.priceVip} onChange={(e) => setForm({ ...form, priceVip: Number(e.target.value) })} />
            </Field>
          </div>
          <button className="btn btn-primary" type="submit">{t.createShowtime}</button>
        </form>
      </div>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t.movies}</th><th>{t.hall}</th><th>{t.startAt}</th>
              <th>{t.priceStandard}</th><th>{t.priceVip}</th><th>{t.status}</th><th>{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {shows.map((s) => (
              <tr key={s.id}>
                <td>{s.movie?.title}</td>
                <td>{s.hall?.name}</td>
                <td>{new Date(s.startAt).toLocaleString()}</td>
                <td><input type="number" style={{ width: 90 }} value={s.priceStandard} onChange={(e) => setShows(shows.map((x) => x.id === s.id ? { ...x, priceStandard: Number(e.target.value) } : x))} /></td>
                <td><input type="number" style={{ width: 90 }} value={s.priceVip} onChange={(e) => setShows(shows.map((x) => x.id === s.id ? { ...x, priceVip: Number(e.target.value) } : x))} /></td>
                <td>{t[s.status] || s.status}</td>
                <td>
                  <div className="row">
                    <button className="btn" onClick={() => updatePrices(s)}>{t.save}</button>
                    {s.status !== "cancelled" && (
                      <button className="btn btn-danger" onClick={() => cancelShow(s.id)}>{t.cancel}</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function HallsTab({ t, onError }) {
  const [halls, setHalls] = useState([]);

  async function load() {
    try {
      setHalls(await api("/api/admin/halls"));
    } catch (err) {
      onError(err.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function updateHall(hall, patch) {
    try {
      await api(`/api/admin/halls/${hall.id}`, { method: "PUT", body: patch });
      load();
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <div className="panel">
      {halls.map((h) => (
        <div key={h.id} style={{ marginBottom: 16 }}>
          <h3>{h.name}</h3>
          <div className="row">
            <Field label={t.rows}>
              <input type="number" defaultValue={h.rows} id={`rows-${h.id}`} />
            </Field>
            <Field label={t.seatsPerRow}>
              <input type="number" defaultValue={h.seatsPerRow} id={`cols-${h.id}`} />
            </Field>
            <Field label={t.vipSeats}>
              <input defaultValue={h.vipSeats.join(",")} id={`vip-${h.id}`} />
            </Field>
          </div>
          <button
            className="btn btn-primary"
            onClick={() =>
              updateHall(h, {
                rows: Number(document.getElementById(`rows-${h.id}`).value),
                seatsPerRow: Number(document.getElementById(`cols-${h.id}`).value),
                vipSeats: document.getElementById(`vip-${h.id}`).value.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
          >
            {t.save}
          </button>
        </div>
      ))}
    </div>
  );
}

function UsersTab({ t, onError }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", role: "staff" });

  async function load() {
    try {
      setUsers(await api("/api/admin/users"));
    } catch (err) {
      onError(err.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    try {
      await api("/api/admin/users", { method: "POST", body: form });
      setForm({ fullName: "", email: "", password: "", role: "staff" });
      load();
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <>
      <div className="panel">
        <h3>{t.newStaff}</h3>
        <form className="form" onSubmit={create}>
          <div className="row">
            <Field label={t.fullName}>
              <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
            </Field>
            <Field label={t.email}>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </Field>
            <Field label={t.password6}>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
            </Field>
            <Field label={t.role}>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="staff">staff</option>
                <option value="admin">admin</option>
              </select>
            </Field>
          </div>
          <button className="btn btn-primary" type="submit">{t.add}</button>
        </form>
      </div>
      <div className="panel table-wrap">
        <table>
          <thead><tr><th>{t.fullName}</th><th>{t.email}</th><th>{t.role}</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}><td>{u.fullName}</td><td>{u.email}</td><td>{u.role}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SettingsTab({ t, onError }) {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    api("/api/admin/settings").then(setSettings).catch((err) => onError(err.message));
  }, []);

  async function save(e) {
    e.preventDefault();
    try {
      setSettings(await api("/api/admin/settings", { method: "PUT", body: settings }));
    } catch (err) {
      onError(err.message);
    }
  }

  if (!settings) return t.loading;
  return (
    <div className="panel">
      <form className="form" onSubmit={save}>
        <Field label={t.holdMinutes}>
          <input type="number" value={settings.reservationHoldMinutes} onChange={(e) => setSettings({ ...settings, reservationHoldMinutes: Number(e.target.value) })} />
        </Field>
        <Field label={t.maxTickets}>
          <input type="number" value={settings.maxTicketsPerBooking} onChange={(e) => setSettings({ ...settings, maxTicketsPerBooking: Number(e.target.value) })} />
        </Field>
        <button className="btn btn-primary" type="submit">{t.save}</button>
      </form>
    </div>
  );
}

function ReportsTab({ t, onError }) {
  const [reports, setReports] = useState(null);

  useEffect(() => {
    api("/api/admin/reports").then(setReports).catch((err) => onError(err.message));
  }, []);

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reports.moviePerformance), "Movies");
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        reports.cancelledBookings.map((b) => ({
          reference: b.reference,
          movie: b.showtime?.movie?.title,
          total: b.total,
          status: b.status,
        }))
      ),
      "Cancelled"
    );
    XLSX.writeFile(wb, "cinema-report.xlsx");
  }

  function exportPdf() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Cinema Report", 14, 16);
    doc.setFontSize(11);
    doc.text(`Revenue: ${reports.revenue} EGP`, 14, 28);
    doc.text(`Confirmed: ${reports.bookingStats.confirmed}`, 14, 36);
    doc.text(`Tickets sold: ${reports.bookingStats.ticketsSold}`, 14, 44);
    doc.text(`Attendance: ${reports.bookingStats.attendance}`, 14, 52);
    let y = 68;
    doc.text("Movie performance:", 14, y);
    y += 8;
    for (const row of reports.moviePerformance) {
      if (y > 280) break;
      doc.text(`${row.movie}: ${row.bookings} bookings, ${row.tickets} tickets, ${row.revenue} EGP`, 14, y);
      y += 8;
    }
    doc.save("cinema-report.pdf");
  }

  if (!reports) return t.loading;
  return (
    <>
      <div className="panel">
        <div className="row">
          <div><span className="muted">{t.revenue}</span><br /><strong>{reports.revenue} {t.egp}</strong></div>
          <div><span className="muted">{t.confirmed}</span><br /><strong>{reports.bookingStats.confirmed}</strong></div>
          <div><span className="muted">{t.ticketsSold}</span><br /><strong>{reports.bookingStats.ticketsSold}</strong></div>
          <div><span className="muted">{t.attendance}</span><br /><strong>{reports.bookingStats.attendance}</strong></div>
          <div><span className="muted">{t.held}</span><br /><strong>{reports.bookingStats.held}</strong></div>
          <div><span className="muted">{t.cancelled}</span><br /><strong>{reports.bookingStats.cancelled}</strong></div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={exportExcel}>{t.exportExcel}</button>
          <button className="btn" onClick={exportPdf}>{t.exportPdf}</button>
        </div>
      </div>
      <div className="panel table-wrap">
        <h3>{t.moviePerformance}</h3>
        <table>
          <thead><tr><th>{t.movies}</th><th>{t.todaysBookings}</th><th>{t.ticketsSold}</th><th>{t.revenue}</th></tr></thead>
          <tbody>
            {reports.moviePerformance.map((row) => (
              <tr key={row.movie}><td>{row.movie}</td><td>{row.bookings}</td><td>{row.tickets}</td><td>{row.revenue} {t.egp}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel table-wrap">
        <h3>{t.auditLog}</h3>
        <table>
          <thead><tr><th>{t.date}</th><th>{t.customer}</th><th>{t.actions}</th><th></th></tr></thead>
          <tbody>
            {reports.audit.map((a) => (
              <tr key={a.id}><td>{new Date(a.createdAt).toLocaleString()}</td><td>{a.userId}</td><td>{a.action}</td><td>{a.details}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function AdminPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const [tab, setTab] = useState("movies");
  const [error, setError] = useState("");

  return (
    <main className="container">
      <h1>{t.admin} — {user?.fullName}</h1>
      <div className="tabs">
        <button className="btn" onClick={() => setTab("movies")}>{t.manageMovies}</button>
        <button className="btn" onClick={() => setTab("showtimes")}>{t.manageShowtimes}</button>
        <button className="btn" onClick={() => setTab("halls")}>{t.manageHalls}</button>
        <button className="btn" onClick={() => setTab("users")}>{t.manageUsers}</button>
        <button className="btn" onClick={() => setTab("settings")}>{t.manageSettings}</button>
        <button className="btn" onClick={() => setTab("reports")}>{t.reports}</button>
      </div>
      {error && <div className="alert">{error}</div>}
      {tab === "movies" && <MoviesTab t={t} onError={setError} />}
      {tab === "showtimes" && <ShowtimesTab t={t} onError={setError} />}
      {tab === "halls" && <HallsTab t={t} onError={setError} />}
      {tab === "users" && <UsersTab t={t} onError={setError} />}
      {tab === "settings" && <SettingsTab t={t} onError={setError} />}
      {tab === "reports" && <ReportsTab t={t} onError={setError} />}
    </main>
  );
}
