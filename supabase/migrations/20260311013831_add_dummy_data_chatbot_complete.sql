/*
  # Add Dummy Data for Agent Chatbot Testing
  
  1. Purpose
    - Populate mrmazzone+1@gmail.com agent account with realistic test data
    - Enable comprehensive chatbot feature testing
  
  2. Data Created
    - 5 properties (3 active listings, 2 sold)
    - 7 transactions (4 closed with $48,000 revenue, 3 active with $58,500 pipeline)
    - 10 appointments
    - 8 prospects/leads
  
  3. Revenue Summary
    - Total earned commission: $48,000
    - Pipeline commission: $58,500
    - Closed deals: 4
    - Active deals: 3
*/

DO $$
DECLARE
  agent_id uuid := 'f030143c-d296-4c99-a137-b759fea56640';
  property1_id uuid;
  property2_id uuid;
  property3_id uuid;
  property4_id uuid;
  property5_id uuid;
BEGIN

  -- Create properties
  property1_id := gen_random_uuid();
  INSERT INTO properties (id, address_line1, city, state, zip_code, price, bedrooms, bathrooms, square_footage, status, agent_id, listed_by, listing_type, description, created_at)
  VALUES (property1_id, '456 Oak Avenue', 'Boston', 'MA', '02108', 525000, 4, 3, 2800, 'sold', agent_id, agent_id, 'sale', 'Beautiful Colonial Home', NOW() - INTERVAL '80 days');
    
  property2_id := gen_random_uuid();
  INSERT INTO properties (id, address_line1, city, state, zip_code, price, bedrooms, bathrooms, square_footage, status, agent_id, listed_by, listing_type, description, created_at)
  VALUES (property2_id, '789 Market Street', 'Boston', 'MA', '02109', 425000, 2, 2, 1400, 'sold', agent_id, agent_id, 'sale', 'Modern Downtown Condo', NOW() - INTERVAL '65 days');
    
  property3_id := gen_random_uuid();
  INSERT INTO properties (id, address_line1, city, state, zip_code, price, bedrooms, bathrooms, square_footage, status, agent_id, listed_by, listing_type, description, created_at)
  VALUES (property3_id, '123 Harbor Drive', 'Boston', 'MA', '02110', 1250000, 5, 4, 4200, 'active', agent_id, agent_id, 'sale', 'Luxury Waterfront Estate', NOW() - INTERVAL '30 days');
    
  property4_id := gen_random_uuid();
  INSERT INTO properties (id, address_line1, city, state, zip_code, price, bedrooms, bathrooms, square_footage, status, agent_id, listed_by, listing_type, description, created_at)
  VALUES (property4_id, '321 Elm Street', 'Cambridge', 'MA', '02138', 875000, 3, 2, 2200, 'active', agent_id, agent_id, 'sale', 'Charming Victorian', NOW() - INTERVAL '20 days');
    
  property5_id := gen_random_uuid();
  INSERT INTO properties (id, address_line1, city, state, zip_code, price, bedrooms, bathrooms, square_footage, status, agent_id, listed_by, listing_type, description, created_at)
  VALUES (property5_id, '555 Pine Street', 'Boston', 'MA', '02111', 650000, 2, 2, 1800, 'active', agent_id, agent_id, 'sale', 'Contemporary Loft', NOW() - INTERVAL '10 days');

  -- Create closed transactions
  INSERT INTO transactions (id, agent_id, property_id, transaction_type, deal_value, commission_percentage, commission_amount, stage, status, expected_close_date, actual_close_date, created_at)
  VALUES 
    (gen_random_uuid(), agent_id, property1_id, 'buyer_side', 525000, 3.0, 15750, 'closed', 'won', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '80 days'),
    (gen_random_uuid(), agent_id, property2_id, 'buyer_side', 425000, 2.5, 10625, 'closed', 'won', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '65 days'),
    (gen_random_uuid(), agent_id, property1_id, 'seller_side', 525000, 2.5, 13125, 'closed', 'won', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '80 days'),
    (gen_random_uuid(), agent_id, property2_id, 'seller_side', 425000, 2.0, 8500, 'closed', 'won', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '65 days');

  -- Create active pipeline transactions
  INSERT INTO transactions (id, agent_id, property_id, transaction_type, deal_value, commission_percentage, commission_amount, stage, status, expected_close_date, created_at)
  VALUES
    (gen_random_uuid(), agent_id, property3_id, 'buyer_side', 1250000, 2.5, 31250, 'under_contract', 'active', NOW() + INTERVAL '30 days', NOW() - INTERVAL '25 days'),
    (gen_random_uuid(), agent_id, property4_id, 'seller_side', 875000, 2.0, 17500, 'under_contract', 'active', NOW() + INTERVAL '45 days', NOW() - INTERVAL '15 days'),
    (gen_random_uuid(), agent_id, property5_id, 'seller_side', 650000, 1.5, 9750, 'showing_completed', 'active', NOW() + INTERVAL '60 days', NOW() - INTERVAL '5 days');

  -- Create prospects
  INSERT INTO prospects (id, agent_id, full_name, email, phone_number, message, status, source, created_at)
  VALUES
    (gen_random_uuid(), agent_id, 'Emily Johnson', 'emily.j@email.com', '555-0301', 'Looking for a 3-4 bedroom home', 'new', 'website', NOW() - INTERVAL '5 days'),
    (gen_random_uuid(), agent_id, 'David Lee', 'david.lee@email.com', '555-0302', 'Interested in selling property', 'contacted', 'referral', NOW() - INTERVAL '8 days'),
    (gen_random_uuid(), agent_id, 'Amanda Brown', 'amanda.b@email.com', '555-0303', 'Need help finding a condo', 'contacted', 'open_house', NOW() - INTERVAL '12 days'),
    (gen_random_uuid(), agent_id, 'Kevin Garcia', 'kevin.g@email.com', '555-0304', 'Relocating to Boston area', 'new', 'zillow', NOW() - INTERVAL '15 days'),
    (gen_random_uuid(), agent_id, 'Lisa White', 'lisa.w@email.com', '555-0305', 'Want to list my home', 'contacted', 'realtor_com', NOW() - INTERVAL '20 days'),
    (gen_random_uuid(), agent_id, 'Thomas Miller', 'thomas.m@email.com', '555-0306', 'First time homebuyer', 'new', 'facebook', NOW() - INTERVAL '3 days'),
    (gen_random_uuid(), agent_id, 'Rachel Anderson', 'rachel.a@email.com', '555-0307', 'Looking for investment property', 'contacted', 'referral', NOW() - INTERVAL '7 days'),
    (gen_random_uuid(), agent_id, 'Mark Taylor', 'mark.t@email.com', '555-0308', 'Downsizing from large home', 'new', 'website', NOW() - INTERVAL '25 days');

  -- Create appointments
  INSERT INTO calendar_events (id, user_id, event_type, title, start_time, end_time, status, created_at)
  VALUES
    (gen_random_uuid(), agent_id, 'viewing', 'Property Showing', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days' + INTERVAL '1 hour', 'completed', NOW() - INTERVAL '20 days'),
    (gen_random_uuid(), agent_id, 'viewing', 'Property Showing', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days' + INTERVAL '1 hour', 'completed', NOW() - INTERVAL '12 days'),
    (gen_random_uuid(), agent_id, 'meeting', 'Buyer Consultation', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days' + INTERVAL '1 hour', 'completed', NOW() - INTERVAL '10 days'),
    (gen_random_uuid(), agent_id, 'meeting', 'Listing Appointment', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '1 hour', 'completed', NOW() - INTERVAL '7 days'),
    (gen_random_uuid(), agent_id, 'viewing', 'Open House', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '2 hours', 'completed', NOW() - INTERVAL '5 days'),
    (gen_random_uuid(), agent_id, 'viewing', 'Property Showing', NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days' + INTERVAL '1 hour', 'confirmed', NOW() - INTERVAL '1 day'),
    (gen_random_uuid(), agent_id, 'closing', 'Closing Meeting', NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days' + INTERVAL '2 hours', 'confirmed', NOW() - INTERVAL '3 days'),
    (gen_random_uuid(), agent_id, 'viewing', 'Open House', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days' + INTERVAL '3 hours', 'confirmed', NOW()),
    (gen_random_uuid(), agent_id, 'meeting', 'Buyer Consultation', NOW() + INTERVAL '10 days', NOW() + INTERVAL '10 days' + INTERVAL '1 hour', 'confirmed', NOW() - INTERVAL '2 days'),
    (gen_random_uuid(), agent_id, 'viewing', 'Property Showing', NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days' + INTERVAL '1 hour', 'confirmed', NOW());

END $$;
