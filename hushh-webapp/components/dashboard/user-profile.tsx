// components/dashboard/user-profile.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/lib/morphy-ux/morphy';
import { Badge } from '@/components/ui/badge';
import { LogOut, Shield, ShieldCheck, Calendar, Clock } from 'lucide-react';

interface UserData {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  emailVerified: boolean;
  phoneNumber?: string;
  creationTime?: string;
  lastSignInTime?: string;
  providerData?: any[];
}

export function UserProfile() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);

  useEffect(() => {
    const uid = sessionStorage.getItem('user_uid') || '';
    const email = sessionStorage.getItem('user_email') || '';
    const displayName = sessionStorage.getItem('user_displayName') || '';
    const photoURL = sessionStorage.getItem('user_photo');
    const emailVerified = sessionStorage.getItem('user_emailVerified') === 'true';
    const phoneNumber = sessionStorage.getItem('user_phoneNumber');
    const creationTime = sessionStorage.getItem('user_creationTime');
    const lastSignInTime = sessionStorage.getItem('user_lastSignInTime');
    const providerDataStr = sessionStorage.getItem('user_providerData');
    
    if (!uid) {
      router.push('/login');
      return;
    }

    setUserData({
      uid,
      email,
      displayName: displayName || email.split('@')[0],
      photoURL: photoURL ||undefined,
      emailVerified,
      phoneNumber: phoneNumber || undefined,
      creationTime: creationTime || undefined,
      lastSignInTime: lastSignInTime || undefined,
      providerData: providerDataStr ? JSON.parse(providerDataStr) : []
    });
  }, [router]);

  const handleLogout = () => {
    sessionStorage.clear();
    router.push('/login');
  };

  if (!userData) return null;

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 ring-2 ring-primary/20">
              {userData.photoURL && <AvatarImage src={userData.photoURL} alt={userData.displayName} />}
              <AvatarFallback className="text-2xl bg-gradient-to-br from-blue-500 to-purple-600 dark:from-gray-400 dark:to-gray-600 text-white">
                {userData.displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-3xl font-bold">{userData.displayName}</h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-muted-foreground">{userData.email}</p>
                {userData.emailVerified ? (
                  <Badge className="bg-green-500 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Unverified
                  </Badge>
                )}
              </div>
              {userData.phoneNumber && (
                <p className="text-sm text-muted-foreground mt-1">📱 {userData.phoneNumber}</p>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Account Info */}
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Member Since</span>
            </div>
            <p className="text-sm text-muted-foreground">{formatDate(userData.creationTime)}</p>
          </div>

          {/* Last Sign In */}
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Last Sign In</span>
            </div>
            <p className="text-sm text-muted-foreground">{formatDate(userData.lastSignInTime)}</p>
          </div>

          {/* Provider */}
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Auth Provider</span>
            </div>
            <p className="text-sm text-muted-foreground capitalize">
              {userData.providerData?.[0]?.providerId.replace('.com', '') || 'Unknown'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
