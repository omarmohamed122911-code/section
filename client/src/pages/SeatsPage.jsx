import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useLang } from "../LangContext.jsx";
import { useAuth } from "../AuthContext.jsx";

const TICKET_MULTIPLIER = { adult: 1, child: 0.7, student: 0.8 };

export default function SeatsPage() {
  const { id } = useParams();
  const { t } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [types, setTypes] = useState({});
  const [error, setError] = useState("");
  const [maxTickets, setMaxTickets] = useState(6);
  const [customerEmail, setCustomerEmail] = useState("");

  useEffect(() => {
    api(`/api/showtimes/${id}/seats`).then(setData).catch((err) => setError(err.message));
    api("/api/settings/public").then((s) => setMaxTickets(s.maxTicketsPerBooking));
  }, [id]);

  const rows = useMemo(() => {
    if (!data) return [];
    const grouped = [];
    for (let r = 0; r < data.hall.rows; r += 1) {
      const letter = String.fromCharCode(65 + r);
      grouped.push(data.seats.filter((seat) => seat.id.replace(/[0-9]/g, "") === letter));
    }
    return grouped;
  }, [data]);

  function unitPriceFor(seatId, type) {
    const seat = data.seats.find((s) => s.id === seatId);
    const base = seat?.category === "vip" ? data.showtime.priceVip : data.showtime.priceStandard;
    return Math.round(base * (TICKET_MULTIPLIER[type] || 1));
  }

  const total = selected.reduce((s, seatId) => s + unitPriceFor(seatId, types[seatId] || "adult"), 0);

  function toggle(seat) {
    if (!seat.available) return;
    setError("");
    setSelected((curr) => {
      const exists = curr.includes(seat.id);
      if (exists) return curr.filter((sid) => sid !== seat.id);
      if (curr.length >= maxTickets) {
        setError(t.maxSeats);
        return curr;
      }
      return [...curr, seat.id];
    });
    setTypes((curr) => ({ ...curr, [seat.id]: curr[seat.id] || "adult" }));
  }

  async function continuePay(method) {
    setError("");
    try {
      const body = {
        showtimeId: id,
        paymentMethod: method,
        seats: selected.map((seatId) => ({ seatId, ticketType: types[seatId] || "adult" })),
      };
      if (user.role !== "customer") body.customerEmail = customerEmail;
      const booking = await api("/api/bookings", { method: "POST", body });
      navigate(`/checkout/${booking.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!data) return <div className="container">{t.loading}</div>;
  const show = data.showtime;

  return (
    <div className="container">
      <h2>{t.selectSeats}</h2>
      <p className="muted">
        {show.movie?.title} · {new Date(show.startAt).toLocaleString()} · {show.hall?.name}
      </p>
      <div className="screen">{t.screen}</div>
      <div className="seat-map">
        {rows.map((row, idx) => (
          <div className="seat-row" key={idx}>
            {row.map((seat) => (
              <button
                key={seat.id}
                className={`seat ${seat.category} ${!seat.available ? "taken" : ""} ${
                  selected.includes(seat.id) ? "selected" : ""
                }`}
                onClick={() => toggle(seat)}
                title={`${seat.id} ${seat.category}`}
              >
                {seat.id.replace(/^[A-Z]/, "")}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="legend">
        <span><i style={{ background: "#3a2c44" }} /> {t.standard}</span>
        <span><i style={{ background: "#4a2f66" }} /> {t.vip}</span>
        <span><i style={{ background: "#e2b15a" }} /> {t.selected}</span>
        <span><i style={{ background: "#2a222e" }} /> {t.taken}</span>
      </div>
      {selected.length > 0 && (
        <div className="panel">
          {selected.map((seatId) => {
            const seat = data.seats.find((s) => s.id === seatId);
            return (
              <div className="space" key={seatId} style={{ marginBottom: 8 }}>
                <span>
                  {seatId} · {t[seat.category]} · {unitPriceFor(seatId, types[seatId] || "adult")} {t.egp}
                </span>
                <select
                  value={types[seatId]}
                  onChange={(e) => setTypes((c) => ({ ...c, [seatId]: e.target.value }))}
                >
                  <option value="adult">{t.adult}</option>
                  <option value="child">{t.child}</option>
                  <option value="student">{t.student}</option>
                </select>
              </div>
            );
          })}
          {user.role !== "customer" && (
            <input
              placeholder="customer@cinema.local"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
            />
          )}
          {error && <div className="alert">{error}</div>}
          <p>
            <strong>
              {t.total}: {total} {t.egp}
            </strong>
          </p>
          <div className="row">
            <button className="btn btn-primary" onClick={() => continuePay("online")}>
              {t.payOnline}
            </button>
            <button className="btn" onClick={() => continuePay("pay_at_cinema")}>
              {t.payCinema}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
