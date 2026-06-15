const mongoose = require('mongoose');
const InventoryItem = require('../models/InventoryItem');
const {
  buildUserCacheKey,
  getCachedJson,
  setCachedJson
} = require('../utils/cache');

const getInventory = async (req, res) => {
  try {
    const userId = req.userId;
    const cacheKey = buildUserCacheKey(userId, 'inventory', 'v1');
    const cached = await getCachedJson(cacheKey);
    if (cached) return res.status(200).json(cached);

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_AUTH_USER',
          message: 'Authenticated user id is missing or invalid',
          details: {}
        }
      });
    }

    const inventoryItems = await InventoryItem.find({ userId })
      .populate('storeItemId', 'code name type price growthValue')
      .sort({ createdAt: 1 });

    const items = inventoryItems.map((entry) => ({
      id: entry._id,
      storeItemId: entry.storeItemId?._id || null,
      itemCode: entry.storeItemId?.code || null,
      itemName: entry.storeItemId?.name || null,
      type: entry.storeItemId?.type || null,
      price: entry.storeItemId?.price ?? null,
      growthValue: entry.storeItemId?.growthValue ?? null,
      quantity: entry.quantity
    }));

    const payload = {
      success: true,
      message: 'Inventory loaded successfully',
      data: {
        items
      }
    };

    await setCachedJson(cacheKey, payload, 30);
    return res.status(200).json(payload);
  } catch (error) {
    console.error('getInventory error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INVENTORY_FETCH_FAILED',
        message: 'Failed to load inventory',
        details: {}
      }
    });
  }
};

module.exports = {
  getInventory
};
