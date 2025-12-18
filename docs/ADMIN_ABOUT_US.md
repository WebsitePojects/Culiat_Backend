# Admin - About Us Module Documentation

This document explains how the **About Us** section works in the admin panel, including Barangay Information management and Officials management with cloud image uploads.

---

## Table of Contents

1. [Overview](#overview)
2. [Barangay Information (CMS About Us)](#barangay-information-cms-about-us)
3. [Barangay Officials Management](#barangay-officials-management)
4. [Cloudinary Integration](#cloudinary-integration)
5. [API Endpoints](#api-endpoints)
6. [Database Models](#database-models)
7. [Frontend Components](#frontend-components)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The About Us admin module consists of two main parts:

| Module | Purpose | Admin Route |
|--------|---------|-------------|
| **Barangay Information** | Manage general info (name, mission, vision, history, demographics) | `/admin/cms/about-us` |
| **Barangay Officials** | Manage officials with photos uploaded to cloud | `/admin/officials` |

Both modules use a **singleton pattern** for barangay info (only one record) and a **collection pattern** for officials (multiple records).

---

## Barangay Information (CMS About Us)

### What It Manages

- **Basic Info**: Barangay name, description
- **Mission & Vision**: Statements displayed on the About page
- **History**: Full history content (supports paragraphs)
- **Address**: Street, municipality, province, region, zip code
- **Contact Info**: Phone number and email
- **Demographics**: Population, households, public projects, area
- **Social Media**: Facebook, Twitter, Instagram, YouTube links
- **Media Assets**: Logo URL, Cover Photo URL

### How It Works

1. **First Time Setup**: When no barangay info exists in the database, the admin sees an info message and can fill in the form to create the initial record.

2. **Subsequent Edits**: Once created, the form loads existing data and updates are saved via PUT request.

3. **Singleton Pattern**: Only ONE barangay info document exists in the database. The `findOne()` method retrieves it without needing an ID.

### Admin Workflow

```
1. Navigate to: Admin Panel → Content Management → About Us
2. Fill in/edit the form fields
3. Click "Save All Changes"
4. Changes reflect immediately on the public About page
```

---

## Barangay Officials Management

### What It Manages

- **Personal Info**: First name, middle name, last name
- **Position**: Barangay Captain, Kagawad, SK Chairman, Secretary, Treasurer, etc.
- **Committee**: Optional committee assignment
- **Contact Number**: Phone number (internal use)
- **Bio**: Short description
- **Photo**: Uploaded to Cloudinary cloud storage
- **Display Order**: Controls the order officials appear on the website
- **Active Status**: Toggle visibility without deleting

### Supported Positions

| Value | Display Label |
|-------|---------------|
| `barangay_captain` | Barangay Captain |
| `barangay_kagawad` | Barangay Kagawad |
| `sk_chairman` | SK Chairman |
| `barangay_secretary` | Barangay Secretary |
| `barangay_treasurer` | Barangay Treasurer |
| `administrative_officer` | Administrative Officer |
| `deputy_officer` | Deputy Officer |
| `other` | Other |

### Admin Workflow

```
1. Navigate to: Admin Panel → Content Management → Officials
2. Click "Add Official" to create new
3. Fill in name, position, upload photo
4. Set display order (lower = appears first)
5. Toggle Active status to show/hide on website
6. Click Save
```

### Photo Upload Process

1. Admin selects an image file (JPG, JPEG, or PNG, max 5MB)
2. Image is previewed in the form
3. On save, image is uploaded to Cloudinary
4. Cloudinary returns a URL that's stored in the database
5. When updating, the old image is automatically deleted from Cloudinary

---

## Cloudinary Integration

### Configuration

The backend uses Cloudinary for cloud image storage. Configure in `.env`:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Folder Structure in Cloudinary

```
culiat-barangay/
├── officials/          # Official photos
├── barangay/           # Logo and cover photos
├── achievements/       # Achievement images
├── photos/             # General photos
├── documents/          # Document files
├── proofs/             # Proof of residency
└── validIDs/           # Valid ID uploads
```

### Key Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `createCloudinaryStorage(folder)` | `config/cloudinary.js` | Creates storage config for a folder |
| `deleteFromCloudinary(publicId)` | `config/cloudinary.js` | Deletes an image by public ID |
| `getPublicIdFromUrl(url)` | `config/cloudinary.js` | Extracts public ID from Cloudinary URL |

### File Upload Middleware

The `middleware/fileUpload.js` handles:

- **Field name mapping**: `officialPhoto` → `officials` folder
- **File validation**: Only JPG, JPEG, PNG allowed
- **Size limit**: 5MB maximum
- **Fallback**: Uses local disk storage if Cloudinary is not configured

---

## API Endpoints

### Barangay Information

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/barangay-info` | Public | Get barangay information |
| POST | `/api/barangay-info` | SuperAdmin | Create initial barangay info |
| PUT | `/api/barangay-info` | Admin | Update barangay info |
| PUT | `/api/barangay-info/demographics` | Admin | Update demographics only |
| PUT | `/api/barangay-info/contact` | Admin | Update contact info only |
| PUT | `/api/barangay-info/address` | Admin | Update address only |
| PUT | `/api/barangay-info/social-media` | Admin | Update social media only |
| DELETE | `/api/barangay-info` | SuperAdmin | Delete barangay info |

### Officials

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/officials` | Public | Get all officials |
| GET | `/api/officials/active` | Public | Get active officials only |
| GET | `/api/officials/position/:position` | Public | Get officials by position |
| GET | `/api/officials/:id` | Public | Get single official |
| POST | `/api/officials` | Admin | Create official (with photo upload) |
| PUT | `/api/officials/:id` | Admin | Update official (with photo upload) |
| PUT | `/api/officials/:id/toggle-active` | Admin | Toggle active status |
| PUT | `/api/officials/reorder` | Admin | Bulk update display order |
| DELETE | `/api/officials/:id` | Admin | Delete official |
| GET | `/api/officials/stats/all` | Admin | Get officials statistics |

### Request/Response Examples

#### Create Official (with photo)
```javascript
// Request: POST /api/officials
// Content-Type: multipart/form-data

const formData = new FormData();
formData.append('firstName', 'Juan');
formData.append('lastName', 'Dela Cruz');
formData.append('position', 'barangay_captain');
formData.append('officialPhoto', fileInput.files[0]);

// Response
{
  "success": true,
  "message": "Official created successfully",
  "data": {
    "_id": "...",
    "firstName": "Juan",
    "lastName": "Dela Cruz",
    "position": "barangay_captain",
    "photo": "https://res.cloudinary.com/.../officialPhoto-123456789.jpg",
    "isActive": true,
    "displayOrder": 0
  }
}
```

---

## Database Models

### BarangayInfo Model

```javascript
// models/BarangayInfo.js
{
  barangayName: String (required),
  description: String,
  mission: String,
  vision: String,
  history: String,
  address: {
    street: String,
    municipality: String,
    province: String,
    region: String,
    zipCode: String
  },
  contactInfo: {
    phoneNumber: String,
    email: String
  },
  demographics: {
    totalPopulation: Number,
    totalHouseholds: Number,
    ongoingPublicProjects: Number,
    barangayArea: Number
  },
  logo: String,
  coverPhoto: String,
  socialMedia: {
    facebook: String,
    twitter: String,
    instagram: String,
    youtube: String
  },
  lastUpdatedBy: ObjectId (ref: User),
  timestamps: true
}
```

### Official Model

```javascript
// models/Official.js
{
  firstName: String (required),
  lastName: String (required),
  middleName: String,
  position: String (required, enum),
  committee: String,
  isActive: Boolean (default: true),
  contactNumber: String,
  email: String,
  photo: String,  // Cloudinary URL
  bio: String,
  displayOrder: Number (default: 0),
  timestamps: true
}
```

---

## Frontend Components

### Admin Components

| Component | Path | Purpose |
|-----------|------|---------|
| `CMSAboutUs` | `src/admin/pages/CMS/CMSAboutUs.jsx` | Edit barangay information |
| `AdminOfficials` | `src/admin/pages/Officials/AdminOfficials.jsx` | Manage officials CRUD |

### Public Components

| Component | Path | Purpose |
|-----------|------|---------|
| `OrganizationMembers` | `src/users/pages/About/AboutSections/OrganizationMembers.jsx` | Display officials on About page |

### Key Features in AdminOfficials

- **Grid View**: Cards showing each official with photo, name, position
- **Modal Form**: Add/Edit official with photo upload preview
- **Toggle Active**: Quick button to show/hide officials
- **Delete with Confirmation**: Prevents accidental deletion

### OrganizationMembers (Public)

- Fetches from `/api/officials/active` endpoint
- Barangay Captain displayed prominently at top
- Other officials in a 3-column grid
- No email or social media icons displayed
- Loading skeleton while fetching
- Handles empty state gracefully

---

## Troubleshooting

### "Barangay information not found" Error

**Cause**: No barangay info document exists in the database.

**Solution**: 
1. Go to Admin → Content Management → About Us
2. Fill in the required fields (at minimum, the Barangay Name)
3. Click "Save All Changes" to create the initial record

### Photos Not Uploading

**Check**:
1. Cloudinary environment variables are set correctly
2. File is under 5MB
3. File is JPG, JPEG, or PNG format
4. Network connection is stable

**Console Logs**:
- `📁 Using Cloudinary for file storage` = Cloudinary configured
- `📁 Using local disk storage (Cloudinary not configured)` = Missing env vars

### Officials Not Appearing on Website

**Check**:
1. Official's `isActive` status is `true`
2. The official was saved successfully (check toast notification)
3. Browser cache is cleared
4. API endpoint is reachable

### Image Not Updating

**Solution**: The system automatically deletes old images when updating. If the new image doesn't appear:
1. Clear browser cache
2. Check Cloudinary dashboard for upload status
3. Verify the new URL in the database

---

## Related Files

### Backend
- `controllers/officialController.js` - Official CRUD logic
- `controllers/barangayInfoController.js` - Barangay info CRUD logic
- `routes/officialsRoute.js` - Official API routes
- `routes/barangayInfoRoute.js` - Barangay info API routes
- `models/Official.js` - Official schema
- `models/BarangayInfo.js` - Barangay info schema
- `config/cloudinary.js` - Cloudinary configuration
- `middleware/fileUpload.js` - File upload handling

### Frontend
- `src/admin/pages/Officials/AdminOfficials.jsx`
- `src/admin/pages/CMS/CMSAboutUs.jsx`
- `src/users/pages/About/AboutSections/OrganizationMembers.jsx`
- `src/admin/components/Sidebar.jsx` - Navigation
- `src/App.jsx` - Route definitions

---

*Last Updated: December 2024*
