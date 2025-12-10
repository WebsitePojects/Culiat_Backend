# Frontend Sync Prompt - Certificate for Rehab

## Overview

New document type added: **Rehabilitation Certificate (`rehab`)** - for requesting rehabilitation assistance on behalf of a family member.

---

## New Document Type

| documentType | Template File | Price (PHP) |
|--------------|---------------|-------------|
| `rehab` | Certificate for Rehab.docx | 50 |

---

## New Schema: `beneficiaryInfo`

When `documentType === "rehab"`, the request must include beneficiary information:

```javascript
beneficiaryInfo: {
  fullName: String,      // Beneficiary's full name (e.g., "GILBERT BENGCO LEAL")
  dateOfBirth: Date,     // Beneficiary's date of birth
  age: Number,           // Beneficiary's age (e.g., 43)
  relationship: String   // Relationship to requestor (e.g., "son", "daughter")
}
```

---

## API Request Example

**POST** `/api/document-requests`

```json
{
  "documentType": "rehab",
  "purposeOfRequest": "Rehabilitation Requirements",
  "beneficiaryInfo": {
    "fullName": "GILBERT BENGCO LEAL",
    "dateOfBirth": "1978-04-21",
    "age": 43,
    "relationship": "son"
  }
}
```

---

## New Template Placeholders

| Placeholder | Description | Format |
|-------------|-------------|--------|
| `{beneficiary_name}` | Beneficiary's complete name | UPPERCASE |
| `{beneficiary_age}` | Beneficiary's age | Number |
| `{beneficiary_date_of_birth}` | Beneficiary's birth date | "Xth day of Month Year" |
| `{beneficiary_relationship}` | Relationship to requestor | UPPERCASE |

---

## Frontend Form Requirements

Add beneficiary fields when `documentType === "rehab"`:

```jsx
{documentType === 'rehab' && (
  <div className="space-y-4">
    <h3>Beneficiary Information</h3>
    <Input
      name="beneficiaryInfo.fullName"
      label="Beneficiary Full Name"
      placeholder="Enter beneficiary's full name"
      required
    />
    <Input
      name="beneficiaryInfo.dateOfBirth"
      type="date"
      label="Date of Birth"
      required
    />
    <Input
      name="beneficiaryInfo.age"
      type="number"
      label="Age"
      required
    />
    <Select
      name="beneficiaryInfo.relationship"
      label="Relationship to You"
      options={[
        { value: 'son', label: 'Son' },
        { value: 'daughter', label: 'Daughter' },
        { value: 'spouse', label: 'Spouse' },
        { value: 'parent', label: 'Parent' },
        { value: 'sibling', label: 'Sibling' },
        { value: 'other', label: 'Other' }
      ]}
      required
    />
  </div>
)}
```

---

## Notes

1. The rehab certificate is for requesting rehabilitation assistance for a beneficiary (e.g., son, daughter)
2. The requestor's information is auto-filled from user profile
3. The beneficiary is the person who will undergo rehabilitation
