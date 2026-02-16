import { useState, useEffect } from 'react';
import { Users, Mail, Calendar, CheckCircle, XCircle, Clock, Home, Phone, DollarSign, Briefcase, AlertCircle, FileText, Download } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

type RentalAgreement = {
  id: string;
  monthly_rent: number;
  security_deposit: number;
  lease_start_date: string;
  lease_end_date: string;
  status: string;
  payment_due_day: number;
};

type LeaseDocument = {
  id: string;
  file_name: string;
  storage_path: string;
  signed_at: string;
  signed_document_url: string | null;
  signature_data: string | null;
  signature_type: string | null;
};

type RentalApplication = {
  id: string;
  renter_id: string;
  property_id: string;
  status: string;
  move_in_date: string | null;
  lease_term_months: number | null;
  monthly_income: number | null;
  employment_status: string | null;
  current_address: string | null;
  has_pets: boolean;
  pet_details: string | null;
  additional_occupants: number;
  special_requests: string | null;
  application_submitted_at: string | null;
  created_at: string;
  renter: {
    full_name: string;
    phone_number: string | null;
  };
  property: {
    address_line1: string;
    city: string;
    state: string;
    price: number;
  };
  rental_agreement?: RentalAgreement;
  lease_document?: LeaseDocument;
};

type AssignedRentersProps = {
  propertyId?: string;
};

export function AssignedRenters({ propertyId }: AssignedRentersProps) {
  const { user } = useAuth();
  const [applications, setApplications] = useState<RentalApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApplication, setSelectedApplication] = useState<RentalApplication | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadApplications();
    }
  }, [user, propertyId]);

  const loadApplications = async () => {
    if (!user) return;

    try {
      let query = supabase
        .from('rental_applications')
        .select(`
          *,
          renter:profiles!rental_applications_renter_id_fkey(full_name, phone_number),
          property:properties(address_line1, city, state, price)
        `)
        .eq('property_owner_id', user.id)
        .neq('status', 'disconnected')
        .order('created_at', { ascending: false });

      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const applicationsWithAgreements = await Promise.all(
        (data || []).map(async (app) => {
          const { data: agreement } = await supabase
            .from('rental_agreements')
            .select('*')
            .eq('renter_id', app.renter_id)
            .eq('property_id', app.property_id)
            .maybeSingle();

          let leaseDocument = null;
          if (agreement) {
            const { data: doc } = await supabase
              .from('documents')
              .select(`
                id,
                file_name,
                storage_path,
                signed_at
              `)
              .eq('rental_agreement_id', agreement.id)
              .eq('signature_status', 'signed')
              .maybeSingle();

            if (doc) {
              const { data: signature } = await supabase
                .from('document_signatures')
                .select('signed_document_url, signature_data, signature_type')
                .eq('document_id', doc.id)
                .eq('status', 'signed')
                .maybeSingle();

              leaseDocument = {
                ...doc,
                signed_document_url: signature?.signed_document_url || null,
                signature_data: signature?.signature_data || null,
                signature_type: signature?.signature_type || null
              };
            }
          }

          return {
            ...app,
            rental_agreement: agreement,
            lease_document: leaseDocument
          };
        })
      );

      setApplications(applicationsWithAgreements);
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateApplicationStatus = async (applicationId: string, newStatus: string, rejectionReason?: string) => {
    setActionLoading(true);
    try {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'approved') {
        updateData.approved_at = new Date().toISOString();
      } else if (newStatus === 'rejected') {
        updateData.rejected_at = new Date().toISOString();
        updateData.rejection_reason = rejectionReason;
      }

      const { error } = await supabase
        .from('rental_applications')
        .update(updateData)
        .eq('id', applicationId);

      if (error) throw error;

      await loadApplications();
      setShowDetails(false);
      setSelectedApplication(null);
    } catch (error) {
      console.error('Error updating application:', error);
      alert('Failed to update application status');
    } finally {
      setActionLoading(false);
    }
  };

  const disconnectRenter = async (applicationId: string) => {
    if (!confirm('Are you sure you want to disconnect this renter? This action cannot be undone.')) {
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('rental_applications')
        .update({ status: 'disconnected', updated_at: new Date().toISOString() })
        .eq('id', applicationId);

      if (error) throw error;

      await loadApplications();
      setShowDetails(false);
      setSelectedApplication(null);
    } catch (error) {
      console.error('Error disconnecting renter:', error);
      alert('Failed to disconnect renter');
    } finally {
      setActionLoading(false);
    }
  };

  const downloadLeaseDocument = async (
    storagePath: string,
    fileName: string,
    signedDocumentUrl?: string | null
  ) => {
    try {
      const pathToDownload = signedDocumentUrl || storagePath;

      const { data, error } = await supabase.storage
        .from('agent-documents')
        .download(pathToDownload);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = signedDocumentUrl ? `signed_${fileName}` : fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Failed to download document');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'interested': return 'bg-blue-100 text-blue-800';
      case 'applied': return 'bg-yellow-100 text-yellow-800';
      case 'background_check': return 'bg-purple-100 text-purple-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'lease_signed': return 'bg-indigo-100 text-indigo-800';
      case 'active': return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle size={20} className="text-green-600" />;
      case 'rejected': return <XCircle size={20} className="text-red-600" />;
      case 'active': return <Home size={20} className="text-emerald-600" />;
      default: return <Clock size={20} className="text-blue-600" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b">
        <div className="flex items-center gap-3">
          <Users className="text-blue-600" size={24} />
          <div>
            <h2 className="text-xl font-bold text-gray-800">Assigned Renters</h2>
            <p className="text-sm text-gray-600">
              {applications.length} {applications.length === 1 ? 'renter' : 'renters'} interested in your properties
            </p>
          </div>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="p-12 text-center">
          <Users className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Renters Yet</h3>
          <p className="text-gray-600">
            When renters message you about your properties, they'll appear here.
          </p>
        </div>
      ) : (
        <div className="divide-y">
          {applications.map((application) => (
            <div
              key={application.id}
              className="p-6 hover:bg-gray-50 transition cursor-pointer"
              onClick={() => {
                setSelectedApplication(application);
                setShowDetails(true);
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">
                      {application.renter.full_name}
                    </h3>
                    {getStatusIcon(application.status)}
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(application.status)}`}>
                      {application.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Home size={16} className="text-gray-400" />
                      <span>
                        {application.property.address_line1}, {application.property.city}, {application.property.state}
                      </span>
                    </div>

                    {application.renter.phone_number && (
                      <div className="flex items-center gap-2">
                        <Phone size={16} className="text-gray-400" />
                        <span>{application.renter.phone_number}</span>
                      </div>
                    )}

                    {application.move_in_date && (
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-gray-400" />
                        <span>Desired move-in: {new Date(application.move_in_date).toLocaleDateString()}</span>
                      </div>
                    )}

                    {application.monthly_income && (
                      <div className="flex items-center gap-2">
                        <DollarSign size={16} className="text-gray-400" />
                        <span>Monthly income: ${application.monthly_income.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedApplication(application);
                    setShowDetails(true);
                  }}
                  className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-md transition"
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showDetails && selectedApplication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800">Application Details</h2>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Renter Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">Name</label>
                    <p className="font-medium">{selectedApplication.renter.full_name}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Phone</label>
                    <p className="font-medium">{selectedApplication.renter.phone_number || 'Not provided'}</p>
                  </div>
                  {selectedApplication.current_address && (
                    <div className="col-span-2">
                      <label className="text-sm text-gray-600">Current Address</label>
                      <p className="font-medium">{selectedApplication.current_address}</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Property</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-medium text-gray-900">
                    {selectedApplication.property.address_line1}
                  </p>
                  <p className="text-sm text-gray-600">
                    {selectedApplication.property.city}, {selectedApplication.property.state}
                  </p>
                  <p className="text-lg font-semibold text-blue-600 mt-2">
                    ${selectedApplication.property.price.toLocaleString()}/mo
                  </p>
                </div>
              </div>

              {selectedApplication.application_submitted_at && (
                <>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4">Financial Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedApplication.monthly_income && (
                        <div>
                          <label className="text-sm text-gray-600">Monthly Income</label>
                          <p className="font-medium">${selectedApplication.monthly_income.toLocaleString()}</p>
                        </div>
                      )}
                      {selectedApplication.employment_status && (
                        <div>
                          <label className="text-sm text-gray-600">Employment Status</label>
                          <p className="font-medium">{selectedApplication.employment_status}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4">Additional Details</h3>
                    <div className="space-y-3">
                      {selectedApplication.move_in_date && (
                        <div>
                          <label className="text-sm text-gray-600">Desired Move-in Date</label>
                          <p className="font-medium">{new Date(selectedApplication.move_in_date).toLocaleDateString()}</p>
                        </div>
                      )}
                      {selectedApplication.lease_term_months && (
                        <div>
                          <label className="text-sm text-gray-600">Lease Term</label>
                          <p className="font-medium">{selectedApplication.lease_term_months} months</p>
                        </div>
                      )}
                      <div>
                        <label className="text-sm text-gray-600">Pets</label>
                        <p className="font-medium">
                          {selectedApplication.has_pets ? `Yes - ${selectedApplication.pet_details || 'No details provided'}` : 'No'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-600">Additional Occupants</label>
                        <p className="font-medium">{selectedApplication.additional_occupants}</p>
                      </div>
                      {selectedApplication.special_requests && (
                        <div>
                          <label className="text-sm text-gray-600">Special Requests</label>
                          <p className="font-medium">{selectedApplication.special_requests}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {selectedApplication.rental_agreement && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <FileText className="text-green-600" size={24} />
                    <h3 className="font-semibold text-gray-900 text-lg">Lease Agreement</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-sm text-gray-600">Monthly Rent</label>
                      <p className="font-semibold text-lg text-gray-900">
                        ${selectedApplication.rental_agreement.monthly_rent.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Security Deposit</label>
                      <p className="font-semibold text-lg text-gray-900">
                        ${selectedApplication.rental_agreement.security_deposit.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Lease Start Date</label>
                      <p className="font-medium text-gray-900">
                        {new Date(selectedApplication.rental_agreement.lease_start_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Lease End Date</label>
                      <p className="font-medium text-gray-900">
                        {new Date(selectedApplication.rental_agreement.lease_end_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Payment Due Day</label>
                      <p className="font-medium text-gray-900">
                        Day {selectedApplication.rental_agreement.payment_due_day} of each month
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Agreement Status</label>
                      <p className="font-medium text-green-700">
                        {selectedApplication.rental_agreement.status.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  {selectedApplication.lease_document && (
                    <div className="pt-4 border-t border-green-200">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <label className="text-sm text-gray-600">Signed Lease Document</label>
                            <p className="font-medium text-gray-900">{selectedApplication.lease_document.file_name}</p>
                            <p className="text-xs text-gray-500">
                              Signed on {new Date(selectedApplication.lease_document.signed_at).toLocaleString()}
                            </p>
                          </div>
                          <button
                            onClick={() => downloadLeaseDocument(
                              selectedApplication.lease_document!.storage_path,
                              selectedApplication.lease_document!.file_name,
                              selectedApplication.lease_document!.signed_document_url
                            )}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
                          >
                            <Download size={18} />
                            {selectedApplication.lease_document.signed_document_url ? 'Download Signed PDF' : 'Download Document'}
                          </button>
                        </div>

                        {selectedApplication.lease_document.signature_data && (
                          <div className="bg-white rounded-lg p-3 border border-green-300">
                            <label className="text-xs text-gray-600 font-medium">Signature</label>
                            {selectedApplication.lease_document.signature_type === 'typed' ? (
                              <p className="font-serif text-2xl text-gray-900 italic mt-1">
                                {selectedApplication.lease_document.signature_data}
                              </p>
                            ) : (
                              <img
                                src={selectedApplication.lease_document.signature_data}
                                alt="Signature"
                                className="h-16 mt-1"
                              />
                            )}
                          </div>
                        )}

                        {selectedApplication.lease_document.signed_document_url && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <div className="flex gap-2">
                              <CheckCircle className="text-green-600 flex-shrink-0" size={16} />
                              <p className="text-xs text-green-800">
                                Signed PDF available with signature embedded in the document.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Status</h3>
                <div className="flex items-center gap-3">
                  {getStatusIcon(selectedApplication.status)}
                  <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(selectedApplication.status)}`}>
                    {selectedApplication.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>

              {selectedApplication.status === 'applied' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="text-yellow-600 flex-shrink-0" size={20} />
                    <div>
                      <h4 className="font-medium text-yellow-900 mb-2">Action Required</h4>
                      <p className="text-sm text-yellow-800">
                        This renter has submitted a formal application. Review their information and approve or reject the application.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                {selectedApplication.status === 'interested' && (
                  <button
                    onClick={() => updateApplicationStatus(selectedApplication.id, 'applied')}
                    disabled={actionLoading}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    Mark as Applied
                  </button>
                )}

                {selectedApplication.status === 'applied' && (
                  <>
                    <button
                      onClick={() => updateApplicationStatus(selectedApplication.id, 'background_check')}
                      disabled={actionLoading}
                      className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition disabled:opacity-50"
                    >
                      Start Background Check
                    </button>
                    <button
                      onClick={() => updateApplicationStatus(selectedApplication.id, 'approved')}
                      disabled={actionLoading}
                      className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt('Enter rejection reason:');
                        if (reason) updateApplicationStatus(selectedApplication.id, 'rejected', reason);
                      }}
                      disabled={actionLoading}
                      className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </>
                )}

                {selectedApplication.status === 'background_check' && (
                  <>
                    <button
                      onClick={() => updateApplicationStatus(selectedApplication.id, 'approved')}
                      disabled={actionLoading}
                      className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt('Enter rejection reason:');
                        if (reason) updateApplicationStatus(selectedApplication.id, 'rejected', reason);
                      }}
                      disabled={actionLoading}
                      className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </>
                )}

                {selectedApplication.status === 'approved' && (
                  <button
                    onClick={() => updateApplicationStatus(selectedApplication.id, 'lease_signed')}
                    disabled={actionLoading}
                    className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    Mark Lease as Signed
                  </button>
                )}

                {selectedApplication.status === 'lease_signed' && (
                  <button
                    onClick={() => updateApplicationStatus(selectedApplication.id, 'active')}
                    disabled={actionLoading}
                    className="flex-1 bg-emerald-600 text-white py-2 px-4 rounded-md hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    Mark as Moved In
                  </button>
                )}

                <button
                  onClick={() => disconnectRenter(selectedApplication.id)}
                  disabled={actionLoading}
                  className="px-6 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 transition disabled:opacity-50"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
