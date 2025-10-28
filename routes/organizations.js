const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET all organizations
router.get('/', authMiddleware, async (req, res) => {
  try {
    const organizations = await prisma.Organization.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Format response
    const formattedOrganizations = organizations.map(org => ({
      id: org.id.toString(),
      name: org.name,
      code: org.code,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    }));

    res.json({
      message: 'Organizations retrieved successfully',
      data: formattedOrganizations,
    });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({
      error: 'Failed to fetch organizations',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

// POST create new organization
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, code } = req.body;

    // Validation
    if (!name || !code) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Name and code are required',
      });
    }

    // Check if code already exists
    const existingOrg = await prisma.Organization.findFirst({
      where: { code },
    });

    if (existingOrg) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Organization code already exists',
      });
    }

    // Create organization
    const organization = await prisma.Organization.create({
      data: {
        name,
        code,
      },
    });

    res.status(201).json({
      message: 'Organization created successfully',
      data: {
        id: organization.id.toString(),
        name: organization.name,
        code: organization.code,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({
      error: 'Failed to create organization',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

// PUT update organization
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code } = req.body;

    // Check if organization exists
    const existingOrg = await prisma.Organization.findUnique({
      where: { id: BigInt(id) },
    });

    if (!existingOrg) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Organization not found',
      });
    }

    // Check if code is being changed and if it already exists
    if (code && code !== existingOrg.code) {
      const codeExists = await prisma.Organization.findFirst({
        where: {
          code,
          id: { not: BigInt(id) },
        },
      });

      if (codeExists) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Organization code already exists',
        });
      }
    }

    // Update organization
    const organization = await prisma.Organization.update({
      where: { id: BigInt(id) },
      data: {
        ...(name && { name }),
        ...(code && { code }),
      },
    });

    res.json({
      message: 'Organization updated successfully',
      data: {
        id: organization.id.toString(),
        name: organization.name,
        code: organization.code,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating organization:', error);
    res.status(500).json({
      error: 'Failed to update organization',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

// DELETE organization
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if organization exists
    const existingOrg = await prisma.Organization.findUnique({
      where: { id: BigInt(id) },
    });

    if (!existingOrg) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Organization not found',
      });
    }

    // Check if organization has related records
    const [users, sites, contracts, devices] = await prisma.$transaction([
      prisma.User.findMany({ where: { orgId: BigInt(id) }, select: { fullName: true, email: true }, take: 5 }),
      prisma.Site.findMany({ where: { orgId: BigInt(id) }, select: { name: true }, take: 5 }),
      prisma.Contract.findMany({ where: { orgId: BigInt(id) }, select: { contractNumber: true, contractName: true }, take: 5 }),
      prisma.Device.findMany({ where: { orgId: BigInt(id) }, select: { serialNumber: true, assetTag: true }, take: 5 }),
    ]);

    const totalRelated = users.length + sites.length + contracts.length + devices.length;

    if (totalRelated > 0) {
      let details = [];
      
      if (users.length > 0) {
        details.push(`\n📋 Хэрэглэгчид (${users.length}):\n• ${users.map(u => u.fullName).join('\n• ')}`);
      }
      if (sites.length > 0) {
        details.push(`\n📍 Талбайнууд (${sites.length}):\n• ${sites.map(s => s.name).join('\n• ')}`);
      }
      if (contracts.length > 0) {
        details.push(`\n📄 Гэрээнүүд (${contracts.length}):\n• ${contracts.map(c => c.contractNumber).join('\n• ')}`);
      }
      if (devices.length > 0) {
        details.push(`\n🔧 Төхөөрөмжүүд (${devices.length}):\n• ${devices.map(d => `${d.serialNumber} (${d.assetTag})`).join('\n• ')}`);
      }
      
      return res.status(400).json({
        error: 'Cannot delete',
        message: `Энэ байгууллагатай холбоотой бичлэгүүд байна:${details.join('\n')}\n\nЭхлээд эдгээр бүх бичлэгийг устгана уу.`,
        relatedRecords: { users, sites, contracts, devices },
      });
    }

    // Delete organization
    await prisma.Organization.delete({
      where: { id: BigInt(id) },
    });

    res.json({
      message: 'Organization deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting organization:', error);
    res.status(500).json({
      error: 'Failed to delete organization',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

module.exports = router;


