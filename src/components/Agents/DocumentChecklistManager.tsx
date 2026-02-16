import { useState, useEffect } from 'react';
import { CheckSquare, Plus, X, Trash2, ChevronDown, ChevronRight, FileText, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface DocumentChecklist {
  id: string;
  name: string;
  description: string | null;
  client_id: string | null;
  property_id: string | null;
  all_documents_added: boolean;
  all_documents_completed: boolean;
  created_at: string;
  updated_at: string;
}

interface ChecklistItem {
  id: string;
  checklist_id: string;
  name: string;
  document_id: string | null;
  is_required: boolean;
  is_completed: boolean;
  notes: string | null;
  order_index: number;
  document?: {
    file_name: string;
    file_type: string;
    storage_path: string;
  };
}

interface Client {
  id: string;
  full_name: string;
}

interface Property {
  id: string;
  address_line1: string;
  city: string;
}

interface Document {
  id: string;
  file_name: string;
  file_type: string;
  storage_path?: string;
}

export function DocumentChecklistManager() {
  const { user } = useAuth();
  const [checklists, setChecklists] = useState<DocumentChecklist[]>([]);
  const [expandedChecklist, setExpandedChecklist] = useState<string | null>(null);
  const [checklistItems, setChecklistItems] = useState<Record<string, ChecklistItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [availableDocuments, setAvailableDocuments] = useState<Document[]>([]);

  const [newChecklist, setNewChecklist] = useState({
    name: '',
    description: '',
    client_id: '',
    property_id: '',
  });

  const [newItem, setNewItem] = useState({
    name: '',
    is_required: true,
    notes: '',
    document_id: null as string | null,
  });

  const [checklistDraftItems, setChecklistDraftItems] = useState<Array<{
    name: string;
    is_required: boolean;
    notes: string;
    document_id: string | null;
  }>>([]);

  useEffect(() => {
    if (user) {
      loadChecklists();
      loadClients();
      loadProperties();
      loadDocuments();
    }
  }, [user]);

  const loadChecklists = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('document_checklists')
        .select('*')
        .eq('agent_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setChecklists(data || []);
    } catch (error) {
      console.error('Error loading checklists:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChecklistItems = async (checklistId: string) => {
    try {
      const { data, error } = await supabase
        .from('document_checklist_items')
        .select(`
          *,
          document:documents(file_name, file_type, storage_path)
        `)
        .eq('checklist_id', checklistId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setChecklistItems(prev => ({ ...prev, [checklistId]: data || [] }));
    } catch (error) {
      console.error('Error loading checklist items:', error);
    }
  };

  const loadClients = async () => {
    try {
      // Get all clients associated with this agent through various methods
      const clientIds = new Set<string>();
      const clientMap = new Map<string, { id: string; full_name: string }>();

      // 1. Direct assigned_agent_id relationship
      const { data: directClients } = await supabase
        .from('profiles')
        .select('id, full_name, user_type')
        .eq('assigned_agent_id', user!.id)
        .in('user_type', ['buyer', 'seller']);

      if (directClients) {
        directClients.forEach(client => {
          clientIds.add(client.id);
          clientMap.set(client.id, { id: client.id, full_name: client.full_name });
        });
      }

      // 2. Clients from properties this agent manages
      const { data: properties } = await supabase
        .from('properties')
        .select('seller_id')
        .eq('agent_id', user!.id)
        .not('seller_id', 'is', null);

      if (properties) {
        const sellerIds = [...new Set(properties.map(p => p.seller_id).filter(Boolean))];
        if (sellerIds.length > 0) {
          const { data: sellers } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', sellerIds);

          if (sellers) {
            sellers.forEach(seller => {
              if (!clientIds.has(seller.id)) {
                clientIds.add(seller.id);
                clientMap.set(seller.id, { id: seller.id, full_name: seller.full_name });
              }
            });
          }
        }
      }

      // 3. Clients from accepted invitations
      const { data: invitations } = await supabase
        .from('invitations')
        .select('accepted_by')
        .eq('agent_id', user!.id)
        .eq('status', 'accepted')
        .not('accepted_by', 'is', null);

      if (invitations) {
        const inviteeIds = [...new Set(invitations.map(i => i.accepted_by).filter(Boolean))];
        if (inviteeIds.length > 0) {
          const { data: invitees } = await supabase
            .from('profiles')
            .select('id, full_name, user_type')
            .in('id', inviteeIds)
            .in('user_type', ['buyer', 'seller']);

          if (invitees) {
            invitees.forEach(invitee => {
              if (!clientIds.has(invitee.id)) {
                clientIds.add(invitee.id);
                clientMap.set(invitee.id, { id: invitee.id, full_name: invitee.full_name });
              }
            });
          }
        }
      }

      // Convert to array and sort
      const allClients = Array.from(clientMap.values()).sort((a, b) =>
        a.full_name.localeCompare(b.full_name)
      );

      setClients(allClients);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadProperties = async () => {
    try {
      const propertyMap = new Map<string, Property>();

      // Get properties where agent is directly assigned
      const { data: agentProperties, error: agentError } = await supabase
        .from('properties')
        .select('id, address_line1, city')
        .eq('agent_id', user!.id);

      if (agentError) throw agentError;

      // Add agent properties to map
      agentProperties?.forEach(prop => {
        propertyMap.set(prop.id, prop);
      });

      // Get sellers assigned to this agent
      const { data: assignedSellers, error: sellersError } = await supabase
        .from('profiles')
        .select('id')
        .eq('assigned_agent_id', user!.id)
        .eq('user_type', 'seller');

      if (sellersError) throw sellersError;

      // Get properties owned by these sellers
      if (assignedSellers && assignedSellers.length > 0) {
        const sellerIds = assignedSellers.map(s => s.id);
        const { data: sellerProperties, error: sellerPropsError } = await supabase
          .from('properties')
          .select('id, address_line1, city')
          .in('seller_id', sellerIds);

        if (sellerPropsError) throw sellerPropsError;

        // Add seller properties to map
        sellerProperties?.forEach(prop => {
          if (!propertyMap.has(prop.id)) {
            propertyMap.set(prop.id, prop);
          }
        });
      }

      // Convert to array and sort
      const allProperties = Array.from(propertyMap.values()).sort((a, b) =>
        a.address_line1.localeCompare(b.address_line1)
      );

      setProperties(allProperties);
    } catch (error) {
      console.error('Error loading properties:', error);
    }
  };

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, file_name, file_type, storage_path')
        .eq('owner_id', user!.id)
        .order('file_name');

      if (error) throw error;
      setAvailableDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const handleCreateChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: checklist, error: checklistError } = await supabase
        .from('document_checklists')
        .insert({
          agent_id: user!.id,
          name: newChecklist.name,
          description: newChecklist.description || null,
          client_id: newChecklist.client_id || null,
          property_id: newChecklist.property_id || null,
        })
        .select()
        .single();

      if (checklistError) throw checklistError;

      if (checklistDraftItems.length > 0 && checklist) {
        const items = checklistDraftItems.map((item, index) => ({
          checklist_id: checklist.id,
          name: item.name,
          is_required: item.is_required,
          notes: item.notes || null,
          document_id: item.document_id || null,
          order_index: index,
        }));

        const { error: itemsError } = await supabase
          .from('document_checklist_items')
          .insert(items);

        if (itemsError) throw itemsError;
      }

      setShowCreateModal(false);
      setNewChecklist({ name: '', description: '', client_id: '', property_id: '' });
      setChecklistDraftItems([]);
      await loadChecklists();
    } catch (error) {
      console.error('Error creating checklist:', error);
      alert('Failed to create checklist');
    }
  };

  const handleAddDraftItem = () => {
    if (!newItem.name.trim()) return;

    setChecklistDraftItems([
      ...checklistDraftItems,
      {
        name: newItem.name,
        is_required: newItem.is_required,
        notes: newItem.notes,
        document_id: newItem.document_id,
      },
    ]);
    setNewItem({ name: '', is_required: true, notes: '', document_id: null });
  };

  const handleRemoveDraftItem = (index: number) => {
    setChecklistDraftItems(checklistDraftItems.filter((_, i) => i !== index));
  };

  const handleUpdateDraftItemDocument = (index: number, documentId: string | null) => {
    const updated = [...checklistDraftItems];
    updated[index].document_id = documentId;
    setChecklistDraftItems(updated);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddItemModal) return;

    try {
      const items = checklistItems[showAddItemModal] || [];
      const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.order_index)) : -1;

      const { error } = await supabase
        .from('document_checklist_items')
        .insert({
          checklist_id: showAddItemModal,
          name: newItem.name,
          is_required: newItem.is_required,
          notes: newItem.notes || null,
          document_id: newItem.document_id || null,
          order_index: maxOrder + 1,
        });

      if (error) throw error;

      setShowAddItemModal(null);
      setNewItem({ name: '', is_required: true, notes: '', document_id: null });
      await loadChecklistItems(showAddItemModal);
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Failed to add item');
    }
  };

  const handleAssignDocument = async (itemId: string, checklistId: string, documentId: string | null) => {
    try {
      const { error } = await supabase
        .from('document_checklist_items')
        .update({ document_id: documentId })
        .eq('id', itemId);

      if (error) throw error;
      await loadChecklistItems(checklistId);
    } catch (error) {
      console.error('Error assigning document:', error);
      alert('Failed to assign document');
    }
  };

  const handleToggleCompleted = async (itemId: string, checklistId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('document_checklist_items')
        .update({ is_completed: !currentValue })
        .eq('id', itemId);

      if (error) throw error;
      await loadChecklistItems(checklistId);
      await loadChecklists();
    } catch (error) {
      console.error('Error updating item:', error);
      alert('Failed to update item');
    }
  };

  const handleDeleteItem = async (itemId: string, checklistId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const { error } = await supabase
        .from('document_checklist_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      await loadChecklistItems(checklistId);
      await loadChecklists();
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    }
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    if (!confirm('Are you sure you want to delete this checklist? All items will be removed.')) return;

    try {
      const { error } = await supabase
        .from('document_checklists')
        .delete()
        .eq('id', checklistId);

      if (error) throw error;
      await loadChecklists();
      setChecklistItems(prev => {
        const newItems = { ...prev };
        delete newItems[checklistId];
        return newItems;
      });
    } catch (error) {
      console.error('Error deleting checklist:', error);
      alert('Failed to delete checklist');
    }
  };

  const toggleExpandChecklist = (checklistId: string) => {
    if (expandedChecklist === checklistId) {
      setExpandedChecklist(null);
    } else {
      setExpandedChecklist(checklistId);
      if (!checklistItems[checklistId]) {
        loadChecklistItems(checklistId);
      }
    }
  };

  const getChecklistProgress = (checklist: DocumentChecklist) => {
    const items = checklistItems[checklist.id] || [];
    if (items.length === 0) return { percentage: 0, text: 'No items' };

    const itemsWithDocuments = items.filter(item => item.document_id);
    const percentage = (itemsWithDocuments.length / items.length) * 100;
    return { percentage, text: `${itemsWithDocuments.length}/${items.length} documents assigned` };
  };

  const handleDownloadDocument = async (storagePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('agent-documents')
        .download(storagePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Failed to download document');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading checklists...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckSquare className="text-blue-600" size={24} />
              <h3 className="text-lg font-semibold text-gray-800">Document Checklists</h3>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
            >
              <Plus size={20} />
              New Checklist
            </button>
          </div>
        </div>

        {checklists.length === 0 ? (
          <div className="p-6 text-center py-12">
            <CheckSquare className="mx-auto text-gray-400 mb-3" size={48} />
            <p className="text-gray-600">No checklists created yet</p>
            <p className="text-sm text-gray-500 mt-1">Create a checklist to track document collection progress</p>
          </div>
        ) : (
          <div className="divide-y">
            {checklists.map((checklist) => {
              const isExpanded = expandedChecklist === checklist.id;
              const items = checklistItems[checklist.id] || [];
              const progress = getChecklistProgress(checklist);

              return (
                <div key={checklist.id} className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <button
                      onClick={() => toggleExpandChecklist(checklist.id)}
                      className="flex items-start gap-3 flex-1 text-left hover:bg-gray-50 -m-2 p-2 rounded transition"
                    >
                      {isExpanded ? (
                        <ChevronDown className="text-gray-400 flex-shrink-0 mt-1" size={20} />
                      ) : (
                        <ChevronRight className="text-gray-400 flex-shrink-0 mt-1" size={20} />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-gray-800">{checklist.name}</h4>
                          {checklist.all_documents_completed && (
                            <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                              <CheckCircle size={14} />
                              Complete
                            </span>
                          )}
                          {checklist.all_documents_added && !checklist.all_documents_completed && (
                            <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                              <AlertCircle size={14} />
                              All Added
                            </span>
                          )}
                        </div>
                        {checklist.description && (
                          <p className="text-sm text-gray-600 mb-2">{checklist.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>{progress.text}</span>
                          <div className="flex-1 max-w-xs">
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-600 transition-all"
                                style={{ width: `${progress.percentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleDeleteChecklist(checklist.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition"
                      title="Delete checklist"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 ml-8 space-y-3">
                      <div className="flex justify-end">
                        <button
                          onClick={() => setShowAddItemModal(checklist.id)}
                          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
                        >
                          <Plus size={16} />
                          Add Item
                        </button>
                      </div>

                      {items.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No items in this checklist</p>
                      ) : (
                        <div className="space-y-2">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                            >
                              <button
                                onClick={() => handleToggleCompleted(item.id, checklist.id, item.is_completed)}
                                disabled={!item.document_id}
                                className={`flex-shrink-0 mt-1 ${
                                  item.is_completed
                                    ? 'text-green-600'
                                    : item.document_id
                                    ? 'text-gray-400 hover:text-green-600'
                                    : 'text-gray-300 cursor-not-allowed'
                                }`}
                              >
                                {item.is_completed ? (
                                  <CheckCircle size={20} />
                                ) : (
                                  <div className="w-5 h-5 border-2 border-current rounded" />
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`font-medium ${item.is_completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                                    {item.name}
                                  </span>
                                  {item.is_required && (
                                    <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                                      Required
                                    </span>
                                  )}
                                </div>
                                {item.notes && (
                                  <p className="text-sm text-gray-600 mt-1">{item.notes}</p>
                                )}
                                <div className="mt-2">
                                  <select
                                    value={item.document_id || ''}
                                    onChange={(e) => handleAssignDocument(item.id, checklist.id, e.target.value || null)}
                                    className="text-sm border border-gray-300 rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  >
                                    <option value="">No document assigned</option>
                                    {availableDocuments.map((doc) => (
                                      <option key={doc.id} value={doc.id}>
                                        {doc.file_name}
                                      </option>
                                    ))}
                                  </select>
                                  {item.document && (
                                    <div className="flex items-center gap-2 mt-2 p-2 bg-blue-50 rounded">
                                      <FileText size={14} className="text-blue-600 flex-shrink-0" />
                                      <span className="text-xs text-gray-700 flex-1 truncate">{item.document.file_name}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {item.document && (
                                  <button
                                    onClick={() => handleDownloadDocument(item.document!.storage_path, item.document!.file_name)}
                                    className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition"
                                    title="Download document"
                                  >
                                    <Download size={16} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteItem(item.id, checklist.id)}
                                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                  title="Delete item"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {items.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                          <div>
                            <div className="flex items-center justify-between text-sm mb-2">
                              <span className="font-medium text-gray-700">Documents Assigned</span>
                              <span className="text-gray-600">
                                {items.filter(item => item.document_id).length} / {items.length}
                                <span className="ml-1 text-blue-600 font-semibold">
                                  ({Math.round((items.filter(item => item.document_id).length / items.length) * 100)}%)
                                </span>
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div
                                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                style={{
                                  width: `${(items.filter(item => item.document_id).length / items.length) * 100}%`
                                }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between text-sm mb-2">
                              <span className="font-medium text-gray-700">Items Completed</span>
                              <span className="text-gray-600">
                                {items.filter(item => item.is_completed).length} / {items.length}
                                <span className="ml-1 text-green-600 font-semibold">
                                  ({Math.round((items.filter(item => item.is_completed).length / items.length) * 100)}%)
                                </span>
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div
                                className="bg-green-600 h-2.5 rounded-full transition-all duration-300"
                                style={{
                                  width: `${(items.filter(item => item.is_completed).length / items.length) * 100}%`
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Create Document Checklist</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setChecklistDraftItems([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateChecklist} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Checklist Name *
                </label>
                <input
                  type="text"
                  value={newChecklist.name}
                  onChange={(e) => setNewChecklist({ ...newChecklist, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  placeholder="e.g., Buyer Documents, Closing Checklist"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newChecklist.description}
                  onChange={(e) => setNewChecklist({ ...newChecklist, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Optional description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign to Client (Optional)
                </label>
                <select
                  value={newChecklist.client_id}
                  onChange={(e) => setNewChecklist({ ...newChecklist, client_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">None</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign to Property (Optional)
                </label>
                <select
                  value={newChecklist.property_id}
                  onChange={(e) => setNewChecklist({ ...newChecklist, property_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">None</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.address_line1}, {property.city}
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Checklist Items
                  </label>
                  <span className="text-xs text-gray-500">
                    {checklistDraftItems.length} item{checklistDraftItems.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="bg-gray-50 p-3 rounded-lg space-y-3">
                    <input
                      type="text"
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddDraftItem();
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="Item name (e.g., Pre-approval letter)"
                    />

                    <select
                      value={newItem.document_id || ''}
                      onChange={(e) => setNewItem({ ...newItem, document_id: e.target.value || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="">Assign document (optional)</option>
                      {availableDocuments.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.file_name}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="draft_is_required"
                        checked={newItem.is_required}
                        onChange={(e) => setNewItem({ ...newItem, is_required: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="draft_is_required" className="text-sm text-gray-700">
                        Required
                      </label>
                      <button
                        type="button"
                        onClick={handleAddDraftItem}
                        disabled={!newItem.name.trim()}
                        className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        <Plus size={16} />
                        Add Item
                      </button>
                    </div>
                  </div>

                  {checklistDraftItems.length > 0 && (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {checklistDraftItems.map((item, index) => (
                        <div key={index} className="flex items-start gap-2 p-3 bg-white border border-gray-200 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium text-gray-800">{item.name}</span>
                              {item.is_required && (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                                  Required
                                </span>
                              )}
                            </div>
                            <select
                              value={item.document_id || ''}
                              onChange={(e) => handleUpdateDraftItemDocument(index, e.target.value || null)}
                              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="">No document assigned</option>
                              {availableDocuments.map((doc) => (
                                <option key={doc.id} value={doc.id}>
                                  {doc.file_name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveDraftItem(index)}
                            className="p-1 text-gray-400 hover:text-red-600 transition flex-shrink-0"
                            title="Remove item"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setChecklistDraftItems([]);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Create Checklist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Add Checklist Item</h3>
              <button
                onClick={() => setShowAddItemModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  placeholder="e.g., Pre-approval letter, Purchase agreement"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={newItem.notes}
                  onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                  placeholder="Additional notes or requirements"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign Document (Optional)
                </label>
                <select
                  value={newItem.document_id || ''}
                  onChange={(e) => setNewItem({ ...newItem, document_id: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No document assigned</option>
                  {availableDocuments.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.file_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_required"
                  checked={newItem.is_required}
                  onChange={(e) => setNewItem({ ...newItem, is_required: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_required" className="text-sm font-medium text-gray-700">
                  Required Document
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
