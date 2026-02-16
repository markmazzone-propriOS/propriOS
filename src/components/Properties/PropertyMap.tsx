import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { Property } from '../../lib/supabase';

type PropertyWithPhotos = Property & {
  photos?: { photo_url: string }[];
};

type PropertyMapProps = {
  lat?: number;
  lon?: number;
  address?: string;
  properties?: PropertyWithPhotos[];
  onPropertyClick?: (propertyId: string) => void;
};

export function PropertyMap({ lat, lon, address, properties, onPropertyClick }: PropertyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    setError(null);

    try {
      if (properties && properties.length > 0) {
        const validProperties = properties.filter(
          p => p.latitude != null && p.longitude != null
        );

        if (validProperties.length === 0) {
          setError('No properties with coordinates found');
          return;
        }

        const icon = L.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        });

        const bounds = L.latLngBounds(
          validProperties.map(p => [
            Number(p.latitude),
            Number(p.longitude)
          ] as [number, number])
        );

        const map = L.map(mapRef.current).fitBounds(bounds, { padding: [50, 50] });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
          subdomains: 'abcd',
          maxZoom: 20,
        }).addTo(map);

        validProperties.forEach(property => {
          const priceFormatted = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
          }).format(Number(property.price));

          const fullAddress = `${property.address_line1}, ${property.city}, ${property.state} ${property.zip_code}`;
          const listingTypeLabel = property.listing_type === 'sale' ? 'For Sale' : 'For Rent';
          const firstPhotoUrl = property.photos?.[0]?.photo_url || 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=400';

          const popupContent = `
            <div style="min-width: 250px; cursor: pointer;" class="property-popup" data-property-id="${property.id}">
              <img src="${firstPhotoUrl}" alt="Property" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" />
              <div style="font-weight: bold; font-size: 18px; margin-bottom: 4px;">${priceFormatted}</div>
              <div style="font-size: 14px; color: #666; margin-bottom: 4px;">${listingTypeLabel}</div>
              <div style="display: flex; gap: 12px; margin-bottom: 8px; font-size: 14px; color: #444;">
                <span>${property.bedrooms} bed</span>
                <span>${property.bathrooms} bath</span>
                <span>${property.square_footage.toLocaleString()} sqft</span>
              </div>
              <div style="font-size: 12px; color: #999; margin-bottom: 8px;">${fullAddress}</div>
              <div style="text-align: center; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                <span style="color: #2563eb; font-weight: 500; font-size: 14px;">Click to view details →</span>
              </div>
            </div>
          `;

          const marker = L.marker([Number(property.latitude), Number(property.longitude)], { icon })
            .addTo(map)
            .bindPopup(popupContent);

          marker.on('popupopen', () => {
            const popup = document.querySelector('.property-popup');
            if (popup && onPropertyClick) {
              popup.addEventListener('click', () => {
                onPropertyClick(property.id);
              });
            }
          });
        });

        mapInstanceRef.current = map;
      } else if (lat != null && lon != null && address) {
        const icon = L.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        });

        const map = L.map(mapRef.current).setView([Number(lat), Number(lon)], 15);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
          subdomains: 'abcd',
          maxZoom: 20,
        }).addTo(map);

        L.marker([Number(lat), Number(lon)], { icon })
          .addTo(map)
          .bindPopup(address)
          .openPopup();

        mapInstanceRef.current = map;
      }
    } catch (error) {
      console.error('Error initializing map:', error);
      setError('Failed to load map');
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lon, address, properties]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-lg">
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  return <div ref={mapRef} className="w-full h-full rounded-lg" />;
}
