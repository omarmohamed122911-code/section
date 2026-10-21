import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useLang } from "../LangContext.jsx";
import { useAuth } from "../AuthContext.jsx";

export default function Home() {
  const { t } = useLang();
  const { user } = useAuth();
  const [movies, setMovies] = useState([]);
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (genre) params.set("genre", genre);
    api(`/api/movies?${params.toString()}`).then(setMovies).catch(() => setMovies([]));
  }, [q, genre]);

  const genres = ["", "Action", "Drama", "Family", "Comedy"];

  return (
    <div className="container">
      <section className="hero">
        <h1>{t.brand}</h1>
        <p>{t.tagline}</p>
        {!user && <p className="muted">{t.browseAsGuest}</p>}
      </section>
      <div className="toolbar">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} />
        <select value={genre} onChange={(e) => setGenre(e.target.value)}>
          {genres.map((g) => (
            <option key={g} value={g}>
              {g || t.filterGenre}
            </option>
          ))}
        </select>
      </div>
      {movies.length === 0 ? <p>{t.noMovies}</p> : null}
      <div className="grid">
        {movies.map((movie) => (
          <Link className="card" key={movie.id} to={`/movies/${movie.id}`}>
            <img src={movie.poster} alt={movie.title} />
            <div className="card-body">
              <strong>{movie.title}</strong>
              <div className="muted">
                {movie.genre} · {movie.durationMinutes} {t.minutes} · {movie.ageRating}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
