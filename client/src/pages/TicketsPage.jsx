import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useLang } from "../LangContext.jsx";
import { downloadTicketsPdf } from "../pdf.js";

function TicketRow({ ticket, t }) {
  const [qr, setQr] = useState(null);
  const [open, setOpen] = useState(false);

  async function toggleQr() {
    if (!qr) {
      try {
        const data = await api(`/api/tickets/${ticket.id}/qr`);
        setQr(data.dataUrl);
      } catch {
        setQr("error");
        return;
      }
    }
    setOpen((o) => !o);
  }

  return (
    <div className="ticket">
      <div className="space">
        <span>
          <strong>
            {t.seat} {ticket.seatId}
          </strong>{" "}
          · {t[ticket.seatCategory]} · {t[ticket.ticketType]} · {ticket.price} {t.egp}
          {ticket.usedAt ? ` · ${t.ticketUsed}` : ""}
        </span>
        <button className="btn btn-ghost" onClick={toggleQr}>
          {open ? t.hideQr : t.showQr}
        </button>
      </div>
      {open && qr && qr !== "error" && (
        <p style={{ textAlign: "center" }}>
          <img src={qr} alt="QR" width={140} />
        </p>
      )}
      {open && qr === "error" && <p className="muted">{t.error}</p>}
    </div>
  );
}

export default function TicketsPage() {
  const { t } = useLang();
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    api("/api/bookings/mine")
      .then(setBookings)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="container"><div className="alert">{error}</div></div>;
  if (!bookings) return <div className="container">{t.loading}</div>;

  const filtered = q
    ? bookings.filter(
        (b) =>
          b.reference.toLowerCase().includes(q.toLowerCase()) ||
          b.showtime?.movie?.title.toLowerCase().includes(q.toLowerCase())
      )
    : bookings;

  return (
    <main className="container">
      <h1>{t.myTickets}</h1>
      <div className="toolbar">
        <input
          placeholder={t.searchReference}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {filtered.length === 0 && <p>{t.noBookings}</p>}
      {filtered.map((booking) => (
        <div className="panel" key={booking.id}>
          <div className="space">
            <div>
              <strong>{booking.showtime?.movie?.title}</strong>
              <div className="muted">
                {booking.reference} · {new Date(booking.showtime?.startAt).toLocaleString()} ·{" "}
                {booking.showtime?.hall?.name}
              </div>
            </div>
            <span className={`badge ${booking.status === "confirmed" ? "ok" : booking.status === "held" ? "warn" : "bad"}`}>
              {t[booking.status] || booking.status}
            </span>
          </div>
          {booking.tickets.map((tk) => (
            <TicketRow key={tk.id} ticket={tk} t={t} />
          ))}
          <div className="space">
            <strong>
              {t.total}: {booking.total} {t.egp}
            </strong>
            <div className="row">
              {booking.status === "confirmed" && (
                <button className="btn" onClick={() => downloadTicketsPdf(booking)}>
                  {t.downloadPdf}
                </button>
              )}
              <Link className="btn" to={`/checkout/${booking.id}`}>
                {t.checkout}
              </Link>
            </div>
          </div>
        </div>
      ))}
    </main>
  );
}
