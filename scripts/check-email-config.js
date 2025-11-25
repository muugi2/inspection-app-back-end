/**
 * Email тохиргоо шалгах script
 * 
 * Энэ script нь:
 * 1. config.env файлын email тохиргоог шалгана
 * 2. Database дээр organization-уудын contactEmail талбарыг шалгана
 * 3. Email service-ийн тохиргоог шалгана
 */

require('dotenv').config({ path: require('path').join(__dirname, '../config.env') });
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');

const prisma = new PrismaClient();

async function checkEmailConfig() {
  console.log('=== Email тохиргоо шалгах ===\n');

  // 1. config.env файлын тохиргоо шалгах
  console.log('1. config.env файлын тохиргоо:');
  const emailConfig = {
    user: process.env.NOTIFY_EMAIL_USER,
    password: process.env.NOTIFY_EMAIL_PASSWORD,
    from: process.env.NOTIFY_EMAIL_FROM,
    host: process.env.NOTIFY_EMAIL_HOST,
    port: process.env.NOTIFY_EMAIL_PORT,
    secure: process.env.NOTIFY_EMAIL_SECURE,
  };

  console.log('   NOTIFY_EMAIL_USER:', emailConfig.user ? '✅ Тохируулагдсан' : '❌ Тохируулагдаагүй');
  console.log('   NOTIFY_EMAIL_PASSWORD:', emailConfig.password ? '✅ Тохируулагдсан' : '❌ Тохируулагдаагүй');
  console.log('   NOTIFY_EMAIL_FROM:', emailConfig.from || '❌ Тохируулагдаагүй');
  console.log('   NOTIFY_EMAIL_HOST:', emailConfig.host || 'smtp.gmail.com (default)');
  console.log('   NOTIFY_EMAIL_PORT:', emailConfig.port || '465 (default)');
  console.log('   NOTIFY_EMAIL_SECURE:', emailConfig.secure || 'true (default)');

  if (!emailConfig.user || !emailConfig.password) {
    console.log('\n   ⚠️  Анхаар: Email илгээхэд NOTIFY_EMAIL_USER болон NOTIFY_EMAIL_PASSWORD шаардлагатай!');
  }

  // 2. Email transporter шалгах
  console.log('\n2. Email transporter шалгах:');
  try {
    const transporter = nodemailer.createTransport({
      host: emailConfig.host || 'smtp.gmail.com',
      port: Number(emailConfig.port || 465),
      secure: emailConfig.secure === 'true' || emailConfig.secure === '1' || emailConfig.secure === 'yes' || Number(emailConfig.port || 465) === 465,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.password,
      },
    });

    // Test connection
    await transporter.verify();
    console.log('   ✅ Email transporter амжилттай тохируулагдсан');
  } catch (error) {
    console.log('   ❌ Email transporter тохируулахад алдаа гарлаа:');
    console.log('      Error:', error.message);
    if (error.code === 'EAUTH') {
      console.log('      ⚠️  Анхаар: Email эрх (username/password) буруу байна!');
    }
  }

  // 3. Database дээр organization-уудын contactEmail шалгах
  console.log('\n3. Database дээр organization-уудын contactEmail:');
  try {
    const organizations = await prisma.Organization.findMany({
      select: {
        id: true,
        name: true,
        contactEmail: true,
        contactName: true,
        contactPhone: true,
      },
    });

    console.log(`   Нийт байгууллага: ${organizations.length}`);
    
    const withEmail = organizations.filter(org => org.contactEmail);
    const withoutEmail = organizations.filter(org => !org.contactEmail);

    console.log(`   ✅ contactEmail байгаа: ${withEmail.length}`);
    console.log(`   ❌ contactEmail байхгүй: ${withoutEmail.length}`);

    if (withEmail.length > 0) {
      console.log('\n   contactEmail байгаа байгууллагууд:');
      withEmail.forEach(org => {
        console.log(`      - ${org.name} (ID: ${org.id}): ${org.contactEmail}`);
        if (org.contactName) {
          console.log(`        Хариуцсан хүн: ${org.contactName}`);
        }
      });
    }

    if (withoutEmail.length > 0) {
      console.log('\n   contactEmail байхгүй байгууллагууд:');
      withoutEmail.forEach(org => {
        console.log(`      - ${org.name} (ID: ${org.id})`);
      });
      console.log('\n   ⚠️  Анхаар: Эдгээр байгууллагуудын contactEmail тохируулах хэрэгтэй!');
    }
  } catch (error) {
    console.log('   ❌ Database-аас organization-уудыг авахад алдаа гарлаа:');
    console.log('      Error:', error.message);
  }

  // 4. Inspection-уудын organization-ууд шалгах
  console.log('\n4. Inspection-уудын organization-ууд:');
  try {
    const inspections = await prisma.Inspection.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        status: true,
        organization: {
          select: {
            id: true,
            name: true,
            contactEmail: true,
            contactName: true,
          },
        },
      },
      take: 10,
    });

    console.log(`   Сүүлийн ${inspections.length} үзлэг:`);
    inspections.forEach(inspection => {
      const org = inspection.organization;
      const hasEmail = org.contactEmail ? '✅' : '❌';
      console.log(`      ${hasEmail} ${inspection.title} (${inspection.status})`);
      console.log(`         Байгууллага: ${org.name}`);
      if (org.contactEmail) {
        console.log(`         Email: ${org.contactEmail}`);
      } else {
        console.log(`         Email: Байхгүй`);
      }
    });
  } catch (error) {
    console.log('   ❌ Database-аас inspection-уудыг авахад алдаа гарлаа:');
    console.log('      Error:', error.message);
  }

  console.log('\n=== Шалгалт дууссан ===');
}

// Run check
checkEmailConfig()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Алдаа:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


