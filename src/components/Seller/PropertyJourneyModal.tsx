import { PropertyJourneyTracker } from './PropertyJourneyTracker';

interface PropertyJourneyModalProps {
  propertyId: string;
  propertyAddress: string;
  onClose: () => void;
}

export function PropertyJourneyModal({ propertyId, propertyAddress, onClose }: PropertyJourneyModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="max-w-6xl w-full my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <PropertyJourneyTracker
          propertyId={propertyId}
          propertyAddress={propertyAddress}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
