/*
  # Add Missing Foreign Key Indexes
  
  This migration adds indexes for all foreign keys that are missing covering indexes.
  This significantly improves query performance when joining tables or filtering by foreign keys.
  
  ## Performance Impact
  - Improves JOIN performance across all related tables
  - Speeds up foreign key constraint checks
  - Reduces query execution time for filtered queries
  
  ## Tables Updated
  - activity_feed, admin_users, application_assignments, application_documents
  - application_notes, calendar_event_shares, calendar_events, compliance_checklists
  - conversations, documents, docusign_documents, invitations, lead_activities
  - lender_consultations, lender_leads, lender_team_members, loan_applications
  - loan_documents, pre_approval_letters, property_price_history, property_search_discoveries
  - property_shares, prospects, referral_tracking, rental_applications
  - service_jobs, service_provider_leads, service_provider_photos, service_provider_reviews
  - service_provider_services, support_ticket_responses, team_invitations, team_members
*/

-- Activity Feed
CREATE INDEX IF NOT EXISTS idx_activity_feed_actor_id ON activity_feed(actor_id);

-- Admin Users
CREATE INDEX IF NOT EXISTS idx_admin_users_role_id ON admin_users(role_id);

-- Application Assignments
CREATE INDEX IF NOT EXISTS idx_application_assignments_application_id ON application_assignments(application_id);
CREATE INDEX IF NOT EXISTS idx_application_assignments_assigned_by ON application_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_application_assignments_assigned_to ON application_assignments(assigned_to);

-- Application Documents
CREATE INDEX IF NOT EXISTS idx_application_documents_application_id ON application_documents(application_id);

-- Application Notes
CREATE INDEX IF NOT EXISTS idx_application_notes_application_id ON application_notes(application_id);
CREATE INDEX IF NOT EXISTS idx_application_notes_lender_user_id ON application_notes(lender_user_id);

-- Calendar Event Shares
CREATE INDEX IF NOT EXISTS idx_calendar_event_shares_shared_by ON calendar_event_shares(shared_by);

-- Calendar Events
CREATE INDEX IF NOT EXISTS idx_calendar_events_property_owner_id ON calendar_events(property_owner_id);

-- Compliance Checklists
CREATE INDEX IF NOT EXISTS idx_compliance_checklists_application_id ON compliance_checklists(application_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checklists_completed_by ON compliance_checklists(completed_by);

-- Conversations
CREATE INDEX IF NOT EXISTS idx_conversations_property_id ON conversations(property_id);

-- Documents
CREATE INDEX IF NOT EXISTS idx_documents_service_provider_id ON documents(service_provider_id);
CREATE INDEX IF NOT EXISTS idx_documents_signed_by ON documents(signed_by);

-- Docusign Documents
CREATE INDEX IF NOT EXISTS idx_docusign_documents_document_id ON docusign_documents(document_id);

-- Invitations
CREATE INDEX IF NOT EXISTS idx_invitations_accepted_by ON invitations(accepted_by);
CREATE INDEX IF NOT EXISTS idx_invitations_property_owner_id ON invitations(property_owner_id);
CREATE INDEX IF NOT EXISTS idx_invitations_service_provider_id ON invitations(service_provider_id);

-- Lead Activities
CREATE INDEX IF NOT EXISTS idx_lead_activities_created_by ON lead_activities(created_by);

-- Lender Consultations
CREATE INDEX IF NOT EXISTS idx_lender_consultations_buyer_id ON lender_consultations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_lender_consultations_lender_id ON lender_consultations(lender_id);

-- Lender Leads
CREATE INDEX IF NOT EXISTS idx_lender_leads_lender_id ON lender_leads(lender_id);

-- Lender Team Members
CREATE INDEX IF NOT EXISTS idx_lender_team_members_user_id ON lender_team_members(user_id);

-- Loan Applications
CREATE INDEX IF NOT EXISTS idx_loan_applications_property_id ON loan_applications(property_id);

-- Loan Documents
CREATE INDEX IF NOT EXISTS idx_loan_documents_uploaded_by ON loan_documents(uploaded_by);

-- Pre Approval Letters
CREATE INDEX IF NOT EXISTS idx_pre_approval_letters_buyer_id ON pre_approval_letters(buyer_id);
CREATE INDEX IF NOT EXISTS idx_pre_approval_letters_lender_id ON pre_approval_letters(lender_id);
CREATE INDEX IF NOT EXISTS idx_pre_approval_letters_pre_approval_request_id ON pre_approval_letters(pre_approval_request_id);

-- Property Price History
CREATE INDEX IF NOT EXISTS idx_property_price_history_changed_by ON property_price_history(changed_by);

-- Property Search Discoveries
CREATE INDEX IF NOT EXISTS idx_property_search_discoveries_user_id ON property_search_discoveries(user_id);

-- Property Shares
CREATE INDEX IF NOT EXISTS idx_property_shares_message_id ON property_shares(message_id);

-- Prospects
CREATE INDEX IF NOT EXISTS idx_prospects_property_id ON prospects(property_id);

-- Referral Tracking
CREATE INDEX IF NOT EXISTS idx_referral_tracking_agent_id ON referral_tracking(agent_id);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_application_id ON referral_tracking(application_id);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_buyer_id ON referral_tracking(buyer_id);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_lender_id ON referral_tracking(lender_id);

-- Rental Applications
CREATE INDEX IF NOT EXISTS idx_rental_applications_property_id ON rental_applications(property_id);
CREATE INDEX IF NOT EXISTS idx_rental_applications_property_owner_id ON rental_applications(property_owner_id);

-- Service Jobs
CREATE INDEX IF NOT EXISTS idx_service_jobs_property_id ON service_jobs(property_id);
CREATE INDEX IF NOT EXISTS idx_service_jobs_service_category_id ON service_jobs(service_category_id);

-- Service Provider Leads
CREATE INDEX IF NOT EXISTS idx_service_provider_leads_conversation_id ON service_provider_leads(conversation_id);

-- Service Provider Photos
CREATE INDEX IF NOT EXISTS idx_service_provider_photos_provider_id ON service_provider_photos(provider_id);

-- Service Provider Reviews
CREATE INDEX IF NOT EXISTS idx_service_provider_reviews_job_id ON service_provider_reviews(job_id);
CREATE INDEX IF NOT EXISTS idx_service_provider_reviews_reviewer_id ON service_provider_reviews(reviewer_id);

-- Service Provider Services
CREATE INDEX IF NOT EXISTS idx_service_provider_services_category_id ON service_provider_services(category_id);

-- Support Ticket Responses
CREATE INDEX IF NOT EXISTS idx_support_ticket_responses_user_id ON support_ticket_responses(user_id);

-- Team Invitations
CREATE INDEX IF NOT EXISTS idx_team_invitations_inviter_id ON team_invitations(inviter_id);

-- Team Members
CREATE INDEX IF NOT EXISTS idx_team_members_invited_by ON team_members(invited_by);
