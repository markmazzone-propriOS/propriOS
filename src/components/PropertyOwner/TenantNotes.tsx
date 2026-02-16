import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Plus, Search, User, Edit2, Trash2, X, Lock } from 'lucide-react';

interface TenantNote {
  id: string;
  property_owner_id: string;
  renter_id: string;
  rental_agreement_id: string | null;
  note_type: string;
  note_text: string;
  is_private: boolean;
  created_at: string;
  renter: {
    full_name: string;
  };
}

interface Renter {
  id: string;
  full_name: string;
}

export default function TenantNotes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<TenantNote[]>([]);
  const [renters, setRenters] = useState<Renter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingNote, setEditingNote] = useState<TenantNote | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [formData, setFormData] = useState({
    renter_id: '',
    note_type: 'general',
    note_text: '',
    is_private: true,
  });

  useEffect(() => {
    if (user) {
      fetchNotes();
      fetchRenters();
    }
  }, [user]);

  const fetchNotes = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('tenant_notes')
        .select(`
          *,
          renter:profiles!tenant_notes_renter_id_fkey(
            full_name
          )
        `)
        .eq('property_owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setNotes((data as any) || []);
    } catch (error) {
      console.error('Error fetching tenant notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRenters = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('rental_agreements')
        .select(`
          renter:profiles!rental_agreements_renter_id_fkey(
            id,
            full_name
          )
        `)
        .eq('property_owner_id', user.id);

      if (error) throw error;

      const uniqueRenters = Array.from(
        new Map((data as any).map((item: any) => [item.renter.id, item.renter])).values()
      ) as Renter[];

      setRenters(uniqueRenters);
    } catch (error) {
      console.error('Error fetching renters:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingNote) {
        const { error } = await supabase
          .from('tenant_notes')
          .update({
            note_type: formData.note_type,
            note_text: formData.note_text,
            is_private: formData.is_private,
          })
          .eq('id', editingNote.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('tenant_notes').insert({
          property_owner_id: user.id,
          renter_id: formData.renter_id,
          note_type: formData.note_type,
          note_text: formData.note_text,
          is_private: formData.is_private,
        });

        if (error) throw error;
      }

      resetForm();
      fetchNotes();
    } catch (error: any) {
      console.error('Error saving note:', error);
      alert('Failed to save note: ' + error.message);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      const { error } = await supabase.from('tenant_notes').delete().eq('id', noteId);

      if (error) throw error;

      fetchNotes();
    } catch (error: any) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note: ' + error.message);
    }
  };

  const startEdit = (note: TenantNote) => {
    setEditingNote(note);
    setFormData({
      renter_id: note.renter_id,
      note_type: note.note_type,
      note_text: note.note_text,
      is_private: note.is_private,
    });
    setShowCreateModal(true);
  };

  const resetForm = () => {
    setFormData({
      renter_id: '',
      note_type: 'general',
      note_text: '',
      is_private: true,
    });
    setEditingNote(null);
    setShowCreateModal(false);
  };

  const getFilteredNotes = () => {
    let filtered = notes;

    if (filterType !== 'all') {
      filtered = filtered.filter(n => n.note_type === filterType);
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        n =>
          n.renter?.full_name?.toLowerCase().includes(searchLower) ||
          n.note_text?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  };

  const getNoteTypeBadge = (type: string) => {
    const badges = {
      general: 'bg-gray-100 text-gray-800',
      maintenance: 'bg-orange-100 text-orange-800',
      complaint: 'bg-red-100 text-red-800',
      payment: 'bg-green-100 text-green-800',
      positive: 'bg-blue-100 text-blue-800',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badges[type as keyof typeof badges] || badges.general}`}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  const filteredNotes = getFilteredNotes();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Tenant Notes</h2>
          <p className="text-gray-600 mt-1">Keep track of important tenant information</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Note
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <input
              type="text"
              placeholder="Search notes or tenants..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
          </div>
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Types</option>
          <option value="general">General</option>
          <option value="maintenance">Maintenance</option>
          <option value="complaint">Complaint</option>
          <option value="payment">Payment</option>
          <option value="positive">Positive</option>
        </select>
      </div>

      {filteredNotes.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Tenant Notes</h3>
          <p className="text-gray-600">
            {searchTerm || filterType !== 'all'
              ? 'No notes match your filters'
              : 'Start adding notes about your tenants'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{note.renter?.full_name}</h3>
                    <p className="text-sm text-gray-500">Tenant</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getNoteTypeBadge(note.note_type)}
                  {note.is_private && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      <Lock className="w-3 h-3" />
                      Private
                    </span>
                  )}
                </div>
              </div>

              <p className="text-gray-700 whitespace-pre-wrap mb-3">{note.note_text}</p>

              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  {new Date(note.created_at).toLocaleDateString()} at{' '}
                  {new Date(note.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(note)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingNote ? 'Edit Note' : 'Add Tenant Note'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {!editingNote && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Tenant
                  </label>
                  <select
                    value={formData.renter_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, renter_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Choose a tenant...</option>
                    {renters.map((renter) => (
                      <option key={renter.id} value={renter.id}>
                        {renter.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note Type
                </label>
                <select
                  value={formData.note_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, note_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="general">General</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="complaint">Complaint</option>
                  <option value="payment">Payment</option>
                  <option value="positive">Positive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note
                </label>
                <textarea
                  value={formData.note_text}
                  onChange={(e) => setFormData(prev => ({ ...prev, note_text: e.target.value }))}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter note details..."
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_private"
                  checked={formData.is_private}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_private: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_private" className="text-sm text-gray-700">
                  Keep this note private (only visible to you)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingNote ? 'Update Note' : 'Add Note'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
