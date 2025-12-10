# Document Template Placeholder Reference

Use `{placeholder_name}` syntax in DOCX templates. All placeholders below are now **synced with the backend** and will work.

---

## Quick Reference by Document Type

### 📄 Certificate of Indigency (`indigency`)

| Placeholder | Description | Format |
|-------------|-------------|--------|
| `{salutation}` | Mr., Mrs., Ms. | Proper Case |
| `{full_name}` | Complete name | UPPERCASE |
| `{full_address}` | House + street | Title Case |
| `{barangay}` | Fixed: "Culiat" | - |
| `{city}` | Fixed: "Quezon City" | - |
| `{age}` | Calculated age | Number |
| `{civil_status}` | Single, Married, etc. | UPPERCASE |
| `{purpose_of_request}` | Why needed | UPPERCASE |
| `{issue_date}` | Official format | "7th day of December 2025" |
| `{control_number}` | Document ID | "IND-2025-12345" |
| `{barangay_captain}` | Captain name | UPPERCASE |
| `{barangay_secretary}` | Secretary name | UPPERCASE |

---

### 📄 Certificate of Residency (`residency`)

| Placeholder | Description | Format |
|-------------|-------------|--------|
| `{salutation}` | Mr., Mrs., Ms. | Proper Case |
| `{full_name}` | Complete name | UPPERCASE |
| `{first_name}` | First name | UPPERCASE |
| `{middle_name}` | Middle name | UPPERCASE |
| `{last_name}` | Last name | UPPERCASE |
| `{full_address}` | House + street | Title Case |
| `{house_number}` | House/Building no. | Title Case |
| `{street}` | Street name | Title Case |
| `{barangay}` | Fixed: "Culiat" | - |
| `{city}` | Fixed: "Quezon City" | - |
| `{date_of_birth}` | Birth date | "15th day of January 1990" |
| `{age}` | Calculated age | Number |
| `{nationality}` | Default: Filipino | UPPERCASE |
| `{purpose_of_request}` | Why needed | UPPERCASE |
| `{issue_date}` | Issue date | Official format |
| `{control_number}` | Document ID | "RES-2025-12345" |
| `{barangay_captain}` | Captain name | UPPERCASE |
| `{barangay_secretary}` | Secretary name | UPPERCASE |

---

### 📄 Barangay Clearance (`clearance`) & Good Moral (`good_moral`)

| Placeholder | Description | Format |
|-------------|-------------|--------|
| `{salutation}` | Mr., Mrs., Ms. | Proper Case |
| `{full_name}` | Complete name | UPPERCASE |
| `{first_name}` | First name | UPPERCASE |
| `{middle_name}` | Middle name | UPPERCASE |
| `{last_name}` | Last name | UPPERCASE |
| `{suffix}` | Jr., Sr., III | UPPERCASE |
| `{full_address}` | House + street | Title Case |
| `{house_number}` | House number | Title Case |
| `{street}` | Street name | Title Case |
| `{subdivision}` | Subdivision | Title Case |
| `{barangay}` | Fixed: "Culiat" | - |
| `{city}` | Fixed: "Quezon City" | - |
| `{date_of_birth}` | Birth date | Official format |
| `{age}` | Calculated age | Number |
| `{gender}` | Male/Female | UPPERCASE |
| `{civil_status}` | Civil status | UPPERCASE |
| `{nationality}` | Nationality | UPPERCASE |
| `{contact_number}` | Phone number | As-is |
| `{purpose_of_request}` | Why needed | UPPERCASE |
| `{issue_date}` | Issue date | Official format |
| `{control_number}` | Document ID | "CLE-2025-12345" |
| `{barangay_captain}` | Captain name | UPPERCASE |
| `{barangay_secretary}` | Secretary name | UPPERCASE |

---

### 📄 Barangay ID (`barangay_id`)

| Placeholder | Description | Format |
|-------------|-------------|--------|
| `{full_name}` | Complete name | UPPERCASE |
| `{first_name}` | First name | UPPERCASE |
| `{middle_name}` | Middle name | UPPERCASE |
| `{last_name}` | Last name | UPPERCASE |
| `{suffix}` | Jr., Sr., III | UPPERCASE |
| `{full_address}` | House + street | Title Case |
| `{barangay}` | Fixed: "Culiat" | - |
| `{city}` | Fixed: "Quezon City" | - |
| `{date_of_birth}` | Birth date | Official format |
| `{gender}` | Male/Female | UPPERCASE |
| `{civil_status}` | Civil status | UPPERCASE |
| `{contact_number}` | Phone number | As-is |
| `{emergency_contact_name}` | Emergency contact | UPPERCASE |
| `{emergency_contact_relationship}` | Relationship | UPPERCASE |
| `{emergency_contact_number}` | Contact phone | As-is |
| `{emergency_contact_address}` | Contact address | Title Case |
| `{issue_date}` | Issue date | Official format |
| `{control_number}` | ID number | "BAR-2025-12345" |

---

### 🏢 Business Permit (`business_permit`) & Business Clearance (`business_clearance`)

**Owner Information:**

| Placeholder | Description | Format |
|-------------|-------------|--------|
| `{salutation}` | Mr., Mrs., Ms. | Proper Case |
| `{full_name}` | Owner's complete name | UPPERCASE |
| `{first_name}` | Owner's first name | UPPERCASE |
| `{last_name}` | Owner's last name | UPPERCASE |
| `{full_address}` | Owner's address | Title Case |
| `{contact_number}` | Owner's phone | As-is |
| `{email_address}` | Owner's email | lowercase |

**Business Information:**

| Placeholder | Description | Format |
|-------------|-------------|--------|
| `{business_name}` | Business name | UPPERCASE |
| `{nature_of_business}` | Type of business | UPPERCASE |
| `{application_type}` | NEW or RENEWAL | UPPERCASE |

**Business Address:**

| Placeholder | Description | Format |
|-------------|-------------|--------|
| `{business_full_address}` | Business address | Title Case |
| `{business_house_number}` | Building/Unit no. | Title Case |
| `{business_street}` | Street name | Title Case |
| `{business_subdivision}` | Area/Subdivision | Title Case |
| `{business_barangay}` | Fixed: "Culiat" | - |
| `{business_city}` | Fixed: "Quezon City" | - |

**Representative:**

| Placeholder | Description | Format |
|-------------|-------------|--------|
| `{owner_representative}` | Representative name | UPPERCASE |
| `{owner_contact_number}` | Owner's phone | As-is |
| `{representative_contact_number}` | Rep's phone | As-is |

**Standard Fields:**

| Placeholder | Description | Format |
|-------------|-------------|--------|
| `{purpose_of_request}` | Purpose | UPPERCASE |
| `{issue_date}` | Issue date | Official format |
| `{control_number}` | Document ID | "BUS-2025-12345" |
| `{barangay_captain}` | Captain name | UPPERCASE |
| `{barangay_secretary}` | Secretary name | UPPERCASE |

---

### 🍺 Liquor Permit (`liquor_permit`)

Same as **Business Permit** placeholders above.

---

### ⛪ Missionary Certificate (`missionary`)

Same as **Barangay Clearance** placeholders.

---

### 🏥 Rehabilitation Certificate (`rehab`)

**Requestor Information:**
| Placeholder | Description | Format |
|-------------|-------------|--------|
| `{salutation}` | Mr., Mrs., Ms. | Proper Case |
| `{full_name}` | Requestor's complete name | UPPERCASE |
| `{full_address}` | House + street | Title Case |
| `{barangay}` | Fixed: "Culiat" | - |
| `{city}` | Fixed: "Quezon City" | - |
| `{nationality}` | Default: Filipino | UPPERCASE |

**Beneficiary Information (person requesting rehabilitation):**
| Placeholder | Description | Format |
|-------------|-------------|--------|
| `{beneficiary_name}` | Beneficiary's complete name | UPPERCASE |
| `{beneficiary_age}` | Beneficiary's age | Number |
| `{beneficiary_date_of_birth}` | Beneficiary's birth date | "Xth day of Month Year" |
| `{beneficiary_relationship}` | Relationship to requestor | UPPERCASE |

**Standard Fields:**
| Placeholder | Description | Format |
|-------------|-------------|--------|
| `{purpose_of_request}` | Purpose | UPPERCASE |
| `{issue_date}` | Issue date | Official format |
| `{control_number}` | Document ID | "REH-2025-12345" |
| `{barangay_captain}` | Captain name | UPPERCASE |
| `{barangay_secretary}` | Secretary name | UPPERCASE |

---

## All Available Placeholders (Master List)

### Personal Information
| Placeholder | Format |
|-------------|--------|
| `{salutation}` | Proper Case |
| `{full_name}` | UPPERCASE |
| `{first_name}` | UPPERCASE |
| `{middle_name}` | UPPERCASE |
| `{last_name}` | UPPERCASE |
| `{suffix}` | UPPERCASE |

### Address
| Placeholder | Format |
|-------------|--------|
| `{full_address}` | Title Case |
| `{house_number}` | Title Case |
| `{street}` | Title Case |
| `{subdivision}` | Title Case |
| `{barangay}` | Fixed: "Culiat" |
| `{city}` | Fixed: "Quezon City" |

### Demographics
| Placeholder | Format |
|-------------|--------|
| `{date_of_birth}` | "Xth day of Month Year" |
| `{place_of_birth}` | UPPERCASE |
| `{age}` | Number |
| `{gender}` | UPPERCASE |
| `{civil_status}` | UPPERCASE |
| `{nationality}` | UPPERCASE |
| `{contact_number}` | As-is |

### Additional Personal
| Placeholder | Format |
|-------------|--------|
| `{tin_number}` | As-is |
| `{sss_gsis_number}` | As-is |
| `{precinct_number}` | As-is |
| `{religion}` | UPPERCASE |
| `{height_weight}` | As-is |
| `{color_of_hair_eyes}` | As-is |
| `{occupation}` | UPPERCASE |
| `{email_address}` | As-is |
| `{request_for}` | UPPERCASE |

### Spouse Information
| Placeholder | Format |
|-------------|--------|
| `{spouse_name}` | UPPERCASE |
| `{spouse_occupation}` | UPPERCASE |
| `{spouse_contact_number}` | As-is |

### Emergency Contact
| Placeholder | Format |
|-------------|--------|
| `{emergency_contact_name}` | UPPERCASE |
| `{emergency_contact_relationship}` | UPPERCASE |
| `{emergency_contact_number}` | As-is |
| `{emergency_contact_address}` | Title Case |

### Request Info
| Placeholder | Format |
|-------------|--------|
| `{purpose_of_request}` | UPPERCASE |
| `{remarks}` | As-is |
| `{preferred_pickup_date}` | Official format |

### Document Metadata
| Placeholder | Format |
|-------------|--------|
| `{issue_date}` | "7th day of December 2025" |
| `{control_number}` | "XXX-2025-12345" |

### Officials
| Placeholder | Format |
|-------------|--------|
| `{barangay_captain}` | UPPERCASE |
| `{barangay_secretary}` | UPPERCASE |

### Business (for business documents only)
| Placeholder | Format |
|-------------|--------|
| `{business_name}` | UPPERCASE |
| `{nature_of_business}` | UPPERCASE |
| `{application_type}` | UPPERCASE |
| `{business_full_address}` | Title Case |
| `{business_house_number}` | Title Case |
| `{business_street}` | Title Case |
| `{business_subdivision}` | Title Case |
| `{business_barangay}` | Fixed: "Culiat" |
| `{business_city}` | Fixed: "Quezon City" |
| `{owner_representative}` | UPPERCASE |
| `{owner_contact_number}` | As-is |
| `{representative_contact_number}` | As-is |

---

## Template Location

```
public/Certificates and Dashboard (Culiat)/
```

## Template Files

| Type | File |
|------|------|
| `indigency` | Certificate of Indigency.docx |
| `residency` | Certificate of Residency(Quezon City Hall...).docx |
| `clearance` | Barangay Certificate.docx |
| `business_permit` | Certificate for Business Permit.docx |
| `business_clearance` | Certificate for Business Closure.docx |
| `good_moral` | Barangay Certificate.docx |
| `barangay_id` | Barangay ID.docx |
| `liquor_permit` | Certificate for Liquor Permit.docx |
| `missionary` | Certificate for Missionary.docx |
| `rehab` | Certificate for Rehab.docx |

---

## Notes

1. **Missing Data**: If data is not available, placeholder becomes empty string
2. **Date Format**: "Xth day of Month Year" (e.g., "7th day of December 2025")
3. **Control Number**: `{PREFIX}-{YEAR}-{5 DIGITS}` (e.g., "IND-2025-12345")
4. **Fixed Values**: `{barangay}` = "Culiat", `{city}` = "Quezon City"
