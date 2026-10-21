import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useLang } from "../LangContext.jsx";
import { downloadTicketsPdf } from "../pdf.js";

export default function CheckoutPage() {
  const { bookingId } = useParams();
  const { t } = useLang();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");
  const [card, setCard] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await api(`/api/bookings/${bookingId}`);
      setBooking(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, [bookingId]);

  async function payDemo(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api(`/api/bookings/${bookingId}/pay-demo`, {
        method: "POST",
        body: { cardNumber: card },
      });
      setBooking(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function switchToCash() {
    setBusy(true);
    setError("");
    try {
      const data = await api(`/api/bookings/${bookingId}/switch-pay-at-cinema`, {
        method: "POST",
      });
      setBooking(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!booking) return <div className="container">{error ? <div className="alert">{error}</div> : t.loading}</div>;

  const show = booking.showtime;
  const isHeld = booking.status === "held";
  const isCash = booking.paymentMethod === "pay_at_cinema";

  return (
    <main className="container">
      <h1>{t.checkout}</h1>
      <div className="panel">
        <p>
          <strong>
            {t.bookingReference}: {booking.reference}
          </strong>
        </p>
        {show && (
          <>
            <p>
              {show.movie?.title} · {new Date(show.startAt).toLocaleString()} · {show.hall?.name}
            </p>
            <ul>
              {booking.tickets.map((tk) => (
                <li key={tk.id}>
                  {t.seat} {tk.seatId} · {t[tk.seatCategory]} · {t[tk.ticketType]} · {tk.price} {t.egp}
                </li>
              ))}
            </ul>
          </>
        )}
        <p>
          <strong>
            {t.total}: {booking.total} {t.egp}
          </strong>
        </p>
        <p>
          {t.status}: {t[booking.status] || booking.status}
        </p>
      </div>

      {error && <div className="alert">{error}</div>}

      {isHeld && !isCash && (
        <div className="panel">
          <h3>{t.demoPayment}</h3>
          <p className="muted">{t.demoCardHint}</p>
          <form onSubmit={payDemo} className="form">
            <input
              placeholder={t.cardNumber}
              value={card}
              onChange={(e) => setCard(e.target.value)}
              required
            />
            <div className="row">
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {t.payNow}
              </button>
              <button className="btn" type="button" onClick={switchToCash} disabled={busy}>
                {t.switchToCash}
              </button>
            </div>
          </form>
        </div>
      )}

      {isHeld && isCash && (
        <div className="panel">
          <p className="muted">{t.unpaidCash}</p>
          <p>
            {t.holdExpires}: {new Date(booking.holdExpiresAt).toLocaleString()}
          </p>
        </div>
      )}

      {booking.status === "confirmed" && (
        <div className="success panel">
          <p>{t.bookingSuccess}</p>
          <div className="row">
            <button className="btn btn-primary" onClick={() => downloadTicketsPdf(booking)}>
              {t.downloadPdf}
            </button>
            <Link className="btn" to="/tickets">
              {t.myTickets}
            </Link>
          </div>
        </div>
      )}

      {(booking.status === "cancelled" || booking.status === "expired") && (
        <div className="alert">{t[booking.status]}</div>
      )}

      <p style={{ marginTop: 16 }}>
        <Link to="/">{t.back}</Link>
      </p>
    </main>
  );
}
