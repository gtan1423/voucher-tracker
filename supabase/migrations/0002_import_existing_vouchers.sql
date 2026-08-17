-- One-time import of the 31 vouchers already in your local Excel file, generated
-- from a read-only pass over "Voucher & Benefits Tracker.xlsx" (the file itself
-- was not touched). Run this ONCE, after 0001_vouchers.sql and after you've logged
-- into the new app at least once (so your auth.users row exists in this project).
--
-- Before running: replace YOUR_LOGIN_EMAIL with the email you use to log into your
-- finance tracker (same Supabase project, same account).

with me as (
  select id as user_id from auth.users where email = 'gt001@outlook.sg'
)
insert into public.vouchers (user_id, name, value, value_note, start_date, expiry_date, type, interest, status_input)
select me.user_id, v.name, v.value, v.value_note, v.start_date, v.expiry_date, v.type, v.interest, v.status_input
from me, (values
  ('Golden Village Gold Class 1 for 1 tickets', null, null, '2026-05-01'::date, '2026-07-31'::date, 'Lifestyle', 'Medium', ''),
  ('Capital Land', 5, null, '2026-01-01'::date, '2026-12-21'::date, 'Shopping', 'High', 'Redeemed'),
  ('CDC Vouchers', 463, null, '2026-01-01'::date, '2026-12-31'::date, 'Shopping', 'High', ''),
  ('Tangs Credit', 15, null, '2026-01-01'::date, '2026-12-31'::date, 'Shopping', 'Medium', ''),
  ('Amex Airline Credit (Jan–Jun) min 300', 100, null, '2026-01-01'::date, '2026-06-30'::date, 'Travel', 'High', 'Redeemed'),
  ('Amex Airline Credit (Jul–Dec) min 300', 100, null, '2026-07-01'::date, '2026-12-31'::date, 'Travel', 'High', ''),
  ('Amex Wine Credit (Jul–Dec)', 200, null, '2026-07-01'::date, '2026-12-31'::date, 'Lifestyle', 'High', ''),
  ('Amex Global Dining Credit', 200, null, '2026-01-01'::date, '2026-12-31'::date, 'Travel', 'High', ''),
  ('Amex Table for Two (Jan - Feb)', 0, null, '2026-01-01'::date, '2026-02-28'::date, 'Dining', 'High', 'Redeemed'),
  ('Amex Table for Two (Mar - Apr)', 0, null, '2026-03-01'::date, '2026-04-30'::date, 'Dining', 'High', 'Redeemed'),
  ('Amex Table for Two (May–Jun)', 0, null, '2026-05-01'::date, '2026-06-30'::date, 'Dining', 'High', 'Redeemed'),
  ('Amex Table for Two (Jul–Aug)', 0, null, '2026-07-01'::date, '2026-08-31'::date, 'Dining', 'High', 'Redeemed'),
  ('Amex Table for Two (Sep–Oct)', 0, null, '2026-09-01'::date, '2026-10-31'::date, 'Dining', 'High', 'Booked'),
  ('Amex Table for Two (Nov–Dec)', 0, null, null::date, '2026-12-31'::date, 'Dining', 'High', ''),
  ('Amex Complimentary Hotel Night', 0, null, '2026-01-01'::date, '2026-12-31'::date, 'Travel', 'High', 'Redeemed'),
  ('Crossroads buffet (min spend 100)', 50, null, '2026-01-01'::date, '2026-12-31'::date, 'Dining', 'Low', ''),
  ('Wan Hao - 30% off', 0, null, '2026-01-01'::date, '2026-12-31'::date, 'Dining', 'Low', ''),
  ('Clove 50% off min 4 pax', 0, null, '2026-01-01'::date, '2026-12-31'::date, 'Dining', 'Low', ''),
  ('Jag restaurant', 100, null, '2026-01-01'::date, '2026-12-31'::date, 'Dining', 'Medium', ''),
  ('Amex Complimentary Hotel Night', 0, null, '2026-01-01'::date, '2026-12-31'::date, 'Travel', 'High', 'Redeemed'),
  ('Crossroads buffet (min spend 100)', 50, null, '2026-01-01'::date, '2026-12-31'::date, 'Dining', 'Low', ''),
  ('Wan Hao - 30% off', 0, null, '2026-01-01'::date, '2026-12-31'::date, 'Dining', 'Low', ''),
  ('Clove 50% off min 4 pax', 0, null, '2026-01-01'::date, '2026-12-31'::date, 'Dining', 'Low', ''),
  ('Jag restaurant', 100, null, '2026-01-01'::date, '2026-12-31'::date, 'Dining', 'Medium', ''),
  ('Bottle of wine from Stamford or Fairmont', 0, null, '2026-01-01'::date, '2026-12-31'::date, 'Dining', 'High', 'Redeemed'),
  ('Bottle of wine from Stamford or Fairmont', 0, null, '2026-01-01'::date, '2026-12-31'::date, 'Dining', 'High', 'Redeemed'),
  ('Bottle of wine from Stamford or Fairmont', 0, null, '2026-01-01'::date, '2026-12-31'::date, 'Dining', 'Medium', ''),
  ('Bottle of wine from Stamford or Fairmont', 0, null, '2026-01-01'::date, '2026-12-31'::date, 'Dining', 'Medium', ''),
  ('Amex Tower Club ', 50, null, '2026-01-01'::date, '2026-12-31'::date, 'Dining', 'Medium', ''),
  ('Amex Tower Club ', 50, null, '2026-01-01'::date, '2026-12-31'::date, 'Dining', 'Medium', ''),
  ('BFF climb 10x multi pass', null, '8 left', '2026-04-11'::date, '2027-07-30'::date, 'Climbing', 'High', '')
) as v(name, value, value_note, start_date, expiry_date, type, interest, status_input);
