const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addScheduleType() {
  try {
    console.log('Checking if schedule_type column exists...');
    
    // Check if column exists
    const columns = await prisma.$queryRaw`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'inspections' 
      AND COLUMN_NAME = 'schedule_type'
    `;
    
    if (columns.length === 0) {
      console.log('Adding schedule_type column to inspections table...');
      await prisma.$executeRaw`
        ALTER TABLE inspections 
        ADD COLUMN schedule_type ENUM('DAILY', 'SCHEDULED') NOT NULL DEFAULT 'SCHEDULED'
      `;
      console.log('Column added successfully');
    } else {
      console.log('Column schedule_type already exists, skipping...');
    }
    
    // Add indexes
    try {
      await prisma.$executeRaw`
        CREATE INDEX idx_inspections_schedule_type ON inspections(schedule_type)
      `;
      console.log('Index idx_inspections_schedule_type created');
    } catch (e) {
      if (e.message.includes('Duplicate key') || e.message.includes('already exists')) {
        console.log('Index idx_inspections_schedule_type already exists, skipping...');
      } else {
        throw e;
      }
    }
    
    try {
      await prisma.$executeRaw`
        CREATE INDEX idx_inspections_org_schedule_type ON inspections(org_id, schedule_type)
      `;
      console.log('Index idx_inspections_org_schedule_type created');
    } catch (e) {
      if (e.message.includes('Duplicate key') || e.message.includes('already exists')) {
        console.log('Index idx_inspections_org_schedule_type already exists, skipping...');
      } else {
        throw e;
      }
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Error adding schedule_type column:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addScheduleType();

