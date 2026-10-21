import { jsPDF } from "jspdf";
import QRCode from "qrcode";

export async function downloadTicketsPdf(booking) {
  const doc = new jsPDF();
  let y = 16;
  doc.setFontSize(18);
  doc.text("Noir Cinema", 14, y);
  y += 10;
  doc.setFontSize(11);
  doc.text(`Booking ${booking.reference}`, 14, y);
  y += 6;
  doc.text(`${booking.showtime?.movie?.title || ""}`, 14, y);
  y += 6;
  doc.text(`${new Date(booking.showtime?.startAt).toLocaleString()} · ${booking.showtime?.hall?.name || ""}`, 14, y);
  y += 10;

  for (const ticket of booking.tickets) {
    if (y > 250) {
      doc.addPage();
      y = 16;
    }
    const qr = await QRCode.toDataURL(`TICKET:${ticket.qrToken}`);
    doc.setDrawColor(180);
    doc.rect(12, y - 6, 186, 52);
    doc.text(`Seat ${ticket.seatId} · ${ticket.seatCategory} · ${ticket.ticketType}`, 16, y + 4);
    doc.text(`${ticket.price} EGP`, 16, y + 12);
    doc.addImage(qr, "PNG", 150, y - 4, 40, 40);
    y += 58;
  }
  doc.save(`${booking.reference}.pdf`);
}
