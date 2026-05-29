export interface MockClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  documentsSubmitted: number;
  documentsRequired: number;
  status: 'active' | 'overdue' | 'complete';
  issues: number;
  assignedStaff: string;
  lastActivity: string;
}

export const mockClients: MockClient[] = [
  { id: 'john-smith', name: 'John Smith', email: 'john@email.com', phone: '(555) 123-4567', documentsSubmitted: 3, documentsRequired: 4, status: 'active', issues: 2, assignedStaff: 'Shawn', lastActivity: '2 hours ago' },
  { id: 'michael-brown', name: 'Michael Brown', email: 'mbrown@email.com', phone: '(555) 234-5678', documentsSubmitted: 1, documentsRequired: 4, status: 'overdue', issues: 1, assignedStaff: 'Girik', lastActivity: '1 day ago' },
  { id: 'sarah-johnson', name: 'Sarah Johnson', email: 'sjohnson@email.com', phone: '(555) 345-6789', documentsSubmitted: 2, documentsRequired: 4, status: 'active', issues: 1, assignedStaff: 'Shawn', lastActivity: '3 hours ago' },
  { id: 'robert-chen', name: 'Robert Chen', email: 'rchen@email.com', phone: '(555) 456-7890', documentsSubmitted: 0, documentsRequired: 4, status: 'overdue', issues: 0, assignedStaff: 'Girik', lastActivity: '5 days ago' },
  { id: 'maria-rodriguez', name: 'Maria Rodriguez', email: 'mrodriguez@email.com', phone: '(555) 567-8901', documentsSubmitted: 4, documentsRequired: 4, status: 'complete', issues: 0, assignedStaff: 'Shawn', lastActivity: '30 minutes ago' },
];

export const initials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

export const statusBadge = (s: MockClient['status']) =>
  s === 'complete' ? 'bg-green-100 text-green-800'
  : s === 'overdue' ? 'bg-red-100 text-red-800'
  : 'bg-blue-100 text-blue-800';
