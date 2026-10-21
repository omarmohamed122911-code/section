import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useLang } from "../LangContext.jsx";
import { useAuth } from "../AuthContext.jsx";

function Badge({ status, t }) {
  const cls = status === "confirmed" ? "ok" : status === "held" ? "warn" : "bad";
  return <span className={`badge ${cls}`}>{t[status] || status}</span>;
}

function BookingRow({ booking, t, onChanged, onError }) {
  async function payCash() {
    try {
      await api("/api/staff/pay-cash", { method: "POST", body: { bookingId: booking.id } });
      onChanged();
    } catch (err) {
      onError(err.message);
    }
  }

  async function cancel() {
    try {
      await api("/api/staff/cancel-booking", { method: "POST", body: { bookingId: booking.id } });
      onChanged();
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <tr>
      <td>{booking.reference}</td>
      <td>{booking.customer?.email || "—"}</td>
      <td>{booking.showtime?.movie?.title}</td>
      <td>{booking.total} {t.egp}</td>
      <td><Badge status={booking.status} t={t} /></td>
      <td>
        <div className="row">
          {booking.status === "held" && (
            <button className="btn btn-primary" onClick={payCash}>{t.payCash}</button>
          )}
          {booking.status !== "cancelled" && booking.status !== "expired" && (
            <button className="btn btn-danger" onClick={cancel}>{t.cancel}</button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function StaffPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [lookup, setLookup] = useState("");
  const [found, setFound] = useState(null);
  const [tab, setTab] = useState("overview");

  async function load() {
    try {
      const params = new URLSearchParams({ date });
      if (q) params.set("q", q);
      const result = await api(`/api/staff/overview?${params.toString()}`);
      setData(result);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, [date, q]);

  async function searchBooking(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setFound(null);
    try {
      const result = await api("/api/staff/validate", {
        method: "POST",
        body: { reference: lookup },
      });
      setFound(result);
    } catch (err) {
      setError(err.message);
    }
  }

  async function admit(ticketId) {
    setError("");
    try {
      const result = await api("/api/staff/validate", {
        method: "POST",
        body: { ticketId },
      });
      setMessage(t.ticketAdmitted);
      setFound(result);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function admitQr(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setFound(null);
    try {
      const result = await api("/api/staff/validate", {
        method: "POST",
        body: { qr: lookup },
      });
      setMessage(t.ticketAdmitted);
      setFound(result);
      setLookup("");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!data) return <div className="container">{error || t.loading}</div>;

  return (
    <main className="container">
      <h1>{t.staff} — {user?.fullName}</h1>
      <div className="tabs">
        <button className="btn" onClick={() => setTab("overview")}>{t.overview}</button>
        <button className="btn" onClick={() => setTab("validate")}>{t.validateTicket}</button>
      </div>

      {error && <div className="alert">{error}</div>}
      {message && <div className="success">{message}</div>}

      {tab === "overview" && (
        <>
          <div className="toolbar">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <input placeholder={t.searchReference} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <div className="panel">
            <h3>{t.todaysShowtimes} ({data.showtimes.length})</h3>
            {data.showtimes.map((s) => (
              <div className="show-item" key={s.id}>
                <div>
                  <strong>{s.movie?.title}</strong>
                  <div className="muted">
                    {new Date(s.startAt).toLocaleString()} · {s.hall?.name} · <Badge status={s.status} t={t} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="panel">
            <h3>{t.unpaidReservations} ({data.unpaid.length})</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t.bookingReference}</th>
                    <th>{t.customer}</th>
                    <th>{t.movies}</th>
                    <th>{t.total}</th>
                    <th>{t.status}</th>
                    <th>{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.unpaid.map((b) => (
                    <BookingRow key={b.id} booking={b} t={t} onChanged={load} onError={setError} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <h3>{t.todaysBookings} ({data.bookings.length})</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t.bookingReference}</th>
                    <th>{t.customer}</th>
                    <th>{t.movies}</th>
                    <th>{t.total}</th>
                    <th>{t.status}</th>
                    <th>{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bookings.map((b) => (
                    <BookingRow key={b.id} booking={b} t={t} onChanged={load} onError={setError} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <h3>{t.attendance} ({data.attendance.length})</h3>
            {data.attendance.map((b) => (
              <p key={b.id}>
                {b.reference} · {b.showtime?.movie?.title} ·{" "}
                {b.tickets.filter((tk) => tk.usedAt).map((tk) => tk.seatId).join(", ")}
              </p>
            ))}
          </div>
        </>
      )}

      {tab === "validate" && (
        <div className="panel">
          <h3>{t.validateTicket}</h3>
          <p className="muted">{t.scanOrReference}</p>
          <form className="form" onSubmit={(e) => (found ? admitQr(e) : searchBooking(e))}>
            <input
              placeholder={t.scanOrReference}
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              required
            />
            <button className="btn btn-primary" type="submit">
              {found ? t.admit : t.lookUp}
            </button>
          </form>
          {found && found.booking && (
            <div className="ticket">
              <p>
                <strong>{found.booking.reference}</strong> · {found.booking.showtime?.movie?.title} ·{" "}
                {found.booking.customer?.email}
              </p>
              {found.message && <p className="muted">{found.message}</p>}
              <ul>
                {found.booking.tickets.map((tk) => (
                  <li key={tk.id}>
                    {t.seat} {tk.seatId} · {tk.usedAt ? t.ticketUsed : t.ticketUnused}
                    {!tk.usedAt && (
                      <button className="btn btn-primary" style={{ marginLeft: 8 }} onClick={() => admit(tk.id)}>
                        {t.admit}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
