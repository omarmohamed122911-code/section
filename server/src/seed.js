import { hashPassword } from "./auth.js";
import { nowIso, seatLabel } from "./helpers.js";

function vipSeatsFor(rows, seatsPerRow, vipRowCount) {
  const vip = [];
  for (let r = rows - vipRowCount; r < rows; r += 1) {
    for (let s = 0; s < seatsPerRow; s += 1) vip.push(seatLabel(r, s));
  }
  return vip;
}

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export function buildSeed() {
  const admin = {
    id: crypto.randomUUID(),
    fullName: "Cinema Admin",
    email: "admin@cinema.local",
    passwordHash: hashPassword("Admin123!"),
    role: "admin",
    createdAt: nowIso(),
  };
  const staff = {
    id: crypto.randomUUID(),
    fullName: "Box Office Staff",
    email: "staff@cinema.local",
    passwordHash: hashPassword("Staff123!"),
    role: "staff",
    createdAt: nowIso(),
  };
  const customer = {
    id: crypto.randomUUID(),
    fullName: "Demo Customer",
    email: "customer@cinema.local",
    passwordHash: hashPassword("Customer123!"),
    role: "customer",
    createdAt: nowIso(),
  };

  const halls = [
    {
      id: "hall-1",
      name: "Hall 1",
      rows: 8,
      seatsPerRow: 10,
      vipSeats: vipSeatsFor(8, 10, 2),
    },
    {
      id: "hall-2",
      name: "Hall 2",
      rows: 6,
      seatsPerRow: 12,
      vipSeats: vipSeatsFor(6, 12, 2),
    },
  ];

  const movies = [
    {
      id: crypto.randomUUID(),
      title: "Night Express",
      description: "A courier must deliver a mysterious package across the city before midnight.",
      poster: "https://picsum.photos/seed/nightexpress/400/600",
      genre: "Action",
      durationMinutes: 118,
      ageRating: "PG-13",
      language: "English",
    },
    {
      id: crypto.randomUUID(),
      title: "Cairo Letters",
      description: "A warm drama about family, memory, and a box of unsent letters.",
      poster: "https://picsum.photos/seed/cairoletters/400/600",
      genre: "Drama",
      durationMinutes: 132,
      ageRating: "PG",
      language: "Arabic",
    },
    {
      id: crypto.randomUUID(),
      title: "Star Picnic",
      description: "Kids discover a talking telescope and plan a picnic on the moon.",
      poster: "https://picsum.photos/seed/starpicnic/400/600",
      genre: "Family",
      durationMinutes: 95,
      ageRating: "G",
      language: "English",
    },
    {
      id: crypto.randomUUID(),
      title: "Last Screening",
      description: "A cinema owner tries to save the last independently run movie house in town.",
      poster: "https://picsum.photos/seed/lastscreening/400/600",
      genre: "Comedy",
      durationMinutes: 109,
      ageRating: "PG-13",
      language: "English",
    },
  ];

  const showtimes = [
    {
      id: crypto.randomUUID(),
      movieId: movies[0].id,
      hallId: "hall-1",
      startAt: hoursFromNow(3),
      status: "scheduled",
      priceStandard: 120,
      priceVip: 200,
    },
    {
      id: crypto.randomUUID(),
      movieId: movies[0].id,
      hallId: "hall-1",
      startAt: hoursFromNow(27),
      status: "scheduled",
      priceStandard: 120,
      priceVip: 200,
    },
    {
      id: crypto.randomUUID(),
      movieId: movies[1].id,
      hallId: "hall-2",
      startAt: hoursFromNow(5),
      status: "scheduled",
      priceStandard: 100,
      priceVip: 170,
    },
    {
      id: crypto.randomUUID(),
      movieId: movies[2].id,
      hallId: "hall-2",
      startAt: hoursFromNow(8),
      status: "scheduled",
      priceStandard: 90,
      priceVip: 150,
    },
    {
      id: crypto.randomUUID(),
      movieId: movies[3].id,
      hallId: "hall-1",
      startAt: hoursFromNow(-2),
      status: "scheduled",
      priceStandard: 110,
      priceVip: 180,
    },
  ];

  return {
    users: [admin, staff, customer],
    halls,
    movies,
    showtimes,
    bookings: [],
    tickets: [],
    reviews: [],
    audit: [
      {
        id: crypto.randomUUID(),
        userId: admin.id,
        action: "system.seed",
        details: "Sample data created",
        createdAt: nowIso(),
      },
    ],
    settings: {
      reservationHoldMinutes: 15,
      maxTicketsPerBooking: 6,
      allowCustomerCancel: false,
    },
  };
}
