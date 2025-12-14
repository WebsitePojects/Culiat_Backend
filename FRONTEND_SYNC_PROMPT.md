# Frontend Sync Prompt - Document Request Services

> **Complete rewrite** - This document replaces all previous content.

---

## Overview

The Document Request API supports 10 document types. Each document type has specific form fields and requirements.

---

## API Endpoints

| Method | Endpoint                             | Description                 |
| ------ | ------------------------------------ | --------------------------- |
| `POST` | `/api/document-requests`             | Create new document request |
| `GET`  | `/api/document-requests/my-requests` | Get user's requests         |
| `GET`  | `/api/document-requests/:id`         | Get single request          |
| `PUT`  | `/api/document-requests/:id/status`  | Update status (admin)       |
| `GET`  | `/api/documents/templates`           | Get available templates     |
| `GET`  | `/api/documents/download/:requestId` | Download generated document |

---

## Document Types & Form Requirements

### 1. Certificate of Indigency (`indigency`)

**Price:** FREE | **Photo Required:** No

**Required Fields:**

- `documentType`: "indigency"
- `lastName`, `firstName`, `middleName`
- `dateOfBirth`
- `civilStatus`: single | married | widowed | separated | domestic_partner
- `purposeOfRequest`
- `validID` (file upload)

**Template Placeholders:**

- `{salutation}`, `{full_name}`, `{full_address}`, `{age}`
- `{civil_status}`, `{purpose_of_request}`, `{issue_date}`
- `{control_number}`, `{barangay_captain}`, `{barangay_secretary}`

---

### 2. Certificate of Residency (`residency`)

**Price:** ₱50 | **Photo Required:** YES (1x1)

**Required Fields:**

- `documentType`: "residency"
- `lastName`, `firstName`, `middleName`
- `dateOfBirth`, `placeOfBirth`
- `gender`: male | female
- `nationality`
- `address`: { houseNumber, street, subdivision }
- `purposeOfRequest`
- `photo1x1` (file upload) **REQUIRED**
- `validID` (file upload)

**Template Placeholders:**

- `{salutation}`, `{full_name}`, `{first_name}`, `{middle_name}`, `{last_name}`
- `{full_address}`, `{house_number}`, `{street}`, `{barangay}`, `{city}`
- `{date_of_birth}`, `{age}`, `{nationality}`
- `{purpose_of_request}`, `{issue_date}`, `{control_number}`
- `{%photo_1x1%}` (image placeholder)

---

### 3. Barangay Clearance (`clearance`)

**Price:** ₱100 | **Photo Required:** No

**Required Fields:**

- `documentType`: "clearance"
- `lastName`, `firstName`, `middleName`
- `dateOfBirth`
- `gender`, `civilStatus`
- `address`: { houseNumber, street }
- `purposeOfRequest`
- `validID` (file upload)

**Template Placeholders:**

- `{salutation}`, `{full_name}`, `{first_name}`, `{middle_name}`, `{last_name}`
- `{full_address}`, `{date_of_birth}`, `{age}`, `{gender}`, `{civil_status}`
- `{purpose_of_request}`, `{issue_date}`, `{control_number}`
- `{barangay_captain}`, `{barangay_secretary}`

---

### 4. Certificate of Good Moral (`good_moral`)

**Price:** ₱75 | **Photo Required:** No

**Required Fields:**

- Same as Barangay Clearance

**Template Placeholders:**

- Same as Barangay Clearance (uses same template)

---

### 5. Business Permit Certificate (`business_permit`)

**Price:** ₱500 | **Photo Required:** No

**Required Fields:**

- `documentType`: "business_permit"
- `lastName`, `firstName`, `middleName` (owner info)
- `fees` (amount paid)
- `businessInfo`:
  - `businessName` (required)
  - `natureOfBusiness` (required)
  - `applicationType`: "new" | "renewal"
  - `businessAddress`: { houseNumber, street, subdivision }
  - `orNumber` (Official Receipt number)
- `validID` (file upload)

**Template Placeholders:**

- `{control_number}` (Brgy. Business ID No.)
- `{business_name}`, `{nature_of_business}`, `{application_type}`
- `{business_full_address}`
- `{owner_name}` (format: LASTNAME, FIRSTNAME M.)
- `{amount_paid}`, `{or_number}`
- `{issue_date}`

---

### 6. Business Closure Certificate (`business_clearance`)

**Price:** ₱200 | **Photo Required:** No

**Required Fields:**

- `documentType`: "business_clearance"
- `lastName`, `firstName` (owner info)
- `businessInfo`:
  - `businessName` (required)
  - `closureDate` (required) - Date business ceased operations
  - `businessAddress`: { houseNumber, street }
- `purposeOfRequest`
- `validID` (file upload)

**Template Placeholders:**

- `{salutation}`, `{full_name}` (requestor/owner)
- `{business_name}`, `{business_full_address}`
- `{closure_date}` (formatted: "30th day of December 2014")
- `{purpose_of_request}`, `{issue_date}`, `{control_number}`

---

### 7. Barangay ID (`barangay_id`)

**Price:** ₱150 | **Photo Required:** No (stored but not embedded)

**Required Fields:**

- `documentType`: "barangay_id"
- `lastName`, `firstName`, `middleName`
- `dateOfBirth`
- `gender`, `civilStatus`
- `address`: { houseNumber, street }
- `contactNumber`
- `emergencyContact`:
  - `fullName`
  - `relationship`
  - `contactNumber`
  - `address`: { houseNumber, street }
- `validID` (file upload)

**Template Placeholders:**

- `{full_name}`, `{full_address}`, `{date_of_birth}`, `{gender}`, `{civil_status}`
- `{contact_number}`
- `{emergency_contact_name}`, `{emergency_contact_relationship}`
- `{emergency_contact_number}`, `{emergency_contact_address}`
- `{issue_date}`, `{control_number}`

---

### 8. Liquor Permit (`liquor_permit`)

**Price:** ₱300 | **Photo Required:** No

**Required Fields:**

- Same as Business Permit

**Template Placeholders:**

- Same as Business Permit

---

### 9. Missionary Certificate (`missionary`)

**Price:** ₱50 | **Photo Required:** No

**Required Fields:**

- Same as Barangay Clearance

**Template Placeholders:**

- Same as Barangay Clearance

---

### 10. Rehabilitation Certificate (`rehab`)

**Price:** ₱50 | **Photo Required:** No

**Required Fields:**

- `documentType`: "rehab"
- `lastName`, `firstName` (requestor info)
- `address`: { houseNumber, street }
- `purposeOfRequest`
- `beneficiaryInfo`:
  - `fullName` (required)
  - `dateOfBirth` (required)
  - `age` (required)
  - `relationship`: son | daughter | spouse | parent | sibling | other
- `validID` (file upload)

**Template Placeholders:**

- `{salutation}`, `{full_name}`, `{full_address}`, `{nationality}`
- `{beneficiary_name}`, `{beneficiary_age}`, `{beneficiary_date_of_birth}`
- `{beneficiary_relationship}`
- `{purpose_of_request}`, `{issue_date}`, `{control_number}`
- `{barangay_captain}`, `{barangay_secretary}`

---

## Control Numbers

Control numbers are **automatically generated** when a request is approved:

| Document Type        | Prefix | Example        |
| -------------------- | ------ | -------------- |
| `indigency`          | IND    | IND-2025-00001 |
| `residency`          | RES    | RES-2025-00001 |
| `clearance`          | CLR    | CLR-2025-00001 |
| `good_moral`         | GMC    | GMC-2025-00001 |
| `business_permit`    | BPM    | BPM-2025-00001 |
| `business_clearance` | BCL    | BCL-2025-00001 |
| `barangay_id`        | BID    | BID-2025-00001 |
| `liquor_permit`      | LQR    | LQR-2025-00001 |
| `missionary`         | MIS    | MIS-2025-00001 |
| `rehab`              | REH    | REH-2025-00001 |

---

## File Uploads

**Supported formats:** JPG, JPEG, PNG (max 5MB)

| Field      | Usage                                  |
| ---------- | -------------------------------------- |
| `photo1x1` | 1x1 photo (required for residency)     |
| `validID`  | Valid government ID (required for all) |

**Multipart form data example:**

```javascript
const formData = new FormData();
formData.append("documentType", "residency");
formData.append("lastName", "Dela Cruz");
formData.append("firstName", "Juan");
formData.append("photo1x1", file1x1);
formData.append("validID", fileValidID);
```

---

## Frontend Form Components

### Conditional Rendering

```jsx
// Business documents
{
  ["business_permit", "business_clearance", "liquor_permit"].includes(
    documentType
  ) && <BusinessInfoSection />;
}

// Rehab certificate
{
  documentType === "rehab" && <BeneficiaryInfoSection />;
}

// Residency certificate - requires photo
{
  documentType === "residency" && <PhotoUploadSection required />;
}
```

---

## Response Structure

**Request Created:**

```json
{
  "success": true,
  "message": "Document request created successfully",
  "data": {
    "_id": "...",
    "documentType": "indigency",
    "status": "pending",
    "controlNumber": null,
    "createdAt": "2025-12-14T..."
  }
}
```

**After Approval:**

```json
{
  "success": true,
  "data": {
    "_id": "...",
    "documentType": "indigency",
    "status": "approved",
    "controlNumber": "IND-2025-00001",
    "processedAt": "2025-12-14T..."
  }
}
```
