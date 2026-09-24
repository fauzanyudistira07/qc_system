import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Json = any;
type Check = { name: string; status: number; expected: number[]; passed: boolean; detail?: string };

async function main() {
  const baseUrl = process.env.QC_ZANNORA_BASE_URL || 'http://127.0.0.1:8000';
  const password = process.env.QC_ZANNORA_PASSWORD;
  if (!password) throw new Error('Set QC_ZANNORA_PASSWORD before API E2E.');
  const checks: Check[] = [];
  const created: Record<string, any> = { suffix: String(Date.now()).slice(-8), registeredEmail: '', passengerId: null, bookingId: null, bookingCode: '', paymentId: null, airlineId: null, airportId: null, airplaneId: null, seatId: null, flightId: null };
  const tokens: Record<string, string> = {};

  async function call(name: string, method: string, route: string, token?: string, body?: Json, expected: number[] = [200]) {
    const response = await fetch(new URL(route, baseUrl), {
      method,
      headers: { accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const raw = await response.text();
    let json: Json = raw;
    try { json = raw ? JSON.parse(raw) : null; } catch { /* Keep text for diagnostics. */ }
    const passed = expected.includes(response.status);
    const detail = passed ? undefined : typeof json === 'string' ? json.slice(0, 240) : JSON.stringify(json).slice(0, 500);
    checks.push({ name, status: response.status, expected, passed, detail });
    if (!passed) throw new Error(`${name}: expected ${expected.join('/')} got ${response.status} ${detail || ''}`);
    return json;
  }

  function data(payload: Json): Json { return payload?.data; }
  function list(payload: Json): Json[] { return Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.data?.data) ? payload.data.data : []; }

  async function login(label: string, email: string) {
    const payload = await call(`API login ${label}`, 'POST', '/api/v1/login', undefined, { email, password });
    const token = data(payload)?.token;
    if (!token) throw new Error(`API login ${label} did not return a token.`);
    tokens[label] = token;
    return data(payload)?.user;
  }

  const admin = await login('admin', 'admin@zannora.com');
  const staff = await login('staff', 'staff@zannora.com');
  const manager = await login('manager', 'manager@zannora.com');
  const customer = await login('customer', 'user@zannora.com');
  await call('API invalid credentials', 'POST', '/api/v1/login', undefined, { email: 'user@zannora.com', password: 'wrong-password' }, [401]);
  await call('API invalid login validation', 'POST', '/api/v1/login', undefined, {}, [422]);
  await call('API protected route without token', 'GET', '/api/v1/my-bookings', undefined, undefined, [401]);

  for (const [name, route] of [['public airlines', '/api/v1/airlines'], ['public airports', '/api/v1/airports'], ['public airplanes', '/api/v1/airplanes'], ['public flights', '/api/v1/flights']] as const) await call(name, 'GET', route);
  await call('customer profile read', 'GET', '/api/v1/profile', tokens.customer);
  await call('customer profile update', 'PUT', '/api/v1/profile', tokens.customer, { name: 'Demo User', email: 'user@zannora.com', phone: '08111111111' });
  await call('customer passenger list empty-or-existing', 'GET', '/api/v1/passengers', tokens.customer);

  const passengerName = `QC_TEST_API_Passenger_${created.suffix}`;
  created.registeredEmail = `qc_test_api_${created.suffix}@example.com`;
  const registered = await call('API customer registration', 'POST', '/api/v1/register', undefined, { name: `QC_TEST User ${created.suffix}`, email: created.registeredEmail, password: 'password123', password_confirmation: 'password123', phone: '08999999999' }, [201]);
  tokens.registered = data(registered)?.token;
  await call('registered customer logout', 'POST', '/api/v1/logout', tokens.registered);

  const passenger = await call('customer passenger create', 'POST', '/api/v1/passengers', tokens.customer, { full_name: passengerName, gender: 'male', birth_date: '1990-01-01', nationality: 'Indonesia', identity_number: `QC${created.suffix}` }, [201]);
  created.passengerId = data(passenger)?.id;
  await call('customer passenger invalid validation', 'POST', '/api/v1/passengers', tokens.customer, {}, [422]);
  await call('customer passenger detail', 'GET', `/api/v1/passengers/${created.passengerId}`, tokens.customer);
  await call('customer passenger update', 'PUT', `/api/v1/passengers/${created.passengerId}`, tokens.customer, { full_name: `${passengerName}_EDIT`, gender: 'male', birth_date: '1990-01-01', nationality: 'Indonesia', identity_number: `QC${created.suffix}` });

  const publicFlights = await call('flight search list', 'GET', '/api/v1/flights');
  const seedFlight = list(publicFlights)[0];
  if (!seedFlight?.id) throw new Error('No seeded flight returned from public API.');
  created.flightId = seedFlight.id;
  const available = await call('flight available seats', 'GET', `/api/v1/flights/${created.flightId}/available-seats`);
  const seat = list(available)[0];
  if (!seat?.id) throw new Error('No available seat returned from flight API.');

  // Admin role matrix and read-only operational/report endpoints.
  for (const route of ['/api/v1/admin/dashboard/summary', '/api/v1/admin/dashboard/recent-bookings', '/api/v1/admin/dashboard/recent-payments', '/api/v1/admin/reports/bookings', '/api/v1/admin/reports/payments', '/api/v1/admin/reports/revenue', '/api/v1/admin/reports/popular-routes', '/api/v1/admin/users', '/api/v1/admin/airlines', '/api/v1/admin/airplanes', '/api/v1/admin/airports', '/api/v1/admin/flights', '/api/v1/admin/bookings', '/api/v1/admin/payments', '/api/v1/admin/seats', '/api/v1/admin/tickets', '/api/v1/admin/profile']) await call(`admin GET ${route}`, 'GET', route, tokens.admin);
  for (const route of ['/api/v1/admin/reports/bookings', '/api/v1/admin/reports/payments', '/api/v1/admin/reports/revenue', '/api/v1/admin/reports/popular-routes', '/api/v1/admin/users']) await call(`manager allowed ${route}`, 'GET', route, tokens.manager);
  for (const route of ['/api/v1/admin/airlines', '/api/v1/admin/airplanes', '/api/v1/admin/airports', '/api/v1/admin/flights']) await call(`manager allowed master-data read ${route}`, 'GET', route, tokens.manager);
  for (const route of ['/api/v1/admin/airlines', '/api/v1/admin/airplanes', '/api/v1/admin/airports', '/api/v1/admin/flights']) await call(`manager forbidden master-data write ${route}`, 'POST', route, tokens.manager, {}, [403]);
  for (const route of ['/api/v1/admin/reports/bookings', '/api/v1/admin/users']) await call(`staff forbidden ${route}`, 'GET', route, tokens.staff, undefined, [403]);
  await call('customer forbidden admin summary', 'GET', '/api/v1/admin/dashboard/summary', tokens.customer, undefined, [403]);

  // Master-data CRUD, all with isolated QC_TEST values.
  const airline = await call('admin airline create', 'POST', '/api/v1/admin/airlines', tokens.admin, { name: `QC_TEST_API_Airline_${created.suffix}`, code: `QA${created.suffix}`, description: 'API E2E fixture' }, [201]);
  created.airlineId = data(airline)?.id;
  await call('admin airline show', 'GET', `/api/v1/admin/airlines/${created.airlineId}`, tokens.admin);
  await call('admin airline update', 'PUT', `/api/v1/admin/airlines/${created.airlineId}`, tokens.admin, { name: `QC_TEST_API_Airline_${created.suffix}_EDIT`, code: `QA${created.suffix}`, description: 'API E2E fixture updated' });

  const airport = await call('admin airport create', 'POST', '/api/v1/admin/airports', tokens.admin, { code: `Q${created.suffix}`.slice(0, 10), name: `QC_TEST Airport ${created.suffix}`, city: 'QC City', country: 'Indonesia' }, [201]);
  created.airportId = data(airport)?.id;
  await call('admin airport show', 'GET', `/api/v1/admin/airports/${created.airportId}`, tokens.admin);
  await call('admin airport update', 'PUT', `/api/v1/admin/airports/${created.airportId}`, tokens.admin, { code: `Q${created.suffix}`.slice(0, 10), name: `QC_TEST Airport ${created.suffix} EDIT`, city: 'QC City', country: 'Indonesia' });

  const airplane = await call('admin airplane create', 'POST', '/api/v1/admin/airplanes', tokens.admin, { airline_id: created.airlineId, model: 'QC_TEST Model', registration_number: `QC-${created.suffix}`, capacity: 2, description: 'API E2E fixture' }, [201]);
  created.airplaneId = data(airplane)?.id;
  await call('admin airplane show', 'GET', `/api/v1/admin/airplanes/${created.airplaneId}`, tokens.admin);
  await call('admin airplane update', 'PUT', `/api/v1/admin/airplanes/${created.airplaneId}`, tokens.admin, { airline_id: created.airlineId, model: 'QC_TEST Model EDIT', registration_number: `QC-${created.suffix}`, capacity: 2, description: 'API E2E fixture updated' });
  await call('admin airplane generate seats', 'POST', `/api/v1/admin/airplanes/${created.airplaneId}/generate-seats`, tokens.admin, { class: 'economy', reset: true });
  const customSeat = await call('admin seat create', 'POST', '/api/v1/admin/seats', tokens.admin, { airplane_id: created.airplaneId, seat_number: '9Z', class: 'economy' }, [201]);
  created.seatId = data(customSeat)?.id;
  await call('admin seat show', 'GET', `/api/v1/admin/seats/${created.seatId}`, tokens.admin);
  await call('admin seat update', 'PUT', `/api/v1/admin/seats/${created.seatId}`, tokens.admin, { airplane_id: created.airplaneId, seat_number: '9Y', class: 'business' });
  await call('admin seat delete', 'DELETE', `/api/v1/admin/seats/${created.seatId}`, tokens.admin);
  created.seatId = null;

  const qcFlight = await call('admin flight create', 'POST', '/api/v1/admin/flights', tokens.admin, { airline_id: created.airlineId, airplane_id: created.airplaneId, departure_airport_id: 1, arrival_airport_id: 2, flight_number: `QC${created.suffix}`, departure_time: '2030-01-02 10:00:00', arrival_time: '2030-01-02 12:00:00', price: 123456, status: 'scheduled' }, [201]);
  created.qcFlightId = data(qcFlight)?.id;
  await call('admin flight show', 'GET', `/api/v1/flights/${created.qcFlightId}`, tokens.admin);
  await call('admin flight update status', 'PATCH', `/api/v1/admin/flights/${created.qcFlightId}/status`, tokens.admin, { status: 'delayed' });
  await call('admin flight delete', 'DELETE', `/api/v1/admin/flights/${created.qcFlightId}`, tokens.admin);
  created.qcFlightId = null;

  // Customer booking -> payment -> admin verification -> ticket issuance.
  const booking = await call('customer booking create', 'POST', '/api/v1/bookings', tokens.customer, { flight_id: created.flightId, passengers: [{ passenger_id: created.passengerId, seat_id: seat.id }] }, [201]);
  created.bookingId = data(booking)?.id;
  created.bookingCode = data(booking)?.booking_code || '';
  await call('customer booking list', 'GET', '/api/v1/my-bookings', tokens.customer);
  await call('customer booking detail', 'GET', `/api/v1/bookings/${created.bookingId}`, tokens.customer);
  const payment = await call('customer bank-transfer payment create', 'POST', '/api/v1/payments', tokens.customer, { booking_id: created.bookingId, payment_method: 'bank_transfer' }, [201]);
  created.paymentId = data(payment)?.id;
  await call('customer payment detail', 'GET', `/api/v1/payments/${created.paymentId}`, tokens.customer);
  await call('admin payment verify', 'POST', `/api/v1/admin/payments/${created.paymentId}/verify`, tokens.admin, { payment_status: 'paid', transaction_code: `QC_TRX_${created.suffix}` });
  const confirmed = await call('customer confirmed booking and ticket', 'GET', `/api/v1/bookings/${created.bookingId}`, tokens.customer);
  if (!data(confirmed)?.details?.[0]?.ticket) throw new Error('Paid booking did not issue a ticket.');
  await call('admin ticket list after payment', 'GET', '/api/v1/admin/tickets', tokens.admin);
  await call('customer cancel confirmed booking validation', 'POST', `/api/v1/bookings/${created.bookingId}/cancel`, tokens.customer, undefined, [422]);
  await call('admin logout', 'POST', '/api/v1/logout', tokens.admin);

  const report = { generatedAt: new Date().toISOString(), status: checks.every((check) => check.passed) ? 'PASSED' : 'FAILED', checks, created, summary: { total: checks.length, passed: checks.filter((check) => check.passed).length, failed: checks.filter((check) => !check.passed).length } };
  const dir = path.resolve('.qc-artifacts/zannora/runs');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `api-e2e-${created.suffix}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(JSON.stringify({ bookingCode: created.bookingCode, bookingId: created.bookingId, passengerId: created.passengerId, registeredEmail: created.registeredEmail }, null, 2));
  if (report.status !== 'PASSED') process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
