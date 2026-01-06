const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    // Site Information
    siteInfo: {
      barangayName: {
        type: String,
        default: "Barangay Culiat",
      },
      city: {
        type: String,
        default: "Quezon City",
      },
      province: {
        type: String,
        default: "Metro Manila",
      },
      tagline: {
        type: String,
        default: "Building a Better Community Together",
      },
      description: {
        type: String,
        default: "Official Website of Barangay Culiat",
      },
      logo: {
        type: String,
        default: "",
      },
    },

    // Contact Information
    contactInfo: {
      officeAddress: {
        type: String,
        default: "467 Tandang Sora Ave, Quezon City, 1128 Metro Manila",
      },
      phoneNumber: {
        type: String,
        default: "+63 962-582-1531",
      },
      mobileNumber: {
        type: String,
        default: "856-722-60",
      },
      emailAddress: {
        type: String,
        default: "brgy.culiat@yahoo.com",
      },
      officeHours: {
        type: String,
        default: "Monday - Friday, 8:00 AM - 5:00 PM",
      },
      mapEmbedUrl: {
        type: String,
        default: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d964.9469179112511!2d121.05602636955277!3d14.667987796511813!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397b7475e1333fb%3A0xb01b3d6a168686a5!2sCuliat%20Barangay%20Hall!5e0!3m2!1sen!2sph!4v1760884990064!5m2!1sen!2sph",
      },
      mapDirectionsUrl: {
        type: String,
        default: "https://www.google.com/maps/place/Culiat+Barangay+Hall/@14.667987,121.05667,17z/data=!4m6!3m5!1s0x3397b7475e1333fb:0xb01b3d6a168686a5!8m2!3d14.6679865!4d121.0566701!16s%2Fg%2F11c3tsgbjt?hl=en&entry=ttu&g_ep=EgoyMDI1MTAyMC4wIKXMDSoASAFQAw%3D%3D",
      },
    },

    // Social Media Links
    socialMedia: {
      facebook: {
        type: String,
        default: "https://www.facebook.com/profile.php?id=100091344363854",
      },
      twitter: {
        type: String,
        default: "",
      },
      instagram: {
        type: String,
        default: "",
      },
      youtube: {
        type: String,
        default: "",
      },
    },

    // Footer Settings
    footer: {
      aboutText: {
        type: String,
        default: "Serving our community with transparency, dedication, and excellence. Building a safer and unified Barangay Culiat for all residents.",
      },
      copyrightText: {
        type: String,
        default: "© 2025 Barangay Culiat | Managed by Barangay Culiat Information Office",
      },
      poweredByText: {
        type: String,
        default: "Prince IT Solutions",
      },
      showQuickLinks: {
        type: Boolean,
        default: true,
      },
      quickLinks: [
        {
          title: {
            type: String,
            default: "",
          },
          url: {
            type: String,
            default: "",
          },
          order: {
            type: Number,
            default: 0,
          },
        },
      ],
      showMap: {
        type: Boolean,
        default: true,
      },
    },

    // Banner Settings
    banner: {
      enabled: {
        type: Boolean,
        default: true,
      },
      images: [
        {
          url: String,
          caption: String,
          order: Number,
        },
      ],
      autoRotate: {
        type: Boolean,
        default: true,
      },
      rotationInterval: {
        type: Number,
        default: 5000, // milliseconds
      },
    },

    // Theme Settings
    theme: {
      primaryColor: {
        type: String,
        default: "#3B82F6", // blue-500
      },
      secondaryColor: {
        type: String,
        default: "#8B5CF6", // purple-500
      },
      accentColor: {
        type: String,
        default: "#10B981", // green-500
      },
      darkMode: {
        type: Boolean,
        default: false,
      },
    },

    // System Settings
    system: {
      maintenanceMode: {
        type: Boolean,
        default: false,
      },
      maintenanceMessage: {
        type: String,
        default: "System is currently under maintenance. Please try again later.",
      },
      emailNotificationsEnabled: {
        type: Boolean,
        default: true,
      },
      registrationEnabled: {
        type: Boolean,
        default: true,
      },
      documentRequestEnabled: {
        type: Boolean,
        default: true,
      },
      reportingEnabled: {
        type: Boolean,
        default: true,
      },
      profileUpdateEnabled: {
        type: Boolean,
        default: true,
      },
      maxFileSize: {
        type: Number,
        default: 5, // MB
      },
      allowedFileTypes: {
        type: [String],
        default: ["pdf", "jpg", "jpeg", "png", "doc", "docx"],
      },
      sessionTimeout: {
        type: Number,
        default: 30, // minutes
      },
      maxLoginAttempts: {
        type: Number,
        default: 5,
      },
      autoApproveResidents: {
        type: Boolean,
        default: false,
      },
    },

    // Terms and Conditions
    termsAndConditions: {
      version: {
        type: String,
        default: "1.0",
      },
      content: {
        type: String,
        default: "",
      },
      lastUpdated: {
        type: Date,
        default: Date.now,
      },
    },

    // Last updated metadata
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one settings document exists
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model("Settings", settingsSchema);