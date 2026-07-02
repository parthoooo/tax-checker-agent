import React from 'react';
import { APP_NAME } from '@/lib/branding';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Clock, Loader2, RefreshCw } from 'lucide-react';
import type { ApprovalStatus } from '@/contexts/AuthContext';

interface PendingAccessScreenProps {
  status: ApprovalStatus;
  email: string;
  onRefresh: () => Promise<void>;
  onLogout: () => void;
  refreshing?: boolean;
}

const PendingAccessScreen: React.FC<PendingAccessScreenProps> = ({
  status,
  email,
  onRefresh,
  onLogout,
  refreshing = false,
}) => {
  const isRejected = status === 'rejected';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-8 pb-8 space-y-4">
          {isRejected ? (
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          ) : (
            <Clock className="w-10 h-10 text-amber-500 mx-auto" />
          )}
          <h2 className="text-lg font-semibold">
            {isRejected ? 'Access not approved' : 'Awaiting admin approval'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isRejected
              ? 'Your sign-up request was not approved. Contact your tax preparer if you believe this is an error.'
              : `Thanks for signing up with ${email}. A ${APP_NAME} administrator will review your account and assign access (client portal, preparer, or admin). You'll be able to upload documents once approved.`}
          </p>
          {!isRejected && (
            <p className="text-xs text-muted-foreground">
              Signed up with Google or email? Both go through the same approval queue.
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            {!isRejected && (
              <Button variant="default" onClick={onRefresh} disabled={refreshing}>
                {refreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Check status
              </Button>
            )}
            <Button variant="outline" onClick={onLogout}>Sign out</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingAccessScreen;
