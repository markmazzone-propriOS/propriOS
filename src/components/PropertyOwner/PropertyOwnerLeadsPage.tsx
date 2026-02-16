import { ArrowLeft } from 'lucide-react';
import { useNavigate } from '../Navigation/Router';
import { PropertyOwnerLeadsList } from './PropertyOwnerLeadsList';

export function PropertyOwnerLeadsPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm border-b mb-8">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-2">
            <button
              onClick={() => navigate('/property-owner/dashboard')}
              className="text-gray-600 hover:text-blue-600 transition"
              title="Back"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-3xl font-bold text-gray-800">Leads</h1>
          </div>
          <p className="text-gray-600">Manage your rental leads and track their status</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-12">
        <PropertyOwnerLeadsList />
      </div>
    </div>
  );
}
