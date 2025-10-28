const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET all contracts
router.get('/', authMiddleware, async (req, res) => {
  try {
    const contracts = await prisma.Contract.findMany({
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    const formattedContracts = contracts.map(contract => ({
      id: contract.id.toString(),
      contractName: contract.contractName,
      contractNumber: contract.contractNumber,
      startDate: contract.startDate,
      endDate: contract.endDate,
      metadata: contract.metadata,
      orgId: contract.orgId.toString(),
      organization: contract.organization ? {
        id: contract.organization.id.toString(),
        name: contract.organization.name,
        code: contract.organization.code,
      } : null,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
    }));

    res.json({
      message: 'Contracts retrieved successfully',
      data: formattedContracts,
    });
  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({
      error: 'Failed to fetch contracts',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

// GET contracts by organization
router.get('/organization/:orgId', authMiddleware, async (req, res) => {
  try {
    const { orgId } = req.params;

    const contracts = await prisma.Contract.findMany({
      where: {
        orgId: BigInt(orgId),
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    const formattedContracts = contracts.map(contract => ({
      id: contract.id.toString(),
      contractName: contract.contractName,
      contractNumber: contract.contractNumber,
      startDate: contract.startDate,
      endDate: contract.endDate,
      metadata: contract.metadata,
      orgId: contract.orgId.toString(),
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
    }));

    res.json({
      message: 'Contracts retrieved successfully',
      data: formattedContracts,
    });
  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({
      error: 'Failed to fetch contracts',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

// POST create new contract
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { contractName, contractNumber, startDate, endDate, metadata, orgId } = req.body;

    // Validation
    if (!contractName || !contractNumber || !startDate || !endDate || !orgId) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Contract name, number, start date, end date, and organization ID are required',
      });
    }

    // Check if organization exists
    const organization = await prisma.Organization.findUnique({
      where: { id: BigInt(orgId) },
    });

    if (!organization) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Organization not found',
      });
    }

    // Check if contract number already exists
    const existingContract = await prisma.Contract.findFirst({
      where: { contractNumber },
    });

    if (existingContract) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Contract number already exists',
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'End date must be after start date',
      });
    }

    // Create contract
    const contract = await prisma.Contract.create({
      data: {
        contractName,
        contractNumber,
        startDate: start,
        endDate: end,
        metadata: metadata || {},
        orgId: BigInt(orgId),
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    res.status(201).json({
      message: 'Contract created successfully',
      data: {
        id: contract.id.toString(),
        contractName: contract.contractName,
        contractNumber: contract.contractNumber,
        startDate: contract.startDate,
        endDate: contract.endDate,
        metadata: contract.metadata,
        orgId: contract.orgId.toString(),
        organization: contract.organization ? {
          id: contract.organization.id.toString(),
          name: contract.organization.name,
          code: contract.organization.code,
        } : null,
        createdAt: contract.createdAt,
        updatedAt: contract.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error creating contract:', error);
    res.status(500).json({
      error: 'Failed to create contract',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

// PUT update contract
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { contractName, contractNumber, startDate, endDate, metadata, orgId } = req.body;

    // Check if contract exists
    const existingContract = await prisma.Contract.findUnique({
      where: { id: BigInt(id) },
    });

    if (!existingContract) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Contract not found',
      });
    }

    // Check if contract number is being changed and if it already exists
    if (contractNumber && contractNumber !== existingContract.contractNumber) {
      const numberExists = await prisma.Contract.findFirst({
        where: {
          contractNumber,
          id: { not: BigInt(id) },
        },
      });

      if (numberExists) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Contract number already exists',
        });
      }
    }

    // If orgId is being changed, check if organization exists
    if (orgId && orgId !== existingContract.orgId.toString()) {
      const organization = await prisma.Organization.findUnique({
        where: { id: BigInt(orgId) },
      });

      if (!organization) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Organization not found',
        });
      }
    }

    // Validate dates if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start >= end) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'End date must be after start date',
        });
      }
    }

    // Update contract
    const contract = await prisma.Contract.update({
      where: { id: BigInt(id) },
      data: {
        ...(contractName && { contractName }),
        ...(contractNumber && { contractNumber }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(metadata !== undefined && { metadata }),
        ...(orgId && { orgId: BigInt(orgId) }),
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    res.json({
      message: 'Contract updated successfully',
      data: {
        id: contract.id.toString(),
        contractName: contract.contractName,
        contractNumber: contract.contractNumber,
        startDate: contract.startDate,
        endDate: contract.endDate,
        metadata: contract.metadata,
        orgId: contract.orgId.toString(),
        organization: contract.organization ? {
          id: contract.organization.id.toString(),
          name: contract.organization.name,
          code: contract.organization.code,
        } : null,
        createdAt: contract.createdAt,
        updatedAt: contract.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating contract:', error);
    res.status(500).json({
      error: 'Failed to update contract',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

// DELETE contract
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if contract exists
    const existingContract = await prisma.Contract.findUnique({
      where: { id: BigInt(id) },
    });

    if (!existingContract) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Contract not found',
      });
    }

    // Check if contract has related devices
    const relatedDevices = await prisma.Device.findMany({
      where: { contractId: BigInt(id) },
      select: {
        id: true,
        serialNumber: true,
        assetTag: true,
        site: {
          select: {
            name: true,
          },
        },
      },
      take: 10,
    });

    if (relatedDevices.length > 0) {
      const deviceList = relatedDevices
        .map(d => `${d.serialNumber} (${d.assetTag}) - ${d.site?.name || 'Талбайгүй'}`)
        .join('\n• ');
      
      const moreText = relatedDevices.length === 10 ? '\n...болон бусад' : '';
      
      return res.status(400).json({
        error: 'Cannot delete',
        message: `Энэ гэрээтэй холбоотой ${relatedDevices.length}+ төхөөрөмж байна:\n\n• ${deviceList}${moreText}\n\nЭхлээд эдгээр төхөөрөмжүүдийг устгана уу.`,
        devices: relatedDevices.map(d => ({
          id: d.id.toString(),
          serialNumber: d.serialNumber,
          assetTag: d.assetTag,
        })),
      });
    }

    // Delete contract
    await prisma.Contract.delete({
      where: { id: BigInt(id) },
    });

    res.json({
      message: 'Contract deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting contract:', error);
    res.status(500).json({
      error: 'Failed to delete contract',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

module.exports = router;

