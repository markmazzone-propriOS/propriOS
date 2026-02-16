/*
  # Add Dummy Rent Payment Data for Jackie Parsons (Property Owner)

  1. Purpose
    - Add realistic rent payment data for 2025 for the Financial Reports page
    - Create payment history for three active rental agreements

  2. Data Added
    - Rent payments for Mark Mazzone at 1428 Elm Street ($2,600/month)
    - Rent payments for Helen Girardot at 305 Cherry Lane ($1,950/month)
    - Rent payments for Daniel Clark at 892 Willow Drive ($3,400/month)
    - Mix of paid (on-time and late) and pending payments to show realistic scenarios

  3. Payment Status Distribution
    - January-October: Mix of paid on-time, paid late, and currently pending
    - November-December: Pending payments for future months
*/

-- Insert rent payments for Mark Mazzone at 1428 Elm Street ($2,600/month)
INSERT INTO rent_payments (id, rental_agreement_id, amount, due_date, paid_date, status, payment_method, created_at, updated_at)
VALUES
  -- January 2025 - Paid on time
  (gen_random_uuid(), '07257e33-c544-4f5d-b822-e35690e13480', 2600.00, '2025-01-01', '2024-12-30', 'paid', 'bank_transfer', '2025-01-01 00:00:00+00', '2025-01-01 00:00:00+00'),
  -- February 2025 - Paid late
  (gen_random_uuid(), '07257e33-c544-4f5d-b822-e35690e13480', 2600.00, '2025-02-01', '2025-02-08', 'paid', 'bank_transfer', '2025-02-01 00:00:00+00', '2025-02-08 00:00:00+00'),
  -- March 2025 - Paid on time
  (gen_random_uuid(), '07257e33-c544-4f5d-b822-e35690e13480', 2600.00, '2025-03-01', '2025-02-28', 'paid', 'bank_transfer', '2025-03-01 00:00:00+00', '2025-03-01 00:00:00+00'),
  -- April 2025 - Paid on time
  (gen_random_uuid(), '07257e33-c544-4f5d-b822-e35690e13480', 2600.00, '2025-04-01', '2025-03-30', 'paid', 'bank_transfer', '2025-04-01 00:00:00+00', '2025-04-01 00:00:00+00'),
  -- May 2025 - Paid late
  (gen_random_uuid(), '07257e33-c544-4f5d-b822-e35690e13480', 2600.00, '2025-05-01', '2025-05-10', 'paid', 'bank_transfer', '2025-05-01 00:00:00+00', '2025-05-10 00:00:00+00'),
  -- June 2025 - Paid on time
  (gen_random_uuid(), '07257e33-c544-4f5d-b822-e35690e13480', 2600.00, '2025-06-01', '2025-05-29', 'paid', 'bank_transfer', '2025-06-01 00:00:00+00', '2025-06-01 00:00:00+00'),
  -- July 2025 - Paid on time
  (gen_random_uuid(), '07257e33-c544-4f5d-b822-e35690e13480', 2600.00, '2025-07-01', '2025-06-28', 'paid', 'bank_transfer', '2025-07-01 00:00:00+00', '2025-07-01 00:00:00+00'),
  -- August 2025 - Paid on time
  (gen_random_uuid(), '07257e33-c544-4f5d-b822-e35690e13480', 2600.00, '2025-08-01', '2025-07-30', 'paid', 'bank_transfer', '2025-08-01 00:00:00+00', '2025-08-01 00:00:00+00'),
  -- September 2025 - Paid on time
  (gen_random_uuid(), '07257e33-c544-4f5d-b822-e35690e13480', 2600.00, '2025-09-01', '2025-08-29', 'paid', 'bank_transfer', '2025-09-01 00:00:00+00', '2025-09-01 00:00:00+00'),
  -- October 2025 - Paid on time
  (gen_random_uuid(), '07257e33-c544-4f5d-b822-e35690e13480', 2600.00, '2025-10-01', '2025-09-28', 'paid', 'bank_transfer', '2025-10-01 00:00:00+00', '2025-10-01 00:00:00+00'),
  -- November 2025 - Pending
  (gen_random_uuid(), '07257e33-c544-4f5d-b822-e35690e13480', 2600.00, '2025-11-01', NULL, 'pending', NULL, '2025-11-01 00:00:00+00', '2025-11-01 00:00:00+00'),
  -- December 2025 - Pending
  (gen_random_uuid(), '07257e33-c544-4f5d-b822-e35690e13480', 2600.00, '2025-12-01', NULL, 'pending', NULL, '2025-12-01 00:00:00+00', '2025-12-01 00:00:00+00');

-- Insert rent payments for Helen Girardot at 305 Cherry Lane ($1,950/month)
INSERT INTO rent_payments (id, rental_agreement_id, amount, due_date, paid_date, status, payment_method, created_at, updated_at)
VALUES
  -- January 2025 - Paid on time
  (gen_random_uuid(), '55659dd9-8799-4e9e-a256-a205fb292170', 1950.00, '2025-01-01', '2024-12-29', 'paid', 'bank_transfer', '2025-01-01 00:00:00+00', '2025-01-01 00:00:00+00'),
  -- February 2025 - Paid on time
  (gen_random_uuid(), '55659dd9-8799-4e9e-a256-a205fb292170', 1950.00, '2025-02-01', '2025-01-30', 'paid', 'bank_transfer', '2025-02-01 00:00:00+00', '2025-02-01 00:00:00+00'),
  -- March 2025 - Paid late
  (gen_random_uuid(), '55659dd9-8799-4e9e-a256-a205fb292170', 1950.00, '2025-03-01', '2025-03-07', 'paid', 'bank_transfer', '2025-03-01 00:00:00+00', '2025-03-07 00:00:00+00'),
  -- April 2025 - Paid on time
  (gen_random_uuid(), '55659dd9-8799-4e9e-a256-a205fb292170', 1950.00, '2025-04-01', '2025-03-29', 'paid', 'bank_transfer', '2025-04-01 00:00:00+00', '2025-04-01 00:00:00+00'),
  -- May 2025 - Paid on time
  (gen_random_uuid(), '55659dd9-8799-4e9e-a256-a205fb292170', 1950.00, '2025-05-01', '2025-04-28', 'paid', 'bank_transfer', '2025-05-01 00:00:00+00', '2025-05-01 00:00:00+00'),
  -- June 2025 - Paid on time
  (gen_random_uuid(), '55659dd9-8799-4e9e-a256-a205fb292170', 1950.00, '2025-06-01', '2025-05-30', 'paid', 'bank_transfer', '2025-06-01 00:00:00+00', '2025-06-01 00:00:00+00'),
  -- July 2025 - Paid late
  (gen_random_uuid(), '55659dd9-8799-4e9e-a256-a205fb292170', 1950.00, '2025-07-01', '2025-07-12', 'paid', 'bank_transfer', '2025-07-01 00:00:00+00', '2025-07-12 00:00:00+00'),
  -- August 2025 - Paid on time
  (gen_random_uuid(), '55659dd9-8799-4e9e-a256-a205fb292170', 1950.00, '2025-08-01', '2025-07-30', 'paid', 'bank_transfer', '2025-08-01 00:00:00+00', '2025-08-01 00:00:00+00'),
  -- September 2025 - Paid on time
  (gen_random_uuid(), '55659dd9-8799-4e9e-a256-a205fb292170', 1950.00, '2025-09-01', '2025-08-30', 'paid', 'bank_transfer', '2025-09-01 00:00:00+00', '2025-09-01 00:00:00+00'),
  -- October 2025 - Paid on time
  (gen_random_uuid(), '55659dd9-8799-4e9e-a256-a205fb292170', 1950.00, '2025-10-01', '2025-09-29', 'paid', 'bank_transfer', '2025-10-01 00:00:00+00', '2025-10-01 00:00:00+00'),
  -- November 2025 - Pending
  (gen_random_uuid(), '55659dd9-8799-4e9e-a256-a205fb292170', 1950.00, '2025-11-01', NULL, 'pending', NULL, '2025-11-01 00:00:00+00', '2025-11-01 00:00:00+00'),
  -- December 2025 - Pending
  (gen_random_uuid(), '55659dd9-8799-4e9e-a256-a205fb292170', 1950.00, '2025-12-01', NULL, 'pending', NULL, '2025-12-01 00:00:00+00', '2025-12-01 00:00:00+00');

-- Insert rent payments for Daniel Clark at 892 Willow Drive ($3,400/month)
INSERT INTO rent_payments (id, rental_agreement_id, amount, due_date, paid_date, status, payment_method, created_at, updated_at)
VALUES
  -- January 2025 - Paid on time
  (gen_random_uuid(), 'e983128d-62d9-4129-bd6f-771730c22fbb', 3400.00, '2025-01-01', '2024-12-31', 'paid', 'bank_transfer', '2025-01-01 00:00:00+00', '2025-01-01 00:00:00+00'),
  -- February 2025 - Paid on time
  (gen_random_uuid(), 'e983128d-62d9-4129-bd6f-771730c22fbb', 3400.00, '2025-02-01', '2025-01-31', 'paid', 'bank_transfer', '2025-02-01 00:00:00+00', '2025-02-01 00:00:00+00'),
  -- March 2025 - Paid on time
  (gen_random_uuid(), 'e983128d-62d9-4129-bd6f-771730c22fbb', 3400.00, '2025-03-01', '2025-02-27', 'paid', 'bank_transfer', '2025-03-01 00:00:00+00', '2025-03-01 00:00:00+00'),
  -- April 2025 - Paid late
  (gen_random_uuid(), 'e983128d-62d9-4129-bd6f-771730c22fbb', 3400.00, '2025-04-01', '2025-04-09', 'paid', 'bank_transfer', '2025-04-01 00:00:00+00', '2025-04-09 00:00:00+00'),
  -- May 2025 - Paid on time
  (gen_random_uuid(), 'e983128d-62d9-4129-bd6f-771730c22fbb', 3400.00, '2025-05-01', '2025-04-29', 'paid', 'bank_transfer', '2025-05-01 00:00:00+00', '2025-05-01 00:00:00+00'),
  -- June 2025 - Paid late
  (gen_random_uuid(), 'e983128d-62d9-4129-bd6f-771730c22fbb', 3400.00, '2025-06-01', '2025-06-11', 'paid', 'bank_transfer', '2025-06-01 00:00:00+00', '2025-06-11 00:00:00+00'),
  -- July 2025 - Paid on time
  (gen_random_uuid(), 'e983128d-62d9-4129-bd6f-771730c22fbb', 3400.00, '2025-07-01', '2025-06-30', 'paid', 'bank_transfer', '2025-07-01 00:00:00+00', '2025-07-01 00:00:00+00'),
  -- August 2025 - Paid on time
  (gen_random_uuid(), 'e983128d-62d9-4129-bd6f-771730c22fbb', 3400.00, '2025-08-01', '2025-07-31', 'paid', 'bank_transfer', '2025-08-01 00:00:00+00', '2025-08-01 00:00:00+00'),
  -- September 2025 - Paid on time
  (gen_random_uuid(), 'e983128d-62d9-4129-bd6f-771730c22fbb', 3400.00, '2025-09-01', '2025-08-31', 'paid', 'bank_transfer', '2025-09-01 00:00:00+00', '2025-09-01 00:00:00+00'),
  -- October 2025 - Paid late
  (gen_random_uuid(), 'e983128d-62d9-4129-bd6f-771730c22fbb', 3400.00, '2025-10-01', '2025-10-15', 'paid', 'bank_transfer', '2025-10-01 00:00:00+00', '2025-10-15 00:00:00+00'),
  -- November 2025 - Pending
  (gen_random_uuid(), 'e983128d-62d9-4129-bd6f-771730c22fbb', 3400.00, '2025-11-01', NULL, 'pending', NULL, '2025-11-01 00:00:00+00', '2025-11-01 00:00:00+00'),
  -- December 2025 - Pending
  (gen_random_uuid(), 'e983128d-62d9-4129-bd6f-771730c22fbb', 3400.00, '2025-12-01', NULL, 'pending', NULL, '2025-12-01 00:00:00+00', '2025-12-01 00:00:00+00');
