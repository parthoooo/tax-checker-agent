import {
  createDocumentUpload,
  replaceDocumentUpload,
  logActivity,
} from '@/lib/db';
import { magicLinkLogActivity, magicLinkUpsertUpload } from '@/lib/magicLinkDb';
import { CURRENT_TAX_YEAR } from '@/lib/taxConfig';
import { uploadDocumentToStorage } from '@/utils/uploadDocument';

export interface PendingDocumentSlot {
  requirementId: string;
  docType: string;
  documentName: string;
  file: File;
  existingUploadId?: string;
}

export interface PersistClientDocumentPackageParams {
  clientId: string;
  taxYear: string;
  slots: PendingDocumentSlot[];
  actorName: string;
  sessionUserId?: string | null;
  magicLinkToken?: string;
}

export interface PersistClientDocumentPackageResult {
  uploadedCount: number;
  documentNames: string[];
}

export async function persistClientDocumentPackage(
  params: PersistClientDocumentPackageParams,
): Promise<PersistClientDocumentPackageResult> {
  const { clientId, taxYear, slots, actorName, sessionUserId, magicLinkToken } = params;
  const taxYearNum = parseInt(taxYear, 10);
  const documentNames: string[] = [];

  for (const slot of slots) {
    const storagePath = `clients/${clientId}/${taxYear}/${slot.docType}/${slot.file.name.replace(/\s+/g, '_')}`;
    const stored = await uploadDocumentToStorage(
      slot.file,
      clientId,
      slot.docType,
      taxYearNum,
      true,
      magicLinkToken,
    );

    if (!stored.success) {
      throw new Error(stored.error ?? `Failed to upload ${slot.file.name}`);
    }

    const uploadPayload = {
      client_id: clientId,
      requirement_id: slot.requirementId,
      file_name: slot.file.name,
      storage_path: stored.storagePath ?? storagePath,
      file_size: slot.file.size,
      mime_type: slot.file.type || null,
      ai_status: 'pending' as const,
      tax_year: taxYear,
      is_prior_year: taxYear !== CURRENT_TAX_YEAR,
      uploaded_by: sessionUserId ?? null,
    };

    if (magicLinkToken) {
      await magicLinkUpsertUpload(magicLinkToken, {
        existingUploadId: slot.existingUploadId ?? null,
        clientId,
        requirementId: slot.requirementId,
        fileName: slot.file.name,
        storagePath: stored.storagePath ?? storagePath,
        fileSize: slot.file.size,
        mimeType: slot.file.type || null,
        aiStatus: 'pending',
        taxYear,
        isPriorYear: taxYear !== CURRENT_TAX_YEAR,
      });
    } else if (slot.existingUploadId) {
      await replaceDocumentUpload(slot.existingUploadId, uploadPayload);
    } else {
      await createDocumentUpload(uploadPayload);
    }

    documentNames.push(slot.documentName);

    const action = magicLinkToken
      ? `Uploaded ${slot.file.name} via magic link portal`
      : `Uploaded ${slot.file.name}`;

    try {
      if (magicLinkToken) {
        await magicLinkLogActivity(magicLinkToken, {
          clientId,
          actor: actorName,
          actorType: 'client',
          action,
        });
      } else {
        await logActivity({
          client_id: clientId,
          actor: actorName,
          actor_type: 'client',
          action,
        });
      }
    } catch {
      // activity log is best-effort
    }
  }

  return {
    uploadedCount: slots.length,
    documentNames,
  };
}
