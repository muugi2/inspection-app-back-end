const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');
const { handleError } = require('../utils/routeHelpers');

const router = express.Router();
const prisma = new PrismaClient();

// GET all sites
router.get('/', authMiddleware, async (req, res) => {
  try {
    const sites = await prisma.Site.findMany({
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
        name: 'asc',
      },
    });

    const formattedSites = sites.map(site => ({
      id: site.id.toString(),
      name: site.name,
      orgId: site.orgId.toString(),
      organization: site.organization ? {
        id: site.organization.id.toString(),
        name: site.organization.name,
        code: site.organization.code,
      } : null,
      createdAt: site.createdAt,
      updatedAt: site.updatedAt,
    }));

    res.json({
      message: 'Sites retrieved successfully',
      data: formattedSites,
    });
  } catch (error) {
    console.error('Error fetching sites:', error);
    res.status(500).json({
      error: 'Failed to fetch sites',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

// GET sites by organization
router.get('/organization/:orgId', authMiddleware, async (req, res) => {
  try {
    const { orgId } = req.params;

    const sites = await prisma.Site.findMany({
      where: {
        orgId: BigInt(orgId),
      },
      orderBy: {
        name: 'asc',
      },
    });

    const formattedSites = sites.map(site => ({
      id: site.id.toString(),
      name: site.name,
      orgId: site.orgId.toString(),
      createdAt: site.createdAt,
      updatedAt: site.updatedAt,
    }));

    res.json({
      message: 'Sites retrieved successfully',
      data: formattedSites,
    });
  } catch (error) {
    console.error('Error fetching sites:', error);
    res.status(500).json({
      error: 'Failed to fetch sites',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

// POST create new site
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, orgId } = req.body;

    // Validation
    if (!name || !orgId) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Name and organization ID are required',
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

    // Create site
    const site = await prisma.Site.create({
      data: {
        name,
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
      message: 'Site created successfully',
      data: {
        id: site.id.toString(),
        name: site.name,
        orgId: site.orgId.toString(),
        organization: site.organization ? {
          id: site.organization.id.toString(),
          name: site.organization.name,
          code: site.organization.code,
        } : null,
        createdAt: site.createdAt,
        updatedAt: site.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error creating site:', error);
    res.status(500).json({
      error: 'Failed to create site',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

// PUT update site
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, orgId } = req.body;

    // Check if site exists
    const existingSite = await prisma.Site.findUnique({
      where: { id: BigInt(id) },
    });

    if (!existingSite) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Site not found',
      });
    }

    // If orgId is being changed, check if organization exists
    if (orgId && orgId !== existingSite.orgId.toString()) {
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

    // Update site
    const site = await prisma.Site.update({
      where: { id: BigInt(id) },
      data: {
        ...(name && { name }),
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
      message: 'Site updated successfully',
      data: {
        id: site.id.toString(),
        name: site.name,
        orgId: site.orgId.toString(),
        organization: site.organization ? {
          id: site.organization.id.toString(),
          name: site.organization.name,
          code: site.organization.code,
        } : null,
        createdAt: site.createdAt,
        updatedAt: site.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating site:', error);
    res.status(500).json({
      error: 'Failed to update site',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

// DELETE site
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ DELETE site request: ID=${id}, User=${req.user.id}`);

    // Check if site exists
    const existingSite = await prisma.Site.findUnique({
      where: { id: BigInt(id) },
    });

    if (!existingSite) {
      console.log(`❌ Site not found: ID=${id}`);
      return res.status(404).json({
        error: 'Not found',
        message: 'Site not found',
      });
    }

    console.log(`✅ Site found: ${existingSite.name} (ID=${id})`);

    // Check if site has related devices - get total count first
    const totalDevices = await prisma.Device.count({
      where: { siteId: BigInt(id) },
    });

    if (totalDevices > 0) {
      // Get sample devices for display
      const relatedDevices = await prisma.Device.findMany({
        where: { siteId: BigInt(id) },
        select: {
          id: true,
          serialNumber: true,
          assetTag: true,
          model: {
            select: {
              manufacturer: true,
              model: true,
            },
          },
        },
        take: 10,
      });

      const deviceList = relatedDevices
        .map(d => `${d.serialNumber} (${d.assetTag}) - ${d.model?.manufacturer || ''} ${d.model?.model || ''}`.trim())
        .join('\n• ');
      
      const moreText = totalDevices > 10 ? `\n...болон ${totalDevices - 10} бусад төхөөрөмж` : '';
      
      return res.status(400).json({
        error: 'Cannot delete',
        message: `Энэ талбайд төхөөрөмж байна (Нийт: ${totalDevices}):\n\n• ${deviceList}${moreText}\n\nЭхлээд эдгээр төхөөрөмжүүдийг устгана уу.`,
        devices: { 
          total: totalDevices,
          items: relatedDevices.map(d => ({
            id: d.id.toString(),
            serialNumber: d.serialNumber,
            assetTag: d.assetTag,
            model: d.model ? `${d.model.manufacturer} ${d.model.model}` : null,
          }))
        },
      });
    }

    // Delete site
    console.log(`🗑️ Attempting to delete site: ${existingSite.name} (ID=${id})`);
    const deletedSite = await prisma.Site.delete({
      where: { id: BigInt(id) },
    });

    console.log(`✅ Site deleted successfully: ${deletedSite.name} (ID=${id})`);
    res.json({
      message: 'Site deleted successfully',
    });
  } catch (error) {
    console.error('❌ Error deleting site:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      siteId: id,
    });
    res.status(500).json({
      error: 'Failed to delete site',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? {
        code: error.code,
        stack: error.stack,
      } : undefined,
    });
  }
});

module.exports = router;

