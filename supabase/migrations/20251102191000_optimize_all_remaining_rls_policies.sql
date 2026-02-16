/*
  # Optimize All Remaining RLS Policies

  ## Performance Optimization
  Wraps all remaining auth.uid() calls in SELECT subqueries to prevent re-evaluation for each row.
  This dramatically improves query performance at scale for 200+ policies.

  ## Security Impact
  - No change to security logic
  - Only performance optimization
  - Maintains exact same access control

  ## Reference
  https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
*/

-- Activity Feed
DROP POLICY IF EXISTS "Users can update own activities" ON activity_feed;
DROP POLICY IF EXISTS "Users can view own activities" ON activity_feed;

CREATE POLICY "Users can update own activities"
  ON activity_feed FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view own activities"
  ON activity_feed FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Admin Users
DROP POLICY IF EXISTS "Users can check their own admin status" ON admin_users;

CREATE POLICY "Users can check their own admin status"
  ON admin_users FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

-- Agent Profiles
DROP POLICY IF EXISTS "Agents can update own profile" ON agent_profiles;

CREATE POLICY "Agents can update own profile"
  ON agent_profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Agent Reviews
DROP POLICY IF EXISTS "Users can delete own reviews" ON agent_reviews;
DROP POLICY IF EXISTS "Users can update own reviews" ON agent_reviews;

CREATE POLICY "Users can delete own reviews"
  ON agent_reviews FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = reviewer_id);

CREATE POLICY "Users can update own reviews"
  ON agent_reviews FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = reviewer_id)
  WITH CHECK ((SELECT auth.uid()) = reviewer_id);

-- Buyer Journey Progress
DROP POLICY IF EXISTS "Buyers can update own journey progress" ON buyer_journey_progress;
DROP POLICY IF EXISTS "Buyers can view own journey progress" ON buyer_journey_progress;

CREATE POLICY "Buyers can update own journey progress"
  ON buyer_journey_progress FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = buyer_id)
  WITH CHECK ((SELECT auth.uid()) = buyer_id);

CREATE POLICY "Buyers can view own journey progress"
  ON buyer_journey_progress FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = buyer_id);

-- Buyer Preferences
DROP POLICY IF EXISTS "Buyers can update own preferences" ON buyer_preferences;
DROP POLICY IF EXISTS "Buyers can view own preferences" ON buyer_preferences;

CREATE POLICY "Buyers can update own preferences"
  ON buyer_preferences FOR UPDATE
  TO authenticated
  USING (buyer_id = (SELECT auth.uid()))
  WITH CHECK (buyer_id = (SELECT auth.uid()));

CREATE POLICY "Buyers can view own preferences"
  ON buyer_preferences FOR SELECT
  TO authenticated
  USING (buyer_id = (SELECT auth.uid()));

-- Calendar Event Shares
DROP POLICY IF EXISTS "Users can view own event shares" ON calendar_event_shares;

CREATE POLICY "Users can view own event shares"
  ON calendar_event_shares FOR SELECT
  TO authenticated
  USING (shared_with = (SELECT auth.uid()));

-- Calendar Events
DROP POLICY IF EXISTS "Agents can delete own calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Agents can update own calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Agents can view own calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Property owners can delete their calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Property owners can update their calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Property owners can view their calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Requesters can view own viewing requests" ON calendar_events;
DROP POLICY IF EXISTS "Requesters can view their viewing events" ON calendar_events;

CREATE POLICY "Agents can delete own calendar events"
  ON calendar_events FOR DELETE
  TO authenticated
  USING (agent_id = (SELECT auth.uid()));

CREATE POLICY "Agents can update own calendar events"
  ON calendar_events FOR UPDATE
  TO authenticated
  USING (agent_id = (SELECT auth.uid()))
  WITH CHECK (agent_id = (SELECT auth.uid()));

CREATE POLICY "Agents can view own calendar events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (agent_id = (SELECT auth.uid()));

CREATE POLICY "Property owners can delete their calendar events"
  ON calendar_events FOR DELETE
  TO authenticated
  USING (property_owner_id = (SELECT auth.uid()));

CREATE POLICY "Property owners can update their calendar events"
  ON calendar_events FOR UPDATE
  TO authenticated
  USING (property_owner_id = (SELECT auth.uid()))
  WITH CHECK (property_owner_id = (SELECT auth.uid()));

CREATE POLICY "Property owners can view their calendar events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING ((property_owner_id = (SELECT auth.uid())) OR (requester_id = (SELECT auth.uid())));

CREATE POLICY "Requesters can view own viewing requests"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (requester_id = (SELECT auth.uid()));

CREATE POLICY "Requesters can view their viewing events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING ((requester_id = (SELECT auth.uid())) AND (event_type = 'viewing'::text));

-- Conversation Participants
DROP POLICY IF EXISTS "Users can update own participant record" ON conversation_participants;

CREATE POLICY "Users can update own participant record"
  ON conversation_participants FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Document Folders
DROP POLICY IF EXISTS "Users can delete own folders" ON document_folders;
DROP POLICY IF EXISTS "Users can update own folders" ON document_folders;
DROP POLICY IF EXISTS "Users can view own folders" ON document_folders;

CREATE POLICY "Users can delete own folders"
  ON document_folders FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Users can update own folders"
  ON document_folders FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = owner_id)
  WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Users can view own folders"
  ON document_folders FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = owner_id);

-- Document Labels
DROP POLICY IF EXISTS "Users can delete own labels" ON document_labels;
DROP POLICY IF EXISTS "Users can update own labels" ON document_labels;
DROP POLICY IF EXISTS "Users can view own labels" ON document_labels;

CREATE POLICY "Users can delete own labels"
  ON document_labels FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Users can update own labels"
  ON document_labels FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = owner_id)
  WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Users can view own labels"
  ON document_labels FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = owner_id);

-- Document Shares
DROP POLICY IF EXISTS "Users can revoke shares" ON document_shares;
DROP POLICY IF EXISTS "Users can update own shares" ON document_shares;
DROP POLICY IF EXISTS "Users can view own document shares" ON document_shares;

CREATE POLICY "Users can revoke shares"
  ON document_shares FOR DELETE
  TO authenticated
  USING (shared_by = (SELECT auth.uid()));

CREATE POLICY "Users can update own shares"
  ON document_shares FOR UPDATE
  TO authenticated
  USING (shared_by = (SELECT auth.uid()))
  WITH CHECK (shared_by = (SELECT auth.uid()));

CREATE POLICY "Users can view own document shares"
  ON document_shares FOR SELECT
  TO authenticated
  USING (shared_by = (SELECT auth.uid()));

-- Document Signatures
DROP POLICY IF EXISTS "Senders can delete their signature requests" ON document_signatures;
DROP POLICY IF EXISTS "Senders can update their signature requests" ON document_signatures;
DROP POLICY IF EXISTS "Senders can view their signature requests" ON document_signatures;
DROP POLICY IF EXISTS "Signers can update their signature requests" ON document_signatures;
DROP POLICY IF EXISTS "Signers can view their signature requests" ON document_signatures;

CREATE POLICY "Senders can delete their signature requests"
  ON document_signatures FOR DELETE
  TO authenticated
  USING (sender_id = (SELECT auth.uid()));

CREATE POLICY "Senders can update their signature requests"
  ON document_signatures FOR UPDATE
  TO authenticated
  USING (sender_id = (SELECT auth.uid()))
  WITH CHECK (sender_id = (SELECT auth.uid()));

CREATE POLICY "Senders can view their signature requests"
  ON document_signatures FOR SELECT
  TO authenticated
  USING (sender_id = (SELECT auth.uid()));

CREATE POLICY "Signers can update their signature requests"
  ON document_signatures FOR UPDATE
  TO authenticated
  USING (signer_id = (SELECT auth.uid()))
  WITH CHECK (signer_id = (SELECT auth.uid()));

CREATE POLICY "Signers can view their signature requests"
  ON document_signatures FOR SELECT
  TO authenticated
  USING (signer_id = (SELECT auth.uid()));

-- Documents
DROP POLICY IF EXISTS "Users can delete own documents" ON documents;
DROP POLICY IF EXISTS "Users can update own documents" ON documents;
DROP POLICY IF EXISTS "Users can view own documents" ON documents;

CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "Users can view own documents"
  ON documents FOR SELECT
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));

-- DocuSign Documents
DROP POLICY IF EXISTS "Property owners can delete their docusign documents" ON docusign_documents;
DROP POLICY IF EXISTS "Property owners can update their docusign documents" ON docusign_documents;
DROP POLICY IF EXISTS "Property owners can view their docusign documents" ON docusign_documents;

CREATE POLICY "Property owners can delete their docusign documents"
  ON docusign_documents FOR DELETE
  TO authenticated
  USING (property_owner_id = (SELECT auth.uid()));

CREATE POLICY "Property owners can update their docusign documents"
  ON docusign_documents FOR UPDATE
  TO authenticated
  USING (property_owner_id = (SELECT auth.uid()))
  WITH CHECK (property_owner_id = (SELECT auth.uid()));

CREATE POLICY "Property owners can view their docusign documents"
  ON docusign_documents FOR SELECT
  TO authenticated
  USING (property_owner_id = (SELECT auth.uid()));

-- Favorites
DROP POLICY IF EXISTS "Users can remove own favorites" ON favorites;
DROP POLICY IF EXISTS "Users can view own favorites" ON favorites;

CREATE POLICY "Users can remove own favorites"
  ON favorites FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view own favorites"
  ON favorites FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Invitations
DROP POLICY IF EXISTS "Users can view own invitations" ON invitations;

CREATE POLICY "Users can view own invitations"
  ON invitations FOR SELECT
  TO authenticated
  USING (sender_id = (SELECT auth.uid()));

-- Invoice Items
DROP POLICY IF EXISTS "Service providers can delete own invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Service providers can update own invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Service providers can view own invoice items" ON invoice_items;

CREATE POLICY "Service providers can delete own invoice items"
  ON invoice_items FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.provider_id = (SELECT auth.uid())));

CREATE POLICY "Service providers can update own invoice items"
  ON invoice_items FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.provider_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.provider_id = (SELECT auth.uid())));

CREATE POLICY "Service providers can view own invoice items"
  ON invoice_items FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.provider_id = (SELECT auth.uid())));

-- Invoices
DROP POLICY IF EXISTS "Service providers can delete own invoices" ON invoices;
DROP POLICY IF EXISTS "Service providers can update own invoices" ON invoices;
DROP POLICY IF EXISTS "Service providers can view own invoices" ON invoices;

CREATE POLICY "Service providers can delete own invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (provider_id = (SELECT auth.uid()));

CREATE POLICY "Service providers can update own invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (provider_id = (SELECT auth.uid()))
  WITH CHECK (provider_id = (SELECT auth.uid()));

CREATE POLICY "Service providers can view own invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (provider_id = (SELECT auth.uid()));

-- Mortgage Lender Profiles
DROP POLICY IF EXISTS "Mortgage lenders can delete own profile" ON mortgage_lender_profiles;
DROP POLICY IF EXISTS "Mortgage lenders can update own profile" ON mortgage_lender_profiles;

CREATE POLICY "Mortgage lenders can delete own profile"
  ON mortgage_lender_profiles FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Mortgage lenders can update own profile"
  ON mortgage_lender_profiles FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Phone Verification Codes
DROP POLICY IF EXISTS "Users can update own verification codes" ON phone_verification_codes;
DROP POLICY IF EXISTS "Users can view own verification codes" ON phone_verification_codes;

CREATE POLICY "Users can update own verification codes"
  ON phone_verification_codes FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view own verification codes"
  ON phone_verification_codes FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Profiles
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- Property Favorites
DROP POLICY IF EXISTS "Users can delete their own favorites" ON property_favorites;
DROP POLICY IF EXISTS "Users can view their own favorites" ON property_favorites;

CREATE POLICY "Users can delete their own favorites"
  ON property_favorites FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view their own favorites"
  ON property_favorites FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Property Owner Leads
DROP POLICY IF EXISTS "Property owners can delete own leads" ON property_owner_leads;
DROP POLICY IF EXISTS "Property owners can update own leads" ON property_owner_leads;
DROP POLICY IF EXISTS "Property owners can view own leads" ON property_owner_leads;

CREATE POLICY "Property owners can delete own leads"
  ON property_owner_leads FOR DELETE
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));

CREATE POLICY "Property owners can update own leads"
  ON property_owner_leads FOR UPDATE
  TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "Property owners can view own leads"
  ON property_owner_leads FOR SELECT
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));

-- Property Owner Profiles
DROP POLICY IF EXISTS "Property owners can update own profile" ON property_owner_profiles;
DROP POLICY IF EXISTS "Property owners can view own profile" ON property_owner_profiles;

CREATE POLICY "Property owners can update own profile"
  ON property_owner_profiles FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Property owners can view own profile"
  ON property_owner_profiles FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Property Rejections
DROP POLICY IF EXISTS "Users can delete their own rejections" ON property_rejections;
DROP POLICY IF EXISTS "Users can view their own rejections" ON property_rejections;

CREATE POLICY "Users can delete their own rejections"
  ON property_rejections FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view their own rejections"
  ON property_rejections FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Property Views
DROP POLICY IF EXISTS "Users can update their own views" ON property_views;
DROP POLICY IF EXISTS "Users can view their own views" ON property_views;

CREATE POLICY "Users can update their own views"
  ON property_views FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view their own views"
  ON property_views FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Prospect Reminders
DROP POLICY IF EXISTS "Agents can delete own prospect reminders" ON prospect_reminders;
DROP POLICY IF EXISTS "Agents can update own prospect reminders" ON prospect_reminders;
DROP POLICY IF EXISTS "Agents can view own prospect reminders" ON prospect_reminders;

CREATE POLICY "Agents can delete own prospect reminders"
  ON prospect_reminders FOR DELETE
  TO authenticated
  USING (agent_id = (SELECT auth.uid()));

CREATE POLICY "Agents can update own prospect reminders"
  ON prospect_reminders FOR UPDATE
  TO authenticated
  USING (agent_id = (SELECT auth.uid()))
  WITH CHECK (agent_id = (SELECT auth.uid()));

CREATE POLICY "Agents can view own prospect reminders"
  ON prospect_reminders FOR SELECT
  TO authenticated
  USING (agent_id = (SELECT auth.uid()));

-- Prospects
DROP POLICY IF EXISTS "Agents can delete their own prospects" ON prospects;
DROP POLICY IF EXISTS "Agents can update their own prospects" ON prospects;
DROP POLICY IF EXISTS "Agents can view their own prospects" ON prospects;

CREATE POLICY "Agents can delete their own prospects"
  ON prospects FOR DELETE
  TO authenticated
  USING (agent_id = (SELECT auth.uid()));

CREATE POLICY "Agents can update their own prospects"
  ON prospects FOR UPDATE
  TO authenticated
  USING (agent_id = (SELECT auth.uid()))
  WITH CHECK (agent_id = (SELECT auth.uid()));

CREATE POLICY "Agents can view their own prospects"
  ON prospects FOR SELECT
  TO authenticated
  USING (agent_id = (SELECT auth.uid()));

-- Rental Applications
DROP POLICY IF EXISTS "Renters can update own applications" ON rental_applications;
DROP POLICY IF EXISTS "Renters can view own applications" ON rental_applications;

CREATE POLICY "Renters can update own applications"
  ON rental_applications FOR UPDATE
  TO authenticated
  USING (renter_id = (SELECT auth.uid()))
  WITH CHECK (renter_id = (SELECT auth.uid()));

CREATE POLICY "Renters can view own applications"
  ON rental_applications FOR SELECT
  TO authenticated
  USING (renter_id = (SELECT auth.uid()));

-- Renter Journey Progress
DROP POLICY IF EXISTS "Renters can update own journey progress" ON renter_journey_progress;
DROP POLICY IF EXISTS "Renters can view own journey progress" ON renter_journey_progress;

CREATE POLICY "Renters can update own journey progress"
  ON renter_journey_progress FOR UPDATE
  TO authenticated
  USING (renter_id = (SELECT auth.uid()))
  WITH CHECK (renter_id = (SELECT auth.uid()));

CREATE POLICY "Renters can view own journey progress"
  ON renter_journey_progress FOR SELECT
  TO authenticated
  USING (renter_id = (SELECT auth.uid()));

-- Seller Journey Progress
DROP POLICY IF EXISTS "Sellers can update own journey progress" ON seller_journey_progress;
DROP POLICY IF EXISTS "Sellers can view own journey progress" ON seller_journey_progress;

CREATE POLICY "Sellers can update own journey progress"
  ON seller_journey_progress FOR UPDATE
  TO authenticated
  USING (seller_id = (SELECT auth.uid()))
  WITH CHECK (seller_id = (SELECT auth.uid()));

CREATE POLICY "Sellers can view own journey progress"
  ON seller_journey_progress FOR SELECT
  TO authenticated
  USING (seller_id = (SELECT auth.uid()));

-- Service Provider Appointments
DROP POLICY IF EXISTS "Service providers can delete own appointments" ON service_provider_appointments;
DROP POLICY IF EXISTS "Service providers can update own appointments" ON service_provider_appointments;
DROP POLICY IF EXISTS "Service providers can view own appointments" ON service_provider_appointments;

CREATE POLICY "Service providers can delete own appointments"
  ON service_provider_appointments FOR DELETE
  TO authenticated
  USING (provider_id = (SELECT auth.uid()));

CREATE POLICY "Service providers can update own appointments"
  ON service_provider_appointments FOR UPDATE
  TO authenticated
  USING (provider_id = (SELECT auth.uid()))
  WITH CHECK (provider_id = (SELECT auth.uid()));

CREATE POLICY "Service providers can view own appointments"
  ON service_provider_appointments FOR SELECT
  TO authenticated
  USING (provider_id = (SELECT auth.uid()));

-- Service Provider Leads
DROP POLICY IF EXISTS "Service providers can delete own leads" ON service_provider_leads;
DROP POLICY IF EXISTS "Service providers can update own leads" ON service_provider_leads;
DROP POLICY IF EXISTS "Service providers can view own leads" ON service_provider_leads;

CREATE POLICY "Service providers can delete own leads"
  ON service_provider_leads FOR DELETE
  TO authenticated
  USING (provider_id = (SELECT auth.uid()));

CREATE POLICY "Service providers can update own leads"
  ON service_provider_leads FOR UPDATE
  TO authenticated
  USING (provider_id = (SELECT auth.uid()))
  WITH CHECK (provider_id = (SELECT auth.uid()));

CREATE POLICY "Service providers can view own leads"
  ON service_provider_leads FOR SELECT
  TO authenticated
  USING (provider_id = (SELECT auth.uid()));

-- Service Provider Photos
DROP POLICY IF EXISTS "Service providers can delete own photos" ON service_provider_photos;
DROP POLICY IF EXISTS "Service providers can update own photos" ON service_provider_photos;
DROP POLICY IF EXISTS "Service providers can view own photos" ON service_provider_photos;

CREATE POLICY "Service providers can delete own photos"
  ON service_provider_photos FOR DELETE
  TO authenticated
  USING (provider_id = (SELECT auth.uid()));

CREATE POLICY "Service providers can update own photos"
  ON service_provider_photos FOR UPDATE
  TO authenticated
  USING (provider_id = (SELECT auth.uid()))
  WITH CHECK (provider_id = (SELECT auth.uid()));

CREATE POLICY "Service providers can view own photos"
  ON service_provider_photos FOR SELECT
  TO authenticated
  USING (provider_id = (SELECT auth.uid()));

-- Service Provider Profiles
DROP POLICY IF EXISTS "Service providers can update own profile" ON service_provider_profiles;
DROP POLICY IF EXISTS "Service providers can view own profile" ON service_provider_profiles;

CREATE POLICY "Service providers can update own profile"
  ON service_provider_profiles FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Service providers can view own profile"
  ON service_provider_profiles FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Service Provider Reviews
DROP POLICY IF EXISTS "Reviewers can update own reviews" ON service_provider_reviews;

CREATE POLICY "Reviewers can update own reviews"
  ON service_provider_reviews FOR UPDATE
  TO authenticated
  USING (reviewer_id = (SELECT auth.uid()))
  WITH CHECK (reviewer_id = (SELECT auth.uid()));

-- SMS Logs
DROP POLICY IF EXISTS "Users can view own SMS logs" ON sms_logs;

CREATE POLICY "Users can view own SMS logs"
  ON sms_logs FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- SMS Notification Preferences
DROP POLICY IF EXISTS "Users can update own SMS preferences" ON sms_notification_preferences;
DROP POLICY IF EXISTS "Users can view own SMS preferences" ON sms_notification_preferences;

CREATE POLICY "Users can update own SMS preferences"
  ON sms_notification_preferences FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view own SMS preferences"
  ON sms_notification_preferences FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Transactions
DROP POLICY IF EXISTS "Agents can delete own transactions" ON transactions;
DROP POLICY IF EXISTS "Agents can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Agents can view own transactions" ON transactions;

CREATE POLICY "Agents can delete own transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (agent_id = (SELECT auth.uid()));

CREATE POLICY "Agents can update own transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (agent_id = (SELECT auth.uid()))
  WITH CHECK (agent_id = (SELECT auth.uid()));

CREATE POLICY "Agents can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (agent_id = (SELECT auth.uid()));
