import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, Download, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchInputSheetEntries,
  fetchDocumentUploads,
  populateInputSheet,
  verifyInputSheetEntry,
} from '@/lib/db';
import type { Database } from '@/lib/database.types';

type Entry = Database['public']['Tables']['input_sheet_entries']['Row'];

interface Props {
  clientId: string;
  taxYear?: string;
}

const SECTION_ORDER = ['W-2', '1099-NEC', '1099-INT', '1099-DIV', '1099-B', '1098', 'K-1', 'Schedule C'];

const InputSheet: React.FC<Props> = ({ clientId, taxYear = '2024' }) => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [populating, setPopulating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchInputSheetEntries(clientId, taxYear);
      setEntries(data);
    } catch {
      toast.error('Failed to load input sheet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [clientId, taxYear]);

  const handlePopulate = async () => {
    setPopulating(true);
    try {
      const uploads = await fetchDocumentUploads(clientId);
      await populateInputSheet(clientId, uploads, taxYear);
      await load();
      toast.success('Input sheet populated from uploaded documents');
    } catch {
      toast.error('Auto-population failed');
    } finally {
      setPopulating(false);
    }
  };

  const handleVerify = async (entry: Entry) => {
    try {
      await verifyInputSheetEntry(entry.id);
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, verified: true } : e));
      toast.success(`${entry.field_name} verified`);
    } catch {
      toast.error('Failed to verify field');
    }
  };

  const handleExport = () => {
    const rows = [['Section', 'Field', 'Value', 'AI Populated', 'Verified']];
    entries.forEach(e => rows.push([
      e.section, e.field_name, e.field_value ?? '', e.ai_populated ? 'Yes' : 'No', e.verified ? 'Yes' : 'No'
    ]));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `input-sheet-${taxYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Input sheet exported');
  };

  // Group entries by section
  const grouped = SECTION_ORDER.reduce<Record<string, Entry[]>>((acc, sec) => {
    const sectionEntries = entries.filter(e => e.section === sec);
    if (sectionEntries.length > 0) acc[sec] = sectionEntries;
    return acc;
  }, {});

  const totalFields = entries.length;
  const verifiedCount = entries.filter(e => e.verified).length;
  const aiCount = entries.filter(e => e.ai_populated && !e.verified).length;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handlePopulate} disabled={populating} className="gap-2">
          {populating
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Sparkles className="w-4 h-4" />}
          Auto-populate from uploads
        </Button>
        {entries.length > 0 && (
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        )}

        {totalFields > 0 && (
          <div className="flex items-center gap-2 ml-auto text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-yellow-200 inline-block" /> {aiCount} AI-populated
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-green-200 inline-block" /> {verifiedCount} verified
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-gray-100 inline-block" /> {totalFields - aiCount - verifiedCount} empty
            </span>
          </div>
        )}
      </div>

      {entries.length === 0 && (
        <Card>
          <CardContent className="pt-10 pb-10 text-center space-y-3">
            <Sparkles className="w-10 h-10 text-blue-300 mx-auto" />
            <p className="text-sm font-medium text-gray-700">No fields yet</p>
            <p className="text-sm text-gray-400">
              Click "Auto-populate from uploads" to let AI scan uploaded documents and pre-fill the input sheet.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sections */}
      {Object.entries(grouped).map(([section, sectionEntries]) => (
        <Card key={section}>
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
            <span className="font-semibold text-sm text-gray-800">{section}</span>
            <Badge variant="outline" className="text-xs">{taxYear}</Badge>
            <span className="text-xs text-gray-400 ml-auto">
              {sectionEntries.filter(e => e.verified).length}/{sectionEntries.length} verified
            </span>
          </div>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-gray-400 bg-gray-50/50">
                  <th className="py-2 px-4 text-left font-medium">Field</th>
                  <th className="py-2 px-4 text-left font-medium">Value</th>
                  <th className="py-2 px-4 text-left font-medium">Status</th>
                  <th className="py-2 px-4 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {sectionEntries.map(entry => (
                  <tr
                    key={entry.id}
                    className={`border-b last:border-0 ${
                      entry.verified         ? 'bg-green-50/40' :
                      entry.ai_populated     ? 'bg-yellow-50/60' :
                      'bg-white'
                    }`}
                  >
                    <td className="py-2.5 px-4 font-medium text-gray-700 w-48">{entry.field_name}</td>
                    <td className="py-2.5 px-4">
                      {entry.field_value
                        ? <span className="text-gray-800">{entry.field_value}</span>
                        : <span className="text-gray-300 italic text-xs">Not yet extracted</span>
                      }
                    </td>
                    <td className="py-2.5 px-4">
                      {entry.verified ? (
                        <Badge className="bg-green-100 text-green-700 text-xs gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Verified
                        </Badge>
                      ) : entry.ai_populated ? (
                        <Badge className="bg-yellow-100 text-yellow-700 text-xs gap-1">
                          <Sparkles className="w-3 h-3" /> AI-populated
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-500 text-xs">Empty</Badge>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      {!entry.verified && entry.ai_populated && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleVerify(entry)}>
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Verify
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default InputSheet;
