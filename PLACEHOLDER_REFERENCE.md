# Document Template Placeholder Reference

This document defines the standard placeholders for DOCX templates in the AIBarangay Document Generation System.

## Usage

Use `{placeholder_name}` syntax in your DOCX templates. The system will replace these with actual data from the document request.

---

## Standard Placeholders

### Personal Information

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{salutation}` | Mr., Mrs., Ms. (based on gender/civil status) | "Mr." |
| `{full_name}` | Complete name with suffix | "Juan Santos Dela Cruz Jr." |
| `{first_name}` | First name only | "Juan" |
| `{middle_name}` | Middle name only | "Santos" |
| `{last_name}` | Last name only | "Dela Cruz" |
| `{suffix}` | Suffix (Jr., Sr., III, etc.) | "Jr." |

### Address Information

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{full_address}` | Complete address with barangay and city | "123 MAIN ST., GREEN VILLAGE, BARANGAY CULIAT, QUEZON CITY" |
| `{house_number}` | House/Building number | "123" |
| `{street}` | Street name | "MAIN STREET" |
| `{subdivision}` | Subdivision/Barangay | "GREEN VILLAGE" |
| `{barangay}` | Barangay name | "CULIAT" |
| `{city}` | City name | "QUEZON CITY" |


### Demographics

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{date_of_birth}` | Official format date | "15th day of January 1990" |
| `{age}` | Calculated current age | "34" |
| `{gender}` | Gender (capitalized) | "Male" |
| `{civil_status}` | Civil status (formatted) | "Single" |
| `{nationality}` | Nationality (default: Filipino) | "Filipino" |
| `{contact_number}` | Phone number | "09171234567" |

### Request Information

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{purpose_of_request}` | Why they need this document | "scholarship application" |

### Document Metadata

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{issue_date}` | Official format issue date | "7th day of December 2025" |
| `{control_number}` | Unique document reference | "IND-2025-12345" |

### Barangay Officials

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{barangay_captain}` | Barangay Captain's name | "HON. CAPTAIN NAME" |
| `{barangay_secretary}` | Secretary's name | "SECRETARY NAME" |

---

## Notes

1. **Static Values**: "Barangay Culiat" and "Quezon City" should be hardcoded directly in your DOCX templates since they never change.

2. **Missing Data**: If a placeholder's data is not available, it will be replaced with an empty string.

3. **Date Format**: All dates use the official Philippine government format: "Xth day of Month Year"

4. **Control Number Format**: `{TYPE PREFIX}-{YEAR}-{RANDOM 5 DIGITS}` (e.g., "IND-2025-12345")

---

## Template Location

Templates are stored in:
```
public/Certificates and Dashboard (Culiat)/
```

## Available Templates

| Document Type | Template File |
|--------------|---------------|
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
