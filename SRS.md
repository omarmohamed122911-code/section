# Software Requirements Specification (SRS)

**Project:** Cinema Ticket Booking Web Application  
**Client:** Single cinema, one location  
**Process model:** Waterfall  
**Document status:** Draft — submitted for client review and approval  
**Version:** 0.1  
**Date:** 21 October 2026

This document records elicited requirements only. Design and implementation must not start until this SRS is approved. After approval, any change must follow a formal change-evaluation and approval procedure.

---

## 1. Introduction

### 1.1 Purpose

Define the functional requirements, non-functional requirements, business rules, and acceptance criteria for a web application that lets customers book movie tickets online and lets cinema staff and an administrator manage movies, showtimes, seats, users, and bookings.

### 1.2 Intended audience

- Cinema owner / product client (approval authority)
- Analysts and reviewers
- Designers and developers (after approval only)

### 1.3 Definitions

| Term | Meaning |
|---|---|
| Visitor | Unauthenticated user |
| Customer | Registered user who books tickets |
| Staff | Cinema employee with limited operational permissions |
| Admin | Cinema administrator with full system control |
| Hall | Physical auditorium/screen at the single cinema location |
| Showtime | One scheduled screening of one movie in one hall at a specific date and time |
| Seat map | Visual layout of seats in a hall |
| Standard / VIP | Seat categories with different prices |
| Adult / Child / Student | Ticket types |
| Pay-at-cinema | Online reservation paid in cash at the cinema |
| Demo payment | Simulated online payment with no real money transfer |
| Booking reference | Unique identifier of a booking |
| Confirmed booking | Booking that is paid online (demo success) or paid in cash by Staff |

---

## 2. Scope

### 2.1 In scope

- One cinema at one location
- Centralized booking and management
- Responsive website only (desktop, tablet, mobile browsers)
- Browsing movies and showtimes
- Account registration and login for booking
- Seat selection on a visual seat map
- Online demo payment and pay-at-cinema (cash)
- Digital tickets with QR code and PDF download
- Staff ticket verification
- Admin management of movies, showtimes, seats, users, prices, and bookings
- Separate Customer, Staff, and Admin dashboards
- Search and filtering
- Ratings and reviews after attendance
- Reports and Excel/PDF export
- Audit log of important activities
- English (default) and Arabic
- Sample data for demonstration
- Documentation of features that need external services or production configuration

### 2.2 Out of scope (this release)

- Multiple cinema branches or locations
- Native mobile applications
- SMS notifications
- Real payment-gateway transactions (online payment is demo only; integration must remain ready for later)
- Email sending in production until email integration is configured (the product must be prepared for it)
- Food and beverage sales
- Coupons, promotions, and memberships
- Customer cancellation or modification of confirmed bookings through the website

### 2.3 Process constraints

- Waterfall: no design before SRS approval; no implementation before design approval
- Unspecified details are not assumed; they appear in Section 9 (Open issues)
- Technology constraint stated by the client: **React** for the frontend
- Backend and database: “suitable” persistent storage, authentication, and booking management — **selection belongs to the Design phase after SRS approval**

---

## 3. Users and permissions

| Role | Access | Capabilities |
|---|---|---|
| Visitor | Public website | Browse movies and showtimes without logging in |
| Customer | Customer dashboard after login | Register/login; book tickets; select seats; pay (demo) or choose pay-at-cinema; view booking details and tickets; download PDF; rate/review attended screenings |
| Staff | Staff dashboard | Manage customer bookings; create bookings on behalf of customers; record cash payments; view daily showtimes, bookings, attendance, unpaid reservations; verify tickets by QR or booking reference |
| Admin | Admin dashboard | Full control: movies, showtimes, seats/layouts, users (including Staff accounts and roles), bookings, ticket prices, booking rules, cancellation policies, reservation time limits; reports (revenue, booking statistics, cancelled bookings, movie performance, staff activity); export reports; audit visibility of administrative activity |

**Launch accounts**

- Customers create their own accounts
- Admin creates and manages Staff accounts and assigns roles
- One main Admin account at launch
- Staff permissions are limited to booking management and ticket verification (plus the Staff operational views listed above)

**Authentication**

- Registration fields: full name, email, password
- Email verification is **prepared for future implementation**, not required to use the system in this release
- Booking requires registration or login
- Accounts must be protected with authentication and authorization appropriate to each role

---

## 4. Functional requirements

### 4.1 Public browsing

| ID | Requirement |
|---|---|
| FR-01 | Visitors and Customers shall browse available movies. |
| FR-02 | The system shall display movie title, description, poster, genre, duration, age rating, and language. |
| FR-03 | Visitors and Customers shall view showtimes for movies. |
| FR-04 | Users shall search and filter movies, showtimes, and (authorized roles) bookings. |
| FR-05 | The website shall be available 24/7 for browsing and booking. |

### 4.2 Accounts

| ID | Requirement |
|---|---|
| FR-06 | A Customer shall register with full name, email, and password. |
| FR-07 | A registered Customer shall log in and log out. |
| FR-08 | The system shall prevent booking unless the user is authenticated as a Customer (or Staff/Admin acting within allowed booking functions). |
| FR-09 | The design of email verification shall be prepared for later enablement; it shall not block registration/login in this release. |
| FR-10 | Admin shall create, update, and disable Staff accounts and assign the Staff role. |
| FR-11 | The system shall enforce role-based access so that a user cannot use another role’s functions. |

### 4.3 Halls and seats

| ID | Requirement |
|---|---|
| FR-12 | The initial cinema configuration shall include **2 halls**. |
| FR-13 | Each hall shall have a **fixed seat layout** managed only by Admin. |
| FR-14 | Customers shall select **specific seats** from a **visual seat map**. |
| FR-15 | Seats shall include **Standard** and **VIP** categories with different prices. |
| FR-16 | The seat map shall show which seats are available or not available. |
| FR-17 | Customers shall not select unavailable seats. |
| FR-18 | Adjacent seating is a **customer preference**, not a hard restriction: customers may sit together or select non-adjacent seats. |

### 4.4 Movies and showtimes

| ID | Requirement |
|---|---|
| FR-19 | Only Admin shall add, edit, or delete movies and showtimes. |
| FR-20 | A showtime shall be exactly one movie in one hall at one date/time. |
| FR-21 | The system shall allow only one active showtime per hall at a specific time. |
| FR-22 | The system shall prevent overlapping screenings in the same hall. |
| FR-23 | Showtime status shall include: scheduled, active, completed, cancelled. |
| FR-24 | If Admin cancels a showtime, the system shall update related bookings and notify affected customers (via in-system booking status; email when email integration is available). |

### 4.5 Pricing and tickets types

| ID | Requirement |
|---|---|
| FR-25 | Ticket prices shall depend on the **movie screening** and **seat category**. |
| FR-26 | Ticket types shall include **Adult**, **Child**, and **Student**. |
| FR-27 | Admin shall manage ticket prices. |
| FR-28 | All prices shall be displayed in **Egyptian Pounds (EGP)**. |
| FR-29 | The system shall display the **total price** before the Customer confirms the booking. |

### 4.6 Booking

| ID | Requirement |
|---|---|
| FR-30 | A Customer shall book at most **6 tickets per booking**. |
| FR-31 | One booking shall be for a **single showtime**. Additional showtimes require separate bookings. |
| FR-32 | The same Customer may place multiple bookings for different showtimes. |
| FR-33 | Customers shall book available seats **until the showtime begins**. |
| FR-34 | After a showtime begins, Customers shall not book seats for that showtime. |
| FR-35 | Confirmed bookings **cannot be cancelled or modified by Customers through the website** in this release. |
| FR-36 | Staff shall create bookings on behalf of customers and record cash payments at the cinema. |
| FR-37 | The system shall support multiple customers booking at the same time **without double-booking a seat**. |
| FR-38 | Admin shall be able to configure booking rules, cancellation policies, and reservation time limits. |

### 4.7 Payment

| ID | Requirement |
|---|---|
| FR-39 | The Customer shall choose **online payment** or **pay-at-cinema**. |
| FR-40 | Online payment in this release shall be a **demo** flow with **no real transactions**. |
| FR-41 | After successful demo payment, the booking shall become **confirmed**. |
| FR-42 | If demo payment fails, the system shall show a clear error and allow **retry** or switching to **pay-at-cinema** if that option is available. |
| FR-43 | Pay-at-cinema payment method shall be **cash**, recorded by Staff. |
| FR-44 | For unpaid pay-at-cinema reservations, seats shall be held for **15 minutes** by default. If payment is not completed in time, the reservation shall be cancelled automatically and seats released. |
| FR-45 | Online payment integration shall remain **structurally ready** for a future real gateway. This readiness and any production secrets/configuration shall be documented, not activated with live charges in this release. |

### 4.8 Tickets and entry

| ID | Requirement |
|---|---|
| FR-46 | After confirmation, the Customer shall view tickets in their account. |
| FR-47 | The Customer shall download tickets as **PDF**. |
| FR-48 | Each ticket shall include: unique booking reference, movie details, showtime, seat number, and QR code. |
| FR-49 | Staff shall verify a ticket by **scanning the QR code** or **entering the booking reference manually**. |
| FR-50 | Each ticket shall be usable **only once**. The system shall prevent duplicate usage. |
| FR-51 | Tickets belong to the booking Customer; that Customer may bring guests using tickets in the same booking. |

### 4.9 Notifications and language

| ID | Requirement |
|---|---|
| FR-52 | The UI shall support **English (default)** and **Arabic**. |
| FR-53 | The system shall be prepared to send booking confirmations and reminders by **email** when email integration is available. |
| FR-54 | SMS is not required in this release. |
| FR-55 | Features that depend on external services (email, future payment gateway) shall be clearly documented, including what is demo/sample versus production. |

### 4.10 Dashboards, reviews, reports, audit

| ID | Requirement |
|---|---|
| FR-56 | The system shall provide separate **Customer**, **Staff**, and **Admin** dashboards. |
| FR-57 | A Customer who has **attended** a screening shall be able to rate and review that movie. |
| FR-58 | Staff shall view daily showtimes, bookings, attendance, and unpaid reservations. |
| FR-59 | Admin shall view revenue, booking statistics, cancelled bookings, movie performance, and staff activity. |
| FR-60 | Reports shall be exportable to **Excel** and **PDF**. |
| FR-61 | The system shall record an **audit log** of important booking, payment, and administrative activities. |

### 4.11 Demonstration data

| ID | Requirement |
|---|---|
| FR-62 | The system shall include sample data suitable for demonstrating movies, halls, showtimes, seats, users, and bookings. |

---

## 5. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | The product is a **responsive website only**; no mobile app. |
| NFR-02 | The UI shall work on **desktop, tablet, and mobile** browsers. |
| NFR-03 | The frontend shall be built with **React**. |
| NFR-04 | The implementation (after design approval) shall be beginner-friendly, well-organized, and easy to maintain. |
| NFR-05 | Data shall persist in a backend database (technology chosen in Design). |
| NFR-06 | The website shall operate **24/7**. |
| NFR-07 | Concurrent booking shall not assign the same seat to more than one confirmed or held reservation. |
| NFR-08 | Customer information shall be stored securely. |
| NFR-09 | Access shall be controlled by authentication and role-based authorization. |
| NFR-10 | Passwords shall not be stored in reversible form (hashed using a standard password-hashing approach — exact algorithm in Design). |
| NFR-11 | Demo payment shall never capture or charge real payment-card funds. |
| NFR-12 | External-service dependencies and production configuration shall be documented. |
| NFR-13 | Bilingual UI: English default, Arabic supported. |
| NFR-14 | Currency display: EGP. |
| NFR-15 | The system shall remain usable if email is not configured; email is deferred until integration is available. |

**Not specified by the client (see Open issues):** target browsers list, expected daily load, data-retention period, recovery time, and detailed security certifications.

---

## 6. Business rules

| ID | Rule |
|---|---|
| BR-01 | Single cinema, one location, centralized operations. |
| BR-02 | Only three roles: Customer, Staff, Admin. |
| BR-03 | Visitors may browse; booking requires a Customer account (or Staff booking on behalf of a customer). |
| BR-04 | Maximum **6 tickets** per booking. |
| BR-05 | A booking covers **one showtime only**. |
| BR-06 | Customers cannot cancel or change confirmed bookings on the website in this release. |
| BR-07 | Default unpaid reservation hold: **15 minutes**, then auto-cancel and release seats. |
| BR-08 | Cash is the pay-at-cinema method. |
| BR-09 | Online payment success (demo) confirms the booking. |
| BR-10 | No overlapping showtimes in the same hall; one active showtime per hall at a given time. |
| BR-11 | Only Admin manages movies, showtimes, seat layouts, prices, Staff users, and configurable policies. |
| BR-12 | Seat categories: Standard and VIP. Ticket types: Adult, Child, Student. Prices in EGP. |
| BR-13 | Booking of a showtime is allowed only while seats are available and **before the showtime start**. |
| BR-14 | A ticket may be validated once; reused tickets must be rejected. |
| BR-15 | Guests may enter on tickets from the Customer’s booking; identity of each guest is not required beyond holding a valid unused ticket. |
| BR-16 | Reviews/ratings are limited to Customers who attended the screening. |
| BR-17 | Initial hall count is 2. Layout per hall is fixed unless changed by Admin. |
| BR-18 | Admin-configurable items include booking rules, cancellation policies, and reservation time limits. Configured values must not violate unchangeable rules unless the client later approves a change request. **Conflict to resolve:** see OI-06. |
| BR-19 | Showtime cancellation must update bookings and notify customers. **Refund behavior is not specified** (OI-03). |
| BR-20 | Sample/demo mode is the intended first operational mode for payments. |

---

## 7. Acceptance criteria

The release is acceptable when all of the following are true.

### 7.1 Customer journey

| ID | Criterion |
|---|---|
| AC-01 | A visitor can open the site, browse movies/showtimes, and is blocked from completing a booking until login/registration. |
| AC-02 | Registration with full name, email, and password creates a Customer account that can log in. |
| AC-03 | After login, a Customer can open a showtime seat map, see available vs unavailable seats, and select up to 6 seats. |
| AC-04 | Selecting an unavailable seat is rejected. |
| AC-05 | The Customer sees an itemized total in EGP before confirm. |
| AC-06 | Demo pay success creates a confirmed booking and tickets (reference, movie, showtime, seat, QR) visible in the account and downloadable as PDF. |
| AC-07 | Demo pay failure shows a clear error and offers retry and pay-at-cinema (when available). |
| AC-08 | Pay-at-cinema holds selected seats; after 15 minutes without cash confirmation, seats are free and the reservation is cancelled. |
| AC-09 | Staff recording cash before the 15-minute expiry confirms the booking. |
| AC-10 | After showtime start, new Customer bookings for that showtime are rejected. |
| AC-11 | The Customer has no website action to cancel or edit a confirmed booking. |
| AC-12 | A Customer can place a second booking for a different showtime. |
| AC-13 | English is the default UI; the user can switch to Arabic. |
| AC-14 | Layout remains usable on desktop, tablet, and mobile widths. |

### 7.2 Concurrency and seats

| ID | Criterion |
|---|---|
| AC-15 | Two users cannot both confirm/hold the same seat for the same showtime. |
| AC-16 | Two halls exist; each has Standard and VIP seats on a visual map. |
| AC-17 | Admin can change a hall’s seat layout; Customers cannot. |

### 7.3 Admin and Staff

| ID | Criterion |
|---|---|
| AC-18 | Only Admin can add/edit/delete movies and showtimes. |
| AC-19 | Creating an overlapping showtime in the same hall is rejected. |
| AC-20 | Cancelling a showtime updates related bookings and makes notification available (in-app immediately; email when configured). |
| AC-21 | Staff can create a booking for a customer and mark it paid in cash. |
| AC-22 | Staff can open daily showtimes, bookings, attendance, and unpaid reservations. |
| AC-23 | Admin can open revenue, booking statistics, cancelled bookings, movie performance, and staff activity, and export Excel and PDF. |
| AC-24 | Staff cannot access Admin-only functions (movie/showtime/seat-layout/price/user administration). |
| AC-25 | One main Admin account exists at launch and can create Staff accounts. |

### 7.4 Tickets

| ID | Criterion |
|---|---|
| AC-26 | Staff validation by QR marks that ticket used; a second scan is rejected. |
| AC-27 | Staff validation by booking reference identifies the booking/tickets and does not allow reuse of already used tickets. |
| AC-28 | Guests may be admitted on unused tickets from the same booking. |

### 7.5 Reviews, audit, demo

| ID | Criterion |
|---|---|
| AC-29 | A Customer who has not attended cannot submit a rating/review for that screening; an attending Customer can. |
| AC-30 | Important booking, payment, and Admin/Staff actions appear in the audit log. |
| AC-31 | Demo payment performs no real financial transaction. |
| AC-32 | Sample data is present for a demonstration walkthrough. |
| AC-33 | Documentation lists email, real payments, and any other external/production items as not fully enabled. |

---

## 8. Assumptions explicitly not made

The following were **not** invented as requirements:

- Exact row/column counts and how many Standard vs VIP seats per hall
- Whether Admin may add a third hall after launch
- Refunds, credits, or compensation amounts
- Tax or service-fee breakdown
- Exact browsers (Chrome/Firefox/Safari/Edge versions)
- Daily user/booking volume targets
- How long personal and booking data are retained
- Whether age rating blocks Child bookings
- Whether QR is unique per ticket or per booking (ticket content includes both a booking reference and a QR; uniqueness of the QR itself is not fully specified)

---

## 9. Open issues — client decision required

These items must be decided before the SRS can be treated as fully complete. Until then they remain **unapproved**.

| ID | Topic | Why it matters | Question |
|---|---|---|---|
| OI-01 | Default seat maps | Cannot fix hall capacity | For each of the 2 halls, what is the default layout (rows, seats per row, which seats are VIP)? Or is an empty layout filled only by Admin acceptable for first run? |
| OI-02 | Extra halls | Scope of Admin | May Admin add/remove halls beyond the initial 2, or is 2 a permanent limit? |
| OI-03 | Cancelled showtime money | Booking update rule | For a cancelled showtime: what happens to **demo-paid** bookings and to **unpaid pay-at-cinema** bookings? Refund, voucher, auto-cancel only, or Admin handles manually? |
| OI-04 | Price formula | Charging | Is the unit price always **showtime + seat category + ticket type** (e.g. Child VIP vs Adult Standard)? |
| OI-05 | Taxes/fees | Total price | Is the displayed total the final amount, with no extra tax/fee lines? |
| OI-06 | Configurable vs fixed rules | BR-04, BR-06, BR-07 vs FR-38 | If Admin changes cancellation policy or the 15-minute hold or the 6-ticket cap, do those Admin settings override the fixed rules in this SRS? |
| OI-07 | Manual booking-reference check-in | Door process | For a booking with several tickets, does entering the booking reference check in **all unused tickets at once**, or **one ticket at a time**? |
| OI-08 | QR uniqueness | Validation | Is the QR code **unique per ticket (per seat)**? |
| OI-09 | Meaning of “attended” | Reviews | Is attendance = successful Staff validation of at least one ticket, or = showtime status became completed? |
| OI-10 | Age rating | Child tickets | Does age rating **prevent** booking (e.g. Child ticket for an adult-only film), or is rating informational only? |
| OI-11 | Staff/Admin cancellation | Exception to BR-06 | May Staff or Admin cancel a confirmed booking on behalf of a customer (no-show, mistaken booking), even though the Customer cannot? |
| OI-12 | Data retention | Privacy | How long should customer and booking records be kept? |
| OI-13 | Report export by Staff | Permissions | May Staff export Excel/PDF, or is export **Admin only**? (Earlier: Admin export; later: reports exportable.) |
| OI-14 | Email now vs later | Notifications | For this release, is **in-app status only** enough, with email documented as future, or must a specific email provider be configured? |

---

## 10. Approval

| Role | Name | Decision | Date |
|---|---|---|---|
| Client | | Approved / Approved with changes / Rejected | |
| Analyst | | Submitted for review | 21 October 2026 |

**Approval statement**

I confirm that this SRS reflects the intended system, including Functional Requirements, Non-Functional Requirements, Business Rules, and Acceptance Criteria. I understand that design will start only after approval, implementation only after design approval, and that later changes require a formal change request.

---

## 11. Traceability (elicitation → this draft)

Client decisions already incorporated: single location; roles Customer/Staff/Admin; login before booking; browse as visitor; demo online pay + cash at cinema; 15-minute unpaid hold; 2 halls; visual seat map; Standard/VIP; Admin-only layouts; movie fields; no overlapping showtimes; showtime statuses; prices by screening and seat category; Adult/Child/Student; EGP; total before confirm; max 6 tickets; no customer cancel/modify on website; Staff proxy booking and cash; QR + PDF tickets; one-time use; guests allowed; website only; EN/AR; no SMS; Staff/Admin reports; 24/7; book until showtime start; concurrency without double-booking; audit log; secure accounts; dashboards; search/filter; ratings after attendance; React frontend; sample data; document external/production features.
