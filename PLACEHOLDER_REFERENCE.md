# Document Template Placeholder Reference

Use `{placeholder_name}` syntax in DOCX templates. For images use `{%image_name%}`.

---

## ⚡ Quick Copy-Paste Placeholders by Document

> **Note:** Indigency and Rehab templates are already configured.

---

### 📄 Certificate of Residency (`residency`)

**File:** `Certificate of Residency(Quezon City Hall...).docx`

**Copy these placeholders into your template:**

```
{salutation}
{full_name}
{date_of_birth}
{civil_status}
{full_address}
{residency_since}
{purpose_of_request}
{issue_date}
{issued_on}
{valid_until}
{prepared_by}
{reference_no}
{document_file_no}
{control_number}
{barangay_captain}
{%photo_1x1%}
```

**Your Template Example:**

```
...certify that {salutation} {full_name}, born on {date_of_birth}, {civil_status}, is a bonafide resident of {full_address}, Barangay Culiat, Quezon City since {residency_since} up to present.

...issued upon the request of the above-named person as a supporting document for {purpose_of_request}.

Issued this {issue_date}...

APPLICANT'S PHOTO        APPLICANT'S THUMBMARK
{%photo_1x1%}

Issued at : BARANGAY CULIAT HALL
Issued on : {issued_on}
Valid until: {valid_until}

Prepared by: {prepared_by}   Reference no: {reference_no}   Document file: {document_file_no}
```

> **Photo:** Use `{%photo_1x1%}` where the 1x1 photo should appear (image placeholder)

---

### 📄 Barangay Clearance (`clearance`)

**File:** `Barangay Certificate.docx`

**Copy these placeholders into your template:**

```
{salutation}
{full_name}
{first_name}
{middle_name}
{last_name}
{suffix}
{full_address}
{house_number}
{street}
{subdivision}
{barangay}
{city}
{date_of_birth}
{age}
{gender}
{civil_status}
{nationality}
{contact_number}
{purpose_of_request}
{issue_date}
{control_number}
{barangay_captain}
{barangay_secretary}
```

---

### 📄 Certificate of Good Moral (`good_moral`)

**File:** `Barangay Certificate.docx` (same as clearance)

**Same placeholders as Barangay Clearance above.**

---

### 📄 Barangay ID (`barangay_id`)

**File:** `Barangay ID.docx`

**Copy these placeholders into your template:**

```
{full_name}
{full_address}
{birth_date_short}
{gender}
{civil_status}
{residency_type}
{precinct_no}
{sss_gsis_no}
{tin_no}
{id_number}
{issue_date_short}
{expiration_date}
{barangay_captain}
{emergency_contact_name}
{emergency_contact_relationship}
{emergency_contact_number}
{emergency_contact_address}
```

**Your Template Example:**

```
{full_name}
Address: {full_address}    Birth Date: {birth_date_short}    Gender: {gender}
Status: {civil_status}     Residency: {residency_type}
Precinct No: {precinct_no}     SSS/GSIS No: {sss_gsis_no}    TIN No: {tin_no}

ID No: {id_number}

Date of Issue: {issue_date_short}
Date of Expiration: {expiration_date}    {barangay_captain}
                                         Punong Barangay

IN CASE OF EMERGENCY PLEASE NOTIFY:
Name: {emergency_contact_name}    Relationship: {emergency_contact_relationship}
Contact No: {emergency_contact_number}
Address: {emergency_contact_address}
```

---

### 🏢 Business Permit (`business_permit`)

**File:** `Certificate for Business Permit.docx`

**Copy these placeholders into your template:**

```
{control_number}
{business_name}
{business_full_address}
{nature_of_business}
{application_type}
{owner_name}
{amount_paid}
{or_number}
{issue_date}
{barangay_captain}
{barangay_secretary}
```

**Your Template Example:**

```
Brgy. Business ID No. : {control_number}

Business Name    : {business_name}
Business Address : {business_full_address} BRGY. CULIAT QC
Business Type    : {nature_of_business}
Status           : {application_type}

Owners Name      : {owner_name}     Amount Paid : {amount_paid}
OR No.           : {or_number}

Given this {issue_date} at Barangay Culiat...
```

---

### 🏢 Business Closure (`business_clearance`)

**File:** `Certificate for Business Closure.docx`

**Copy these placeholders into your template:**

```
{salutation}
{full_name}
{business_name}
{business_full_address}
{closure_date}
{purpose_of_request}
{issue_date}
{control_number}
{barangay_captain}
{barangay_secretary}
```

**Your Template Example:**

```
...has cease its operation in this barangay effective {closure_date}...

...upon the request of {salutation} {full_name}, Owner of the above-mentioned establishment as requirement for {purpose_of_request}.

Issued this {issue_date}...
```

---

### 🍺 Liquor Permit (`liquor_permit`)

**File:** `Certificate for Liquor Permit.docx`

**Copy these placeholders into your template:**

```
{full_name}
{business_name}
{business_full_address}
{issue_date}
{control_number}
{barangay_captain}
{barangay_secretary}
```

**Your Template Example:**

```
...interposed no objection to the liquor permit application of {full_name}, owner of {business_name}, located at {business_full_address}, CULIAT QC...

Given this {issue_date} at Barangay Culiat...
```

---

### ⛪ Missionary Certificate (`missionary`)

**File:** `Certificate for Missionary.docx`

**Copy these placeholders into your template:**

```
{salutation}
{full_name}
{full_address}
{acr_number}
{acr_valid_until}
{passport_number}
{nationality}
{purpose_of_request}
{issue_date}
{control_number}
{barangay_captain}
{barangay_secretary}
```

**Your Template Example:**

```
...certify that {salutation} {full_name}, of legal age, with postal address at {full_address}, Brgy. Culiat QC...

ACR No.      : {acr_number}
Valid Until  : {acr_valid_until}
Passport No. : {passport_number}
Nationality  : {nationality}

...issued upon the request of {salutation} {full_name} as one of the requirements to renew his/her {purpose_of_request} from the Bureau of Immigration...

Issued this {issue_date} in Barangay Culiat...
```

---

## Control Number Prefixes

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

## Placeholder Format Reference

| Placeholder        | Format      | Example                   |
| ------------------ | ----------- | ------------------------- |
| `{salutation}`     | Proper Case | Mr., Mrs., Ms.            |
| `{full_name}`      | UPPERCASE   | JUAN DELA CRUZ            |
| `{full_address}`   | Title Case  | 123 Main Street           |
| `{date_of_birth}`  | Official    | 15th day of January 1990  |
| `{issue_date}`     | Official    | 14th day of December 2025 |
| `{control_number}` | Standard    | RES-2025-00001            |
| `{barangay}`       | Fixed       | Culiat                    |
| `{city}`           | Fixed       | Quezon City               |

---

## Template Location

```
public/Certificates and Dashboard (Culiat)/
```

## Notes

1. **Missing Data**: Placeholder becomes empty string if data unavailable
2. **Image Placeholder**: Use `{%photo_1x1%}` syntax (with %) for photos
3. **Photo Required**: Only Certificate of Residency requires photo embedding
