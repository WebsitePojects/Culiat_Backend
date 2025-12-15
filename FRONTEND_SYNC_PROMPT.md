# Frontend Sync Prompt - Document Request Services

> **Last Updated:** December 14, 2025

---

## API Endpoints

| Method | Endpoint                             | Description                 |
| ------ | ------------------------------------ | --------------------------- |
| `POST` | `/api/document-requests`             | Create new document request |
| `GET`  | `/api/document-requests/my-requests` | Get user's requests         |
| `GET`  | `/api/document-requests/:id`         | Get single request          |
| `PUT`  | `/api/document-requests/:id/status`  | Update status (admin)       |
| `GET`  | `/api/documents/download/:requestId` | Download generated document |

---

## Document Types & Required Fields

### 1. Certificate of Indigency (`indigency`) ✅ DONE

**Price:** FREE | **Photo:** No

```javascript
{
  documentType: "indigency",
  lastName, firstName, middleName,
  dateOfBirth,
  civilStatus, // single | married | widowed | separated | domestic_partner
  address: { houseNumber, street },
  purposeOfRequest,
  validID // file upload
}
```

---

### 2. Certificate of Residency (`residency`)

**Price:** ₱50 | **Photo:** YES (1x1)

```javascript
{
  documentType: "residency",
  lastName, firstName, middleName,
  dateOfBirth,
  civilStatus,
  address: { houseNumber, street },
  purposeOfRequest,

  // NEW FIELDS - Residency specific
  residencyInfo: {
    residencySince: "January 2008",    // When they started living there
    preparedBy: "Staff Name",           // Who prepared the document
    referenceNo: "RN2025-4710",         // Reference number
    documentFileNo: "DFN2025-4707"      // Document file number
  },

  photo1x1, // file upload - REQUIRED
  validID   // file upload
}
```

---

### 3. Barangay Clearance (`clearance`)

**Price:** ₱100 | **Photo:** No

```javascript
{
  documentType: "clearance",
  lastName, firstName, middleName,
  dateOfBirth,
  gender, // male | female
  civilStatus,
  address: { houseNumber, street },
  purposeOfRequest,
  validID // file upload
}
```

---

### 4. Certificate of Good Moral (`good_moral`)

**Price:** ₱75 | **Photo:** No

Same fields as Barangay Clearance.

---

### 5. Business Permit (`business_permit`)

**Price:** ₱500 | **Photo:** No

```javascript
{
  documentType: "business_permit",
  lastName, firstName, middleName, // Owner info
  fees: 500.00,  // Amount paid

  businessInfo: {
    businessName: "Store Name",
    natureOfBusiness: "RETAILING",
    applicationType: "new", // or "renewal"
    businessAddress: { houseNumber, street, subdivision },
    orNumber: "PANGKABUHAYAN"  // Official Receipt number
  },

  validID // file upload
}
```

---

### 6. Business Closure (`business_clearance`)

**Price:** ₱200 | **Photo:** No

```javascript
{
  documentType: "business_clearance",
  lastName, firstName, middleName,
  purposeOfRequest,

  businessInfo: {
    businessName: "Store Name",
    businessAddress: { houseNumber, street },
    closureDate: "2024-12-30"  // Date business ceased operations
  },

  validID // file upload
}
```

---

### 7. Barangay ID (`barangay_id`)

**Price:** ₱150 | **Photo:** No (stored but not embedded)

```javascript
{
  documentType: "barangay_id",
  lastName, firstName, middleName,
  dateOfBirth,
  gender,
  civilStatus,
  contactNumber,
  address: { houseNumber, street },

  // NEW FIELDS - Barangay ID specific
  residencyType: "renter", // owner | renter | boarder | relative | other
  precinctNumber: "1234",  // or "None"
  sssGsisNumber: "12-3456789-0", // or "None"
  tinNumber: "123-456-789",      // or "None"

  emergencyContact: {
    fullName: "Contact Name",
    relationship: "Mother",
    contactNumber: "09123456789",
    address: { houseNumber, street }
  },

  validID // file upload
}
```

---

### 8. Liquor Permit (`liquor_permit`)

**Price:** ₱300 | **Photo:** No

```javascript
{
  documentType: "liquor_permit",
  lastName, firstName, middleName,

  businessInfo: {
    businessName: "Store Name",
    businessAddress: { houseNumber, street, subdivision }
  },

  validID // file upload
}
```

---

### 9. Missionary Certificate (`missionary`)

**Price:** ₱50 | **Photo:** No

```javascript
{
  documentType: "missionary",
  lastName, firstName, middleName,
  nationality: "Vietnamese",
  address: { houseNumber, street },
  purposeOfRequest: "MISSIONARY VISA (9G)",

  // NEW FIELDS - Foreign national info
  foreignNationalInfo: {
    acrNumber: "G0000156451",       // Alien Certificate of Registration
    acrValidUntil: "2023-03-23",    // ACR validity date
    passportNumber: "C4366706"
  },

  validID // file upload
}
```

---

### 10. Rehabilitation Certificate (`rehab`) ✅ DONE

**Price:** ₱50 | **Photo:** No

```javascript
{
  documentType: "rehab",
  lastName, firstName, middleName,
  address: { houseNumber, street },
  purposeOfRequest,

  beneficiaryInfo: {
    fullName: "Beneficiary Full Name",
    dateOfBirth: "1980-05-15",
    age: 43,
    relationship: "son" // son | daughter | spouse | parent | sibling | other
  },

  validID // file upload
}
```

---

## Frontend Conditional Rendering

```jsx
// Certificate of Residency - show residency info fields
{documentType === "residency" && (
  <>
    <PhotoUploadSection required />
    <ResidencyInfoSection />
    {/* residencySince, preparedBy, referenceNo, documentFileNo */}
  </>
)}

// Barangay ID - show ID-specific fields
{documentType === "barangay_id" && (
  <>
    <ResidencyTypeSelect /> {/* owner | renter | boarder | relative | other */}
    <PrecinctNumberInput />
    <SSSGSISInput />
    <TINInput />
    <EmergencyContactSection />
  </>
)}

// Missionary - show foreign national fields
{documentType === "missionary" && (
  <ForeignNationalInfoSection />
  {/* acrNumber, acrValidUntil, passportNumber, nationality */}
)}

// Business documents
{["business_permit", "business_clearance", "liquor_permit"].includes(documentType) && (
  <BusinessInfoSection />
)}

// Business Permit specific
{documentType === "business_permit" && (
  <>
    <FeesInput />
    <ORNumberInput />
  </>
)}

// Business Closure specific
{documentType === "business_clearance" && (
  <ClosureDatePicker />
)}

// Rehab certificate
{documentType === "rehab" && (
  <BeneficiaryInfoSection />
)}
```

---

## Control Numbers (Auto-Generated on Approval)

| Document Type        | Prefix | Format         |
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

| Field      | Required For                  |
| ---------- | ----------------------------- |
| `photo1x1` | Certificate of Residency only |
| `validID`  | All document types            |
