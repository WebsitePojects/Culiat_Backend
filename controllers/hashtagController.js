const Hashtag = require('../models/Hashtag');

/**
 * @desc    Get all hashtags
 * @route   GET /api/hashtags
 * @access  Public
 */
exports.getHashtags = async (req, res) => {
  try {
    const { category, search, limit = 50 } = req.query;
    
    const query = { isActive: true };
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    const hashtags = await Hashtag.find(query)
      .sort({ isDefault: -1, usageCount: -1, name: 1 })
      .limit(parseInt(limit));
    
    res.status(200).json({
      success: true,
      count: hashtags.length,
      data: hashtags,
    });
  } catch (error) {
    console.error('Error fetching hashtags:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching hashtags',
      error: error.message,
    });
  }
};

/**
 * @desc    Get all hashtags (admin)
 * @route   GET /api/hashtags/admin/all
 * @access  Private (Admin)
 */
exports.getAllHashtagsAdmin = async (req, res) => {
  try {
    const hashtags = await Hashtag.find()
      .populate('createdBy', 'firstName lastName')
      .sort({ isDefault: -1, category: 1, name: 1 });
    
    res.status(200).json({
      success: true,
      count: hashtags.length,
      data: hashtags,
    });
  } catch (error) {
    console.error('Error fetching hashtags:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching hashtags',
      error: error.message,
    });
  }
};

/**
 * @desc    Create a new hashtag
 * @route   POST /api/hashtags
 * @access  Private (Admin)
 */
exports.createHashtag = async (req, res) => {
  try {
    const { name, category, isDefault } = req.body;
    
    // Clean the hashtag name - remove # if present and format
    let cleanName = name.trim();
    if (cleanName.startsWith('#')) {
      cleanName = cleanName.substring(1);
    }
    // Convert to PascalCase/hashtag format (no spaces)
    cleanName = cleanName.replace(/\s+/g, '');
    
    // Check if hashtag already exists
    const existingHashtag = await Hashtag.findOne({ 
      name: { $regex: new RegExp(`^${cleanName}$`, 'i') } 
    });
    
    if (existingHashtag) {
      return res.status(400).json({
        success: false,
        message: 'Hashtag already exists',
      });
    }
    
    const hashtag = await Hashtag.create({
      name: cleanName,
      category: category || 'Custom',
      isDefault: isDefault || false,
      createdBy: req.user._id,
    });
    
    res.status(201).json({
      success: true,
      message: 'Hashtag created successfully',
      data: hashtag,
    });
  } catch (error) {
    console.error('Error creating hashtag:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating hashtag',
      error: error.message,
    });
  }
};

/**
 * @desc    Update a hashtag
 * @route   PUT /api/hashtags/:id
 * @access  Private (Admin)
 */
exports.updateHashtag = async (req, res) => {
  try {
    const { name, category, isDefault, isActive } = req.body;
    
    const hashtag = await Hashtag.findById(req.params.id);
    
    if (!hashtag) {
      return res.status(404).json({
        success: false,
        message: 'Hashtag not found',
      });
    }
    
    // Clean name if provided
    if (name) {
      let cleanName = name.trim();
      if (cleanName.startsWith('#')) {
        cleanName = cleanName.substring(1);
      }
      cleanName = cleanName.replace(/\s+/g, '');
      
      // Check if name already exists (excluding current hashtag)
      const existingHashtag = await Hashtag.findOne({ 
        name: { $regex: new RegExp(`^${cleanName}$`, 'i') },
        _id: { $ne: req.params.id }
      });
      
      if (existingHashtag) {
        return res.status(400).json({
          success: false,
          message: 'Hashtag name already exists',
        });
      }
      
      hashtag.name = cleanName;
    }
    
    if (category !== undefined) hashtag.category = category;
    if (isDefault !== undefined) hashtag.isDefault = isDefault;
    if (isActive !== undefined) hashtag.isActive = isActive;
    
    await hashtag.save();
    
    res.status(200).json({
      success: true,
      message: 'Hashtag updated successfully',
      data: hashtag,
    });
  } catch (error) {
    console.error('Error updating hashtag:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating hashtag',
      error: error.message,
    });
  }
};

/**
 * @desc    Delete a hashtag
 * @route   DELETE /api/hashtags/:id
 * @access  Private (Admin)
 */
exports.deleteHashtag = async (req, res) => {
  try {
    const hashtag = await Hashtag.findById(req.params.id);
    
    if (!hashtag) {
      return res.status(404).json({
        success: false,
        message: 'Hashtag not found',
      });
    }
    
    await hashtag.deleteOne();
    
    res.status(200).json({
      success: true,
      message: 'Hashtag deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting hashtag:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting hashtag',
      error: error.message,
    });
  }
};

/**
 * @desc    Increment usage count for hashtags
 * @route   POST /api/hashtags/increment-usage
 * @access  Private (Admin) - called internally when creating announcements/achievements
 */
exports.incrementUsage = async (req, res) => {
  try {
    const { hashtags } = req.body;
    
    if (!hashtags || !Array.isArray(hashtags)) {
      return res.status(400).json({
        success: false,
        message: 'Hashtags array is required',
      });
    }
    
    // Increment usage count for each hashtag
    await Hashtag.updateMany(
      { name: { $in: hashtags } },
      { $inc: { usageCount: 1 } }
    );
    
    res.status(200).json({
      success: true,
      message: 'Usage count updated',
    });
  } catch (error) {
    console.error('Error incrementing usage:', error);
    res.status(500).json({
      success: false,
      message: 'Error incrementing usage',
      error: error.message,
    });
  }
};

/**
 * @desc    Seed default hashtags
 * @route   POST /api/hashtags/seed
 * @access  Private (Admin)
 */
exports.seedDefaultHashtags = async (req, res) => {
  try {
    const defaultHashtags = [
      // Branding hashtags
      { name: 'KapitanaNanayBebangBernardino', category: 'Branding', isDefault: true },
      { name: 'MostChildFriendlyBarangay', category: 'Branding', isDefault: true },
      { name: 'KalidadsaSerbisyo', category: 'Branding', isDefault: true },
      { name: 'KalingaSaTao', category: 'Branding', isDefault: true },
      { name: 'BarangayCuliat', category: 'Branding', isDefault: true },
      { name: 'CuliatCares', category: 'Branding', isDefault: true },
      
      // Community hashtags
      { name: 'CommunityFirst', category: 'Community', isDefault: true },
      { name: 'BayanihansaCuliat', category: 'Community', isDefault: true },
      { name: 'SerbisyongTapat', category: 'Community', isDefault: true },
      { name: 'KabataanngCuliat', category: 'Community', isDefault: true },
      { name: 'SeniorCitizens', category: 'Community', isDefault: true },
      
      // Events hashtags
      { name: 'FiestangCuliat', category: 'Events', isDefault: true },
      { name: 'BarangayAssembly', category: 'Events', isDefault: true },
      { name: 'MedicalMission', category: 'Events', isDefault: true },
      { name: 'CleanUpDrive', category: 'Events', isDefault: true },
      { name: 'SportsEvent', category: 'Events', isDefault: true },
      
      // Services hashtags
      { name: 'FreeServices', category: 'Services', isDefault: true },
      { name: 'AyudaSaCuliat', category: 'Services', isDefault: true },
      { name: 'HealthProgram', category: 'Services', isDefault: true },
      { name: 'LivelihoodProgram', category: 'Services', isDefault: true },
      { name: 'EducationSupport', category: 'Services', isDefault: true },
    ];
    
    let created = 0;
    let skipped = 0;
    
    for (const tag of defaultHashtags) {
      const exists = await Hashtag.findOne({ name: tag.name });
      if (!exists) {
        await Hashtag.create(tag);
        created++;
      } else {
        skipped++;
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Seeded ${created} hashtags, ${skipped} already existed`,
    });
  } catch (error) {
    console.error('Error seeding hashtags:', error);
    res.status(500).json({
      success: false,
      message: 'Error seeding hashtags',
      error: error.message,
    });
  }
};
