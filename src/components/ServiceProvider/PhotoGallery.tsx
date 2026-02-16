import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Upload, X, Image as ImageIcon, Edit2, Save, Trash2, ZoomIn } from 'lucide-react';

type Photo = {
  id: string;
  photo_url: string;
  caption: string | null;
  display_order: number;
};

type PhotoGalleryProps = {
  providerId: string;
  isEditable?: boolean;
};

export function PhotoGallery({ providerId, isEditable = false }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [error, setError] = useState('');
  const [expandedPhoto, setExpandedPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    loadPhotos();
  }, [providerId]);

  const loadPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('service_provider_photos')
        .select('*')
        .eq('provider_id', providerId)
        .order('display_order');

      if (error) throw error;
      setPhotos(data || []);
    } catch (err) {
      console.error('Error loading photos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError('');

    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          setError('Each photo must be less than 10MB');
          continue;
        }

        if (!file.type.startsWith('image/')) {
          setError('Only image files are allowed');
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${providerId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('service-provider-photos')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('service-provider-photos')
          .getPublicUrl(fileName);

        const nextOrder = photos.length > 0 ? Math.max(...photos.map(p => p.display_order)) + 1 : 0;

        const { error: insertError } = await supabase
          .from('service_provider_photos')
          .insert({
            provider_id: providerId,
            photo_url: urlData.publicUrl,
            display_order: nextOrder,
          });

        if (insertError) throw insertError;
      }

      await loadPhotos();
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      setError(err.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeletePhoto = async (photoId: string, photoUrl: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;

    try {
      const fileName = photoUrl.split('/').slice(-2).join('/');

      const { error: storageError } = await supabase.storage
        .from('service-provider-photos')
        .remove([fileName]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('service_provider_photos')
        .delete()
        .eq('id', photoId);

      if (dbError) throw dbError;

      await loadPhotos();
    } catch (err: any) {
      console.error('Error deleting photo:', err);
      setError(err.message || 'Failed to delete photo');
    }
  };

  const handleStartEdit = (photo: Photo) => {
    setEditingPhotoId(photo.id);
    setEditCaption(photo.caption || '');
  };

  const handleSaveCaption = async (photoId: string) => {
    try {
      const { error } = await supabase
        .from('service_provider_photos')
        .update({ caption: editCaption || null })
        .eq('id', photoId);

      if (error) throw error;

      await loadPhotos();
      setEditingPhotoId(null);
      setEditCaption('');
    } catch (err: any) {
      console.error('Error updating caption:', err);
      setError(err.message || 'Failed to update caption');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600 text-sm">Loading photos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {isEditable && (
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6">
          <label className="cursor-pointer flex flex-col items-center">
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <Upload size={24} />
              <span className="font-medium">
                {uploading ? 'Uploading...' : 'Upload Photos'}
              </span>
            </div>
            <p className="text-sm text-gray-500 text-center">
              Click to select photos to showcase your work (Max 10MB each)
            </p>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      )}

      {photos.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <ImageIcon className="mx-auto text-gray-400 mb-3" size={48} />
          <p className="text-gray-600">
            {isEditable ? 'Upload photos to showcase your work' : 'No photos available'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group bg-white rounded-lg shadow-md overflow-hidden">
              <div
                className="relative cursor-pointer"
                onClick={() => !isEditable && setExpandedPhoto(photo)}
              >
                <img
                  src={photo.photo_url}
                  alt={photo.caption || 'Service provider photo'}
                  className="w-full h-64 object-cover"
                />
                {!isEditable && (
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                    <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={32} />
                  </div>
                )}
              </div>
              {isEditable && (
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleStartEdit(photo)}
                    className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition"
                    title="Edit caption"
                  >
                    <Edit2 size={16} className="text-gray-700" />
                  </button>
                  <button
                    onClick={() => handleDeletePhoto(photo.id, photo.photo_url)}
                    className="p-2 bg-white rounded-full shadow-lg hover:bg-red-50 transition"
                    title="Delete photo"
                  >
                    <Trash2 size={16} className="text-red-600" />
                  </button>
                </div>
              )}
              {editingPhotoId === photo.id ? (
                <div className="p-3 bg-white border-t border-gray-200">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editCaption}
                      onChange={(e) => setEditCaption(e.target.value)}
                      placeholder="Add a caption..."
                      className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveCaption(photo.id)}
                      className="p-1 text-green-600 hover:bg-green-50 rounded"
                    >
                      <Save size={18} />
                    </button>
                    <button
                      onClick={() => {
                        setEditingPhotoId(null);
                        setEditCaption('');
                      }}
                      className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ) : photo.caption ? (
                <div className="p-3 bg-white border-t border-gray-200">
                  <p className="text-sm text-gray-700">{photo.caption}</p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {expandedPhoto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={() => setExpandedPhoto(null)}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              onClick={() => setExpandedPhoto(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition"
            >
              <X size={32} />
            </button>
            <img
              src={expandedPhoto.photo_url}
              alt={expandedPhoto.caption || 'Service provider photo'}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            {expandedPhoto.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-4 rounded-b-lg">
                <p className="text-center">{expandedPhoto.caption}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
