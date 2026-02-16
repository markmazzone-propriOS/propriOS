import { useState, useEffect } from 'react';
import { MessageSquare, Send, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type Note = {
  id: string;
  application_id: string;
  lender_user_id: string;
  note: string;
  created_at: string;
  author_name?: string;
};

export function ApplicationNotes({ applicationId }: { applicationId: string }) {
  const { user, profile } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadNotes();
  }, [applicationId]);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('application_notes')
        .select(`
          *,
          profiles!application_notes_lender_user_id_fkey(full_name)
        `)
        .eq('application_id', applicationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formattedNotes = data.map((note: any) => ({
        ...note,
        author_name: note.profiles?.full_name || 'Unknown User'
      }));

      setNotes(formattedNotes);
    } catch (err) {
      console.error('Error loading notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('application_notes')
        .insert({
          application_id: applicationId,
          lender_user_id: user!.id,
          note: newNote.trim()
        });

      if (error) throw error;

      setNewNote('');
      loadNotes();
    } catch (err) {
      console.error('Error adding note:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-600">Loading notes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
        {notes.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare size={48} className="mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600">No notes yet</p>
            <p className="text-sm text-gray-500">Add internal notes about this application</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notes.map((note) => (
              <div key={note.id} className="border-l-4 border-blue-600 bg-gray-50 rounded-r-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-gray-400" />
                    <span className="font-medium text-gray-800 text-sm">{note.author_name}</span>
                  </div>
                  <span className="text-xs text-gray-500">{formatDate(note.created_at)}</span>
                </div>
                <p className="text-gray-700 whitespace-pre-wrap">{note.note}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Add Internal Note
        </label>
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={3}
          placeholder="Add a note about this application..."
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
          disabled={submitting}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || !newNote.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
          >
            <Send size={16} />
            <span>{submitting ? 'Adding...' : 'Add Note'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
