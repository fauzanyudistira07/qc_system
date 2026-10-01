import { mkdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const baseUrl = process.env.QC_CAKRAWALA_BASE_URL || 'http://127.0.0.1:8080';
const password = process.env.QC_CAKRAWALA_PASSWORD;
const accounts = {
  admin: process.env.QC_CAKRAWALA_ADMIN_EMAIL || 'admin@gmail.com',
  customer: process.env.QC_CAKRAWALA_CUSTOMER_EMAIL || 'customer@gmail.com',
};
if (!password) throw new Error('Set QC_CAKRAWALA_PASSWORD untuk runner lokal.');

const suffix = `${Date.now()}`.slice(-10);
const checks = [];
const created = { airlineId: null, airplaneId: null, flightId: null, passengerId: null, bookingIds: [], paymentIds: [] };
const tokens = {};

async function request(name, method, route, token, body, expected = [200]) {
  const response = await fetch(new URL(route, baseUrl), {
    method,
    headers: { accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let payload = raw;
  try { payload = raw ? JSON.parse(raw) : null; } catch { /* Preserve text diagnostics. */ }
  const passed = expected.includes(response.status);
  checks.push({ name, status: response.status, expected, passed, detail: passed ? undefined : typeof payload === 'string' ? payload.slice(0, 300) : JSON.stringify(payload).slice(0, 600) });
  if (!passed) throw new Error(`${name}: expected ${expected.join('/')} got ${response.status} ${typeof payload === 'string' ? payload.slice(0, 300) : JSON.stringify(payload).slice(0, 700)}`);
  return payload;
}

const data = (payload) => payload?.data ?? payload;
const list = (payload) => Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.data?.data) ? payload.data.data : [];
const assert = (name, value, detail) => { checks.push({ name, status: value ? 200 : 500, expected: [200], passed: Boolean(value), detail: value ? undefined : detail }); if (!value) throw new Error(detail || name); };

async function login(label, email) {
  const payload = await request(`login ${label}`, 'POST', '/api/v1/login', undefined, { email, password });
  const token = data(payload)?.token;
  assert(`${label} token returned`, Boolean(token), 'Login tidak mengembalikan token.');
  tokens[label] = token;
}

async function cleanup() {
  if (!created.bookingIds.length && !created.passengerId && !created.flightId) return;
  const ids = created.bookingIds.filter(Boolean).join(',') || '0';
  const sql = [
    `DELETE FROM payments WHERE booking_id IN (${ids});`,
    `DELETE FROM booking_details WHERE booking_id IN (${ids});`,
    `DELETE FROM bookings WHERE id IN (${ids});`,
    created.passengerId ? `DELETE FROM passengers WHERE id = ${Number(created.passengerId)};` : '',
    created.flightId ? `DELETE FROM flights WHERE id = ${Number(created.flightId)};` : '',
    created.airplaneId ? `DELETE FROM seats WHERE airplane_id = ${Number(created.airplaneId)};` : '',
    created.airplaneId ? `DELETE FROM airplanes WHERE id = ${Number(created.airplaneId)};` : '',
    created.airlineId ? `DELETE FROM airlines WHERE id = ${Number(created.airlineId)};` : '',
  ].filter(Boolean).join(' ');
  try {
    await execFileAsync('docker', ['--context', 'desktop-linux', 'exec', '-e', 'MYSQL_PWD=cakrawala_qc_password', 'cakrawala-mysql', 'mysql', '-u', 'cakrawala_qc', '-D', 'cakrawala_qc', '-e', sql], { windowsHide: true, timeout: 30_000 });
    checks.push({ name: 'fixture cleanup', status: 200, expected: [200], passed: true });
  } catch (error) {
    checks.push({ name: 'fixture cleanup', status: 500, expected: [200], passed: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

async function main() {
  await login('admin', accounts.admin);
  await login('customer', accounts.customer);

  const airports = list(await request('admin airport inventory', 'GET', '/api/v1/admin/airports', tokens.admin));
  const departure = airports[0]?.id;
  const arrival = airports.find((item) => item.id !== departure)?.id;
  assert('two airports available for fixture flight', Boolean(departure && arrival));

  const airline = data(await request('create QC fixture airline', 'POST', '/api/v1/admin/airlines', tokens.admin, { name: `QC_TEST Airline ${suffix}`, code: `Q${suffix}`.slice(0, 10), description: 'Local transaction fixture' }, [201]));
  created.airlineId = airline.id;
  await request('duplicate airline rejected', 'POST', '/api/v1/admin/airlines', tokens.admin, { name: `QC_TEST Airline Duplicate ${suffix}`, code: airline.code, description: 'Duplicate fixture' }, [422]);

  const airplane = data(await request('create QC fixture airplane', 'POST', '/api/v1/admin/airplanes', tokens.admin, { airline_id: created.airlineId, model: `QC_TEST Model ${suffix}`, registration_number: `QC-${suffix}`, capacity: 4, description: 'Local transaction fixture' }, [201]));
  created.airplaneId = airplane.id;
  for (const seatNumber of ['1A', '1B', '1C', '1D']) {
    await request(`create fixture seat ${seatNumber}`, 'POST', '/api/v1/admin/seats', tokens.admin, { airplane_id: created.airplaneId, seat_number: seatNumber, class: 'economy' }, [201]);
  }
  const flight = data(await request('create QC fixture flight', 'POST', '/api/v1/admin/flights', tokens.admin, { airline_id: created.airlineId, airplane_id: created.airplaneId, departure_airport_id: departure, arrival_airport_id: arrival, flight_number: `QC${suffix}`, departure_time: '2030-01-02 10:00:00', arrival_time: '2030-01-02 12:00:00', price: 123456, status: 'scheduled' }, [201]));
  created.flightId = flight.id;
  const passenger = data(await request('create QC fixture passenger', 'POST', '/api/v1/passengers', tokens.customer, { full_name: `QC_TEST Passenger ${suffix}`, gender: 'male', birth_date: '1990-01-01', nationality: 'Indonesia', identity_number: `QC${suffix}` }, [201]));
  created.passengerId = passenger.id;

  const seats = list(await request('list fixture seats', 'GET', `/api/v1/flights/${created.flightId}/available-seats`, tokens.customer));
  assert('fixture has at least four seats', seats.length >= 4);
  const makeBooking = async (seat) => {
    const booking = data(await request('create pending booking', 'POST', '/api/v1/bookings', tokens.customer, { flight_id: created.flightId, seat_class: 'economy', passengers: [{ passenger_id: created.passengerId, seat_id: seat.id }] }, [201]));
    created.bookingIds.push(booking.id);
    return booking;
  };

  const cancellationBooking = await makeBooking(seats[0]);
  const cancellation = data(await request('cancel pending booking', 'POST', `/api/v1/bookings/${cancellationBooking.id}/cancel`, tokens.customer, undefined, [200]));
  assert('cancellation changes status to cancelled', cancellation.status === 'cancelled');
  const restoredSeats = list(await request('cancelled booking restores seat', 'GET', `/api/v1/flights/${created.flightId}/available-seats`, tokens.customer));
  assert('cancelled booking restores capacity', restoredSeats.some((seat) => seat.id === seats[0].id));

  const failedBooking = await makeBooking(seats[1]);
  const failedBookingDetail = data(await request('read pending payment fixture', 'GET', `/api/v1/bookings/${failedBooking.id}`, tokens.customer));
  const payment = failedBookingDetail?.payments?.[0];
  assert('pending payment fixture exists', Boolean(payment?.id));
  created.paymentIds.push(payment.id);
  const failedPayment = data(await request('reject payment', 'POST', `/api/v1/admin/payments/${payment.id}/reject`, tokens.admin, { transaction_code: `QC_FAIL_${suffix}` }, [200]));
  assert('payment failure status recorded', failedPayment.payment_status === 'failed');

  const expiredBooking = await makeBooking(seats[2]);
  const expiredBookingDetail = data(await request('read expiry payment fixture', 'GET', `/api/v1/bookings/${expiredBooking.id}`, tokens.customer));
  const expiredPayment = expiredBookingDetail?.payments?.[0];
  assert('expiry payment fixture exists', Boolean(expiredPayment?.id));
  created.paymentIds.push(expiredPayment.id);
  await execFileAsync('docker', ['--context', 'desktop-linux', 'exec', '-e', 'MYSQL_PWD=cakrawala_qc_password', 'cakrawala-mysql', 'mysql', '-u', 'cakrawala_qc', '-D', 'cakrawala_qc', '-e', `UPDATE bookings SET expired_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE id = ${Number(expiredBooking.id)};`], { windowsHide: true, timeout: 30_000 });
  await execFileAsync('docker', ['--context', 'desktop-linux', 'exec', 'cakrawala-app', 'php', 'artisan', 'tinker', '--execute', "app('App\\\\Services\\\\BookingExpiryService')->expirePendingBookings();"], { windowsHide: true, timeout: 30_000 });
  const expired = data(await request('expire pending booking', 'GET', `/api/v1/bookings/${expiredBooking.id}`, tokens.customer));
  assert('expired booking becomes cancelled', expired.status === 'cancelled');
  const expiredPaymentState = list(await request('expired payment detail list', 'GET', '/api/v1/my-bookings', tokens.customer)).find((item) => item.id === expiredBooking.id);
  assert('expired payment no longer remains active', expiredPaymentState?.status === 'cancelled');

  const refundBooking = await makeBooking(seats[3]);
  const refundBookingDetail = data(await request('read refund payment fixture', 'GET', `/api/v1/bookings/${refundBooking.id}`, tokens.customer));
  const refundPayment = refundBookingDetail?.payments?.[0];
  assert('refund payment fixture exists', Boolean(refundPayment?.id));
  created.paymentIds.push(refundPayment.id);
  const refunded = data(await request('mark payment refunded', 'POST', `/api/v1/admin/payments/${refundPayment.id}/verify`, tokens.admin, { payment_status: 'refunded', transaction_code: `QC_REFUND_${suffix}` }, [200]));
  assert('refund status recorded', refunded.payment_status === 'refunded');
  const refundedBooking = data(await request('refunded booking detail', 'GET', `/api/v1/bookings/${refundBooking.id}`, tokens.customer));
  assert('refund cancels booking', refundedBooking.status === 'cancelled');

  await request('delete in-use airline attempt', 'DELETE', `/api/v1/admin/airlines/${created.airlineId}`, tokens.admin, undefined, [200, 409, 422, 500]);
  const deleteAttempt = checks.at(-1);
  checks.push({ name: 'delete in-use airline is blocked', status: deleteAttempt.status, expected: [409, 422, 500], passed: deleteAttempt.status !== 200, detail: deleteAttempt.status === 200 ? 'Target menghapus airline yang masih direferensikan airplane/flight.' : undefined });
  const airlineStillExists = await fetch(new URL(`/api/v1/admin/airlines/${created.airlineId}`, baseUrl), { headers: { accept: 'application/json', authorization: `Bearer ${tokens.admin}` } });
  checks.push({ name: 'in-use airline remains after delete attempt', status: airlineStillExists.status, expected: [200], passed: airlineStillExists.status === 200, detail: airlineStillExists.status === 200 ? undefined : 'Airline hilang setelah delete in-use.' });

  await cleanup();
  const report = { project: 'Cakrawala', generatedAt: new Date().toISOString(), suffix, status: checks.every((check) => check.passed) ? 'PASSED' : 'FAILED', summary: { total: checks.length, passed: checks.filter((check) => check.passed).length, failed: checks.filter((check) => !check.passed).length }, checks };
  const outputDir = path.resolve('.qc-artifacts/cakrawala-local-transactions');
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, `${suffix}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'PASSED') process.exitCode = 1;
}

main().catch(async (error) => {
  await cleanup();
  console.error(error);
  process.exitCode = 1;
});
