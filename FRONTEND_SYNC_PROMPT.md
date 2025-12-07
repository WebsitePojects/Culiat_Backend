# Frontend Sync Prompt - Document Generation System

## Overview
Frontend integration guide for the AIBarangay Document Generation system. This allows admins to generate and download DOCX certificates for approved document requests.

---

## API Endpoints

### 1. Get Available Templates
**GET** `/api/documents/templates`

No authentication required.

**Response:**
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "id": "indigency",
        "name": "Certificate of Indigency",
        "description": "Certificate confirming resident's indigent status",
        "price": 0,
        "available": true
      }
    ]
  }
}
```

---

### 2. Generate Document (Admin Only)
**POST** `/api/documents/generate/:requestId`

**Request Headers:**
```
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Response:** Binary DOCX file download

**Error Responses:**
- `400`: Request not approved
- `403`: Not authorized (non-admin)
- `404`: Request not found

---

### 3. Download Document (Resident - After Payment)
**GET** `/api/documents/download/:requestId`

**Request Headers:**
```
Authorization: Bearer <token>
```

**Response:** Binary DOCX file download

**Error Responses:**
- `402`: Payment required
- `403`: Not authorized
- `404`: Document not found

---

### 4. Check Document Status
**GET** `/api/documents/status/:requestId`

**Request Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "requestId": "abc123",
    "documentType": "indigency",
    "status": "approved",
    "paymentStatus": "paid",
    "canDownload": true,
    "amount": 0
  }
}
```

---

## Frontend Implementation

### Admin Panel - Generate Document Button

Add this to your document request details page/modal:

```jsx
// components/GenerateDocumentButton.jsx
import { useState } from 'react';
import { Download, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api from '@/lib/api'; // Your axios instance

const GenerateDocumentButton = ({ requestId, documentType, status }) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateDocument = async () => {
    if (status !== 'approved' && status !== 'completed') {
      toast.error('Document can only be generated for approved requests');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await api.post(
        `/documents/generate/${requestId}`,
        {},
        { responseType: 'blob' }
      );

      // Create download link
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition'];
      let filename = `${documentType}_certificate.docx`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Document generated successfully!');
    } catch (error) {
      console.error('Failed to generate document:', error);
      const message = error.response?.data?.message || 'Failed to generate document';
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Only show for approved/completed requests
  if (status !== 'approved' && status !== 'completed') {
    return null;
  }

  return (
    <Button
      onClick={handleGenerateDocument}
      disabled={isGenerating}
      className="gap-2"
    >
      {isGenerating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <FileText className="h-4 w-4" />
          Generate Document
        </>
      )}
    </Button>
  );
};

export default GenerateDocumentButton;
```

---

### Resident Dashboard - Download Document

```jsx
// components/DownloadDocumentButton.jsx
import { useState, useEffect } from 'react';
import { Download, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api from '@/lib/api';

const DownloadDocumentButton = ({ requestId }) => {
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    checkStatus();
  }, [requestId]);

  const checkStatus = async () => {
    try {
      const response = await api.get(`/documents/status/${requestId}`);
      setStatus(response.data.data);
    } catch (error) {
      console.error('Failed to check status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!status?.canDownload) {
      toast.error('Document not available for download');
      return;
    }

    setIsDownloading(true);
    try {
      const response = await api.get(`/documents/download/${requestId}`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `certificate_${requestId}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('Document downloaded!');
    } catch (error) {
      if (error.response?.status === 402) {
        toast.error('Please complete payment first');
      } else {
        toast.error('Failed to download document');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return <Button disabled><Loader2 className="h-4 w-4 animate-spin" /></Button>;
  }

  if (!status?.canDownload) {
    return (
      <Button disabled variant="outline" className="gap-2">
        <Lock className="h-4 w-4" />
        {status?.paymentStatus === 'unpaid' ? 'Payment Required' : 'Not Available'}
      </Button>
    );
  }

  return (
    <Button onClick={handleDownload} disabled={isDownloading} className="gap-2">
      {isDownloading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      Download Document
    </Button>
  );
};

export default DownloadDocumentButton;
```

---

### Usage in Admin Request Details

```jsx
// pages/admin/DocumentRequestDetails.jsx
import GenerateDocumentButton from '@/components/GenerateDocumentButton';

const DocumentRequestDetails = ({ request }) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">{request.documentType}</h2>
        <GenerateDocumentButton
          requestId={request._id}
          documentType={request.documentType}
          status={request.status}
        />
      </div>
      {/* ... rest of the details */}
    </div>
  );
};
```

---

## Template Placeholders Reference

Templates use `{placeholder}` syntax. Available placeholders:

| Placeholder | Description |
|-------------|-------------|
| `{salutation}` | Mr., Mrs., Ms. |
| `{full_name}` | Complete name with suffix |
| `{first_name}` | First name |
| `{middle_name}` | Middle name |
| `{last_name}` | Last name |
| `{suffix}` | Name suffix (Jr., Sr., etc.) |
| `{full_address}` | House, Street, Subdivision |
| `{house_number}` | House/Building number |
| `{street}` | Street name |
| `{subdivision}` | Subdivision/Village |
| `{date_of_birth}` | "15th day of January 1990" |
| `{age}` | Calculated age |
| `{gender}` | Gender |
| `{civil_status}` | Civil status |
| `{nationality}` | Nationality (default: Filipino) |
| `{contact_number}` | Phone number |
| `{purpose_of_request}` | Document purpose |
| `{issue_date}` | "7th day of December 2025" |
| `{control_number}` | Unique reference (e.g., IND-2025-12345) |
| `{barangay_captain}` | Captain's name |
| `{barangay_secretary}` | Secretary's name |

---

## Document Type Mapping

| documentType | Template File | Price (PHP) |
|--------------|---------------|-------------|
| `indigency` | Certificate of Indigency.docx | 0 |
| `residency` | Certificate of Residency.docx | 50 |
| `clearance` | Barangay Certificate.docx | 100 |
| `business_permit` | Certificate for Business Permit.docx | 500 |
| `business_clearance` | Certificate for Business Closure.docx | 200 |
| `good_moral` | Barangay Certificate.docx | 75 |

---

## Notes

1. **CORS**: Ensure your frontend origin is allowed in the backend CORS configuration
2. **Blob Handling**: Document downloads return binary data - use `responseType: 'blob'`
3. **Free Documents**: Certificate of Indigency is free (price: 0), no payment required
4. **Admin Only**: Only Admin/SuperAdmin roles can use the `/generate` endpoint
