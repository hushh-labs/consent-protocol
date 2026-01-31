// components/kai/check-in-placeholder.tsx

/**
 * Check-In Feature Placeholder
 *
 * Coming Soon feature for location-based context sharing.
 *
 * Future implementation notes:
 * - Request location permission via Capacitor Geolocation
 * - Reverse geocode to get place name
 * - Ask user "What is this location?" (home, work, gym, etc.)
 * - Store in world model as attr.lifestyle.locations
 */

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Lock } from "lucide-react";

interface CheckInPlaceholderProps {
  className?: string;
}

export function CheckInPlaceholder({ className }: CheckInPlaceholderProps) {
  return (
    <Card className={`crystal-glass opacity-60 cursor-not-allowed ${className}`}>
      <CardContent className="flex items-center gap-4 p-4">
        {/* Icon */}
        <div className="h-12 w-12 shrink-0 rounded-ios flex items-center justify-center bg-muted/50">
          <MapPin className="h-6 w-6 text-muted-foreground" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Check-In</h3>
            <Badge variant="outline" className="text-xs">
              Coming Soon
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Share your location context with Kai
          </p>
        </div>

        {/* Lock Icon */}
        <Lock className="h-5 w-5 text-muted-foreground/50 shrink-0" />
      </CardContent>
    </Card>
  );
}

/**
 * Check-In Modal (for future implementation)
 *
 * This will be shown when the feature is enabled.
 */
export function CheckInModal({
  isOpen,
  onClose,
  onCheckIn,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCheckIn: (location: { name: string; type: string; coordinates?: { lat: number; lng: number } }) => void;
}) {
  // TODO: Implement when feature is ready
  // 1. Request location permission
  // 2. Get current coordinates
  // 3. Reverse geocode to get place name
  // 4. Show UI to confirm/edit location name
  // 5. Ask user to categorize (home, work, gym, restaurant, etc.)
  // 6. Call onCheckIn with location data

  return null;
}

/**
 * Location type options for categorization
 */
export const LOCATION_TYPES = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "work", label: "Work", icon: "💼" },
  { id: "gym", label: "Gym", icon: "🏋️" },
  { id: "restaurant", label: "Restaurant", icon: "🍽️" },
  { id: "cafe", label: "Café", icon: "☕" },
  { id: "store", label: "Store", icon: "🛒" },
  { id: "entertainment", label: "Entertainment", icon: "🎬" },
  { id: "travel", label: "Travel", icon: "✈️" },
  { id: "other", label: "Other", icon: "📍" },
] as const;
