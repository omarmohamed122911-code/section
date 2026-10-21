import { Link } from "react-router-dom";

export default function TicketsPage() {
  return (
    <main className="container">
      <h1>My Tickets</h1>
      <p>Your bookings will appear here.</p>
      <Link to="/">Browse Movies</Link>
    </main>
  );
}