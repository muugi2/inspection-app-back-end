const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET devices by organization
router.get('/organization/:orgId', authMiddleware, async (req, res) => {
  try {
    const { orgId } = req.params;

    const devices = await prisma.Device.findMany({
      where: {
        orgId: BigInt(orgId),
        deletedAt: null,
      },
      include: {
        model: {
          select: {
            id: true,
            manufacturer: true,
            model: true,
          },
        },
        site: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        serialNumber: 'asc',
      },
    });

    // Format response
    const formattedDevices = devices.map(device => ({
      id: device.id.toString(),
      serialNumber: device.serialNumber,
      assetTag: device.assetTag,
      status: device.status,
      model: device.model ? {
        id: device.model.id.toString(),
        manufacturer: device.model.manufacturer,
        model: device.model.model,
      } : null,
      site: device.site ? {
        id: device.site.id.toString(),
        name: device.site.name,
      } : null,
      installedAt: device.installedAt,
      createdAt: device.createdAt,
    }));

    res.json({
      message: 'Devices retrieved successfully',
      data: formattedDevices,
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({
      error: 'Failed to fetch devices',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

// POST create new device
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      orgId,
      siteId,
      contractId,
      modelId,
      serialNumber,
      assetTag,
      status,
      installedAt,
      metadata,
    } = req.body;

    // Validation
    if (!orgId || !siteId || !contractId || !modelId || !serialNumber || !assetTag) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Organization, site, contract, model, serial number, and asset tag are required',
      });
    }

    // Check if serial number already exists
    const existingDevice = await prisma.Device.findFirst({
      where: { serialNumber },
    });

    if (existingDevice) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Serial number already exists',
      });
    }

    // Check if related records exist
    const [organization, site, contract, model] = await Promise.all([
      prisma.Organization.findUnique({ where: { id: BigInt(orgId) } }),
      prisma.Site.findUnique({ where: { id: BigInt(siteId) } }),
      prisma.Contract.findUnique({ where: { id: BigInt(contractId) } }),
      prisma.DeviceModel.findUnique({ where: { id: BigInt(modelId) } }),
    ]);

    if (!organization) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Organization not found',
      });
    }

    if (!site) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Site not found',
      });
    }

    if (!contract) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Contract not found',
      });
    }

    if (!model) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Device model not found',
      });
    }

    // Verify site belongs to organization
    if (site.orgId.toString() !== orgId) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Site does not belong to the specified organization',
      });
    }

    // Verify contract belongs to organization
    if (contract.orgId.toString() !== orgId) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Contract does not belong to the specified organization',
      });
    }

    // Create device
    const device = await prisma.Device.create({
      data: {
        orgId: BigInt(orgId),
        siteId: BigInt(siteId),
        contractId: BigInt(contractId),
        modelId: BigInt(modelId),
        serialNumber,
        assetTag,
        status: status || 'NORMAL',
        installedAt: installedAt ? new Date(installedAt) : new Date(),
        metadata: metadata || {},
      },
      include: {
        model: {
          select: {
            id: true,
            manufacturer: true,
            model: true,
          },
        },
        site: {
          select: {
            id: true,
            name: true,
          },
        },
        contract: {
          select: {
            id: true,
            contractName: true,
            contractNumber: true,
          },
        },
      },
    });

    res.status(201).json({
      message: 'Device created successfully',
      data: {
        id: device.id.toString(),
        serialNumber: device.serialNumber,
        assetTag: device.assetTag,
        status: device.status,
        installedAt: device.installedAt,
        metadata: device.metadata,
        model: device.model ? {
          id: device.model.id.toString(),
          manufacturer: device.model.manufacturer,
          model: device.model.model,
        } : null,
        site: device.site ? {
          id: device.site.id.toString(),
          name: device.site.name,
        } : null,
        contract: device.contract ? {
          id: device.contract.id.toString(),
          contractName: device.contract.contractName,
          contractNumber: device.contract.contractNumber,
        } : null,
        createdAt: device.createdAt,
        updatedAt: device.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error creating device:', error);
    res.status(500).json({
      error: 'Failed to create device',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

// PUT update device
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      orgId,
      siteId,
      contractId,
      modelId,
      serialNumber,
      assetTag,
      status,
      installedAt,
      metadata,
    } = req.body;

    // Check if device exists
    const existingDevice = await prisma.Device.findUnique({
      where: { id: BigInt(id) },
    });

    if (!existingDevice) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Device not found',
      });
    }

    // Check if serial number is being changed and if it already exists
    if (serialNumber && serialNumber !== existingDevice.serialNumber) {
      const duplicateSerial = await prisma.Device.findFirst({
        where: {
          serialNumber,
          id: { not: BigInt(id) },
        },
      });

      if (duplicateSerial) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Serial number already exists',
        });
      }
    }

    // Check if related records exist (if being changed)
    if (orgId || siteId || contractId || modelId) {
      const checks = [];
      
      if (orgId && orgId !== existingDevice.orgId.toString()) {
        checks.push(
          prisma.Organization.findUnique({ where: { id: BigInt(orgId) } })
            .then(org => ({ type: 'org', data: org }))
        );
      }
      
      if (siteId && siteId !== existingDevice.siteId?.toString()) {
        checks.push(
          prisma.Site.findUnique({ where: { id: BigInt(siteId) } })
            .then(site => ({ type: 'site', data: site }))
        );
      }
      
      if (contractId && contractId !== existingDevice.contractId?.toString()) {
        checks.push(
          prisma.Contract.findUnique({ where: { id: BigInt(contractId) } })
            .then(contract => ({ type: 'contract', data: contract }))
        );
      }
      
      if (modelId && modelId !== existingDevice.modelId?.toString()) {
        checks.push(
          prisma.DeviceModel.findUnique({ where: { id: BigInt(modelId) } })
            .then(model => ({ type: 'model', data: model }))
        );
      }

      const results = await Promise.all(checks);
      
      for (const result of results) {
        if (!result.data) {
          return res.status(404).json({
            error: 'Not found',
            message: `${result.type.charAt(0).toUpperCase() + result.type.slice(1)} not found`,
          });
        }
      }

      // Verify relationships
      const finalOrgId = orgId || existingDevice.orgId.toString();
      const finalSiteId = siteId || existingDevice.siteId.toString();
      const finalContractId = contractId || existingDevice.contractId.toString();

      if (siteId) {
        const site = await prisma.Site.findUnique({ where: { id: BigInt(finalSiteId) } });
        if (site && site.orgId.toString() !== finalOrgId) {
          return res.status(400).json({
            error: 'Validation failed',
            message: 'Site does not belong to the specified organization',
          });
        }
      }

      if (contractId) {
        const contract = await prisma.Contract.findUnique({ where: { id: BigInt(finalContractId) } });
        if (contract && contract.orgId.toString() !== finalOrgId) {
          return res.status(400).json({
            error: 'Validation failed',
            message: 'Contract does not belong to the specified organization',
          });
        }
      }
    }

    // Update device
    const device = await prisma.Device.update({
      where: { id: BigInt(id) },
      data: {
        ...(orgId && { orgId: BigInt(orgId) }),
        ...(siteId && { siteId: BigInt(siteId) }),
        ...(contractId && { contractId: BigInt(contractId) }),
        ...(modelId && { modelId: BigInt(modelId) }),
        ...(serialNumber && { serialNumber }),
        ...(assetTag && { assetTag }),
        ...(status && { status }),
        ...(installedAt && { installedAt: new Date(installedAt) }),
        ...(metadata !== undefined && { metadata }),
      },
      include: {
        model: {
          select: {
            id: true,
            manufacturer: true,
            model: true,
          },
        },
        site: {
          select: {
            id: true,
            name: true,
          },
        },
        contract: {
          select: {
            id: true,
            contractName: true,
            contractNumber: true,
          },
        },
      },
    });

    res.json({
      message: 'Device updated successfully',
      data: {
        id: device.id.toString(),
        serialNumber: device.serialNumber,
        assetTag: device.assetTag,
        status: device.status,
        installedAt: device.installedAt,
        metadata: device.metadata,
        model: device.model ? {
          id: device.model.id.toString(),
          manufacturer: device.model.manufacturer,
          model: device.model.model,
        } : null,
        site: device.site ? {
          id: device.site.id.toString(),
          name: device.site.name,
        } : null,
        contract: device.contract ? {
          id: device.contract.id.toString(),
          contractName: device.contract.contractName,
          contractNumber: device.contract.contractNumber,
        } : null,
        createdAt: device.createdAt,
        updatedAt: device.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating device:', error);
    res.status(500).json({
      error: 'Failed to update device',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

// DELETE device
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if device exists
    const existingDevice = await prisma.Device.findUnique({
      where: { id: BigInt(id) },
    });

    if (!existingDevice) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Device not found',
      });
    }

    // Soft delete by setting deletedAt
    const device = await prisma.Device.update({
      where: { id: BigInt(id) },
      data: {
        deletedAt: new Date(),
      },
    });

    res.json({
      message: 'Device deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({
      error: 'Failed to delete device',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

module.exports = router;


