
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  FileText,
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
  MessageSquare,
  Trash2,
  Archive,
} from 'lucide-react';

interface ClientDetailModalProps {
  clientId: string;
  onClose: () => void;
}

interface DocumentFile {
  id: string;
  name: string;
  type: string;
  year: string;
  fileName: string;
  uploadDate: string;
  size: string;
  status: 'submitted' | 'flagged' | 'approved';
  uploader: string;
}

interface ActivityItem {
  id: string;
  type: 'upload' | 'message' | 'status_change';
  description: string;
  timestamp: string;
  user: string;
}

const ClientDetailModal: React.FC<ClientDetailModalProps> = ({ clientId, onClose }) => {
  const navigate = useNavigate();
  const [documents] = useState<DocumentFile[]>([
    {
      id: '1',
      name: '1099 Form',
      type: '1099',
      year: '2023',
      fileName: '1099-2023.pdf',
      uploadDate: '2024-01-15',
      size: '2.4 MB',
      status: 'submitted',
      uploader: 'John Smith'
    },
    {
      id: '2',
      name: 'W-2 Form',
      type: 'w2',
      year: '2024',
      fileName: 'w2-duplicate.pdf',
      uploadDate: '2024-01-14',
      size: '1.8 MB',
      status: 'flagged',
      uploader: 'John Smith'
    }
  ]);

  const [activities] = useState<ActivityItem[]>([
    {
      id: '1',
      type: 'upload',
      description: 'Uploaded 1099 Form (2023)',
      timestamp: '2024-01-15 10:30 AM',
      user: 'John Smith'
    },
    {
      id: '2',
      type: 'upload',
      description: 'Uploaded W-2 Form (2024) - Flagged as duplicate',
      timestamp: '2024-01-14 2:15 PM',
      user: 'John Smith'
    },
    {
      id: '3',
      type: 'message',
      description: 'Sent message: "Please upload missing bank statement"',
      timestamp: '2024-01-13 9:45 AM',
      user: 'Admin Team'
    }
  ]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'approved': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'flagged': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'flagged': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-8">
          <span>Client Details: John Smith</span>
          <Button
            size="sm"
            variant="outline"
            className="text-xs shrink-0"
            onClick={() => { onClose(); navigate(`/vault?client=${clientId}`); }}
          >
            <Archive className="w-3.5 h-3.5 mr-1" />
            Open in Vault →
          </Button>
        </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="documents" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
            <TabsTrigger value="communication">Messages</TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Document Files</h3>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Download All
              </Button>
            </div>
            
            <div className="grid gap-4">
              {documents.map((doc) => (
                <Card key={doc.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(doc.status)}
                        <div>
                          <h4 className="font-medium">{doc.name} ({doc.year})</h4>
                          <p className="text-sm text-gray-500">
                            {doc.fileName} • {doc.size} • Uploaded {new Date(doc.uploadDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(doc.status)}>
                          {doc.status}
                        </Badge>
                        <Button variant="ghost" size="sm">
                          <Download className="w-4 h-4" />
                        </Button>
                        {doc.status === 'flagged' && (
                          <Button variant="ghost" size="sm">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {doc.status === 'flagged' && (
                      <div className="mt-3 p-3 bg-red-50 rounded-lg">
                        <p className="text-sm text-red-700">
                          <strong>Issue:</strong> This appears to be a duplicate file. Please verify and remove if necessary.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <h3 className="text-lg font-medium">Activity Timeline</h3>
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex gap-4 p-4 border rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    {activity.type === 'upload' && <FileText className="w-4 h-4 text-blue-600" />}
                    {activity.type === 'message' && <MessageSquare className="w-4 h-4 text-blue-600" />}
                    {activity.type === 'status_change' && <CheckCircle className="w-4 h-4 text-blue-600" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{activity.description}</p>
                    <p className="text-sm text-gray-500">
                      {activity.timestamp} • by {activity.user}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="communication" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Client Communication</h3>
              <Button>
                <MessageSquare className="w-4 h-4 mr-2" />
                Send Message
              </Button>
            </div>
            
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Admin Team</span>
                      <span className="text-sm text-gray-500">Jan 13, 2024 9:45 AM</span>
                    </div>
                    <p className="text-sm">
                      Hi John, we noticed you're missing your bank statement for 2024. 
                      Please upload this document to complete your submission. Let us know if you need any assistance.
                    </p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">John Smith</span>
                      <span className="text-sm text-gray-500">Jan 12, 2024 3:20 PM</span>
                    </div>
                    <p className="text-sm">
                      Thank you for the quick response. I'll have the remaining documents uploaded by end of week.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ClientDetailModal;
