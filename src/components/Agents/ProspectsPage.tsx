import { useState } from 'react';
import { ArrowLeft, Mail, Users } from 'lucide-react';
import { useNavigate } from '../Navigation/Router';
import { ProspectsList } from './ProspectsList';
import { FollowUpCampaigns } from './FollowUpCampaigns';

export function ProspectsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'prospects' | 'campaigns'>('prospects');

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm border-b mb-8">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-600 hover:text-blue-600 transition"
              title="Back"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Leads & Follow-Ups</h1>
              <p className="text-gray-600">Manage your leads and automated follow-up campaigns</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('prospects')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition ${
                activeTab === 'prospects'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Users size={18} />
              Leads
            </button>
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition ${
                activeTab === 'campaigns'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Mail size={18} />
              Automated Follow-Ups
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-12">
        {activeTab === 'prospects' ? <ProspectsList /> : <FollowUpCampaigns />}
      </div>
    </div>
  );
}
