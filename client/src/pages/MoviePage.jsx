import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useLang } from "../LangContext.jsx";
import { useAuth } from "../AuthContext.jsx";

export default function MoviePage() {
  const { id } = useParams();
  const { t } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [shows, setShows] = useState([]);

  useEffect(() => {
    api(`/api/movies/${id}`).then(setMovie);
    api(`/api/showtimes?movieId=${id}`).then(setShows);
  }, [id]);

  if (!movie) return <div className="container">...</div>;

  function book(showId) {
    if (!user) {
      navigate("/login", { state: { from: `/showtimes/${showId}/seats` } });
      return;
    }
    navigate(`/showtimes/${showId}/seats`);
  }

  return (
    <div className="container">
      <div className="movie-hero">
        <img src={movie.poster} alt={movie.title} />
        <div>
          <p><Link to="/">{t.movies}</Link></p>
          <h1>{movie.title}</h1>
          <p className="muted">{movie.description}</p>
          <p>
            {t.genre}: {movie.genre} · {t.duration}: {movie.durationMinutes} {t.minutes} · {t.ageRating}: {movie.ageRating} · {t.language}: {movie.language}
          </p>
          {movie.averageRating && (
            <p>
              {t.reviews}: {movie.averageRating}/5 ({movie.reviews.length})
            </p>
          )}
        </div>
      </div>
      <div className="panel">
        <h3>{t.showtimes}</h3>
        <div className="show-list">
          {shows.map((show) => (
            <div className="show-item" key={show.id}>
              <div>
                <strong>{new Date(show.startAt).toLocaleString()}</strong>
                <div className="muted">
                  {show.hall?.name} · {t.status}: {t[show.status] || show.status} · {show.priceStandard}-{show.priceVip} {t.egp}
                </div>
              </div>
              {show.status === "scheduled" ? (
                <button className="btn btn-primary" onClick={() => book(show.id)}>
                  {t.bookNow}
                </button>
              ) : (
                <span className="badge">{t[show.status] || show.status}</span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <h3>{t.reviews}</h3>
        {(movie.reviews || []).map((r) => (
          <p key={r.id}>
            ★ {r.rating}/5 — {r.comment || "—"}
          </p>
        ))}
      </div>
    </div>
  );
}
