import { Link, useParams } from "react-router-dom";

export default function CheckoutPage() {
  const { bookingId } = useParams();

  return (
    <main className="container">
      <h1>Checkout</h1>
      <p>Booking reference: {bookingId}</p>
      <p>Choose your payment method at the cinema.</p>
      <Link to="/tickets">View My Tickets</Link>
      <br />
      <Link to="/">Back to Movies</Link>
    </main>
  );
}