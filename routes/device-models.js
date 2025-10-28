const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET all device models
router.get('/', authMiddleware, async (req, res) => {
  try {
    const models = await prisma.DeviceModel.findMany({
      orderBy: [
        { manufacturer: 'asc' },
        { model: 'asc' },
      ],
    });

    const formattedModels = models.map(model => ({
      id: model.id.toString(),
      manufacturer: model.manufacturer,
      model: model.model,
      specs: model.specs,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    }));

    res.json({
      message: 'Device models retrieved successfully',
      data: formattedModels,
    });
  } catch (error) {
    console.error('Error fetching device models:', error);
    res.status(500).json({
      error: 'Failed to fetch device models',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

// POST create new device model
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { manufacturer, model, specs } = req.body;

    // Validation
    if (!manufacturer || !model) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Manufacturer and model are required',
      });
    }

    // Check if model already exists
    const existingModel = await prisma.DeviceModel.findFirst({
      where: {
        manufacturer,
        model,
      },
    });

    if (existingModel) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Device model already exists',
      });
    }

    // Validate specs is valid JSON if provided
    if (specs && typeof specs !== 'object') {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Specs must be a valid JSON object',
      });
    }

    // Create device model
    const deviceModel = await prisma.DeviceModel.create({
      data: {
        manufacturer,
        model,
        specs: specs || {},
      },
    });

    res.status(201).json({
      message: 'Device model created successfully',
      data: {
        id: deviceModel.id.toString(),
        manufacturer: deviceModel.manufacturer,
        model: deviceModel.model,
        specs: deviceModel.specs,
        createdAt: deviceModel.createdAt,
        updatedAt: deviceModel.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error creating device model:', error);
    res.status(500).json({
      error: 'Failed to create device model',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

// PUT update device model
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { manufacturer, model, specs } = req.body;

    // Check if device model exists
    const existingModel = await prisma.DeviceModel.findUnique({
      where: { id: BigInt(id) },
    });

    if (!existingModel) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Device model not found',
      });
    }

    // Check if updated model name already exists
    if ((manufacturer || model) &&
        (manufacturer !== existingModel.manufacturer || model !== existingModel.model)) {
      const duplicateModel = await prisma.DeviceModel.findFirst({
        where: {
          manufacturer: manufacturer || existingModel.manufacturer,
          model: model || existingModel.model,
          id: { not: BigInt(id) },
        },
      });

      if (duplicateModel) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Device model already exists',
        });
      }
    }

    // Validate specs is valid JSON if provided
    if (specs && typeof specs !== 'object') {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Specs must be a valid JSON object',
      });
    }

    // Update device model
    const deviceModel = await prisma.DeviceModel.update({
      where: { id: BigInt(id) },
      data: {
        ...(manufacturer && { manufacturer }),
        ...(model && { model }),
        ...(specs !== undefined && { specs }),
      },
    });

    res.json({
      message: 'Device model updated successfully',
      data: {
        id: deviceModel.id.toString(),
        manufacturer: deviceModel.manufacturer,
        model: deviceModel.model,
        specs: deviceModel.specs,
        createdAt: deviceModel.createdAt,
        updatedAt: deviceModel.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating device model:', error);
    res.status(500).json({
      error: 'Failed to update device model',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

// DELETE device model
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if device model exists
    const existingModel = await prisma.DeviceModel.findUnique({
      where: { id: BigInt(id) },
    });

    if (!existingModel) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Device model not found',
      });
    }

    // Check if model has related devices
    const relatedDevices = await prisma.Device.findMany({
      where: { modelId: BigInt(id) },
      select: {
        id: true,
        serialNumber: true,
        assetTag: true,
        organization: {
          select: {
            name: true,
          },
        },
      },
      take: 10, // Limit to first 10 devices
    });

    if (relatedDevices.length > 0) {
      const deviceList = relatedDevices
        .map(d => `${d.serialNumber} (${d.assetTag}) - ${d.organization.name}`)
        .join('\n• ');
      
      const moreText = relatedDevices.length === 10 ? '\n...болон бусад' : '';
      
      return res.status(400).json({
        error: 'Cannot delete',
        message: `Энэ загварыг ашиглаж байгаа ${relatedDevices.length}+ төхөөрөмж байна:\n\n• ${deviceList}${moreText}\n\nЭхлээд эдгээр төхөөрөмжүүдийг устгана уу.`,
        devices: relatedDevices.map(d => ({
          id: d.id.toString(),
          serialNumber: d.serialNumber,
          assetTag: d.assetTag,
          organization: d.organization.name,
        })),
      });
    }

    // Delete device model
    await prisma.DeviceModel.delete({
      where: { id: BigInt(id) },
    });

    res.json({
      message: 'Device model deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting device model:', error);
    res.status(500).json({
      error: 'Failed to delete device model',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

module.exports = router;

