const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkInspection14() {
  try {
    console.log('='.repeat(80));
    console.log('Checking inspection ID 14 answers and images');
    console.log('='.repeat(80));
    console.log('');

    // Get all answers for inspection 14
    const answers = await prisma.inspectionAnswer.findMany({
      where: { inspectionId: BigInt(14) },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`Found ${answers.length} answer record(s) for inspection 14:`);
    answers.forEach(answer => {
      console.log(`  Answer ID ${answer.id.toString()}:`);
      console.log(`    Created: ${answer.createdAt}`);
      console.log(`    Answered: ${answer.answeredAt}`);
      console.log(`    Has sections: ${Object.keys(answer.answers || {}).join(', ')}`);
    });

    console.log('');

    // Get all images for inspection 14
    const images = await prisma.$queryRaw`
      SELECT 
        qi.id,
        qi.answer_id,
        qi.field_id,
        qi.section,
        qi.image_order,
        qi.image_url,
        ia.inspection_id
      FROM inspection_question_images qi
      LEFT JOIN inspection_answers ia ON ia.id = qi.answer_id
      WHERE ia.inspection_id = ${BigInt(14)} OR qi.answer_id IS NULL
      ORDER BY qi.answer_id, qi.section, qi.field_id, qi.image_order
    `;

    console.log(`Found ${images.length} image(s) for inspection 14:`);
    images.forEach(img => {
      console.log(`  Image ID ${img.id?.toString()}: answer_id=${img.answer_id?.toString() || 'NULL'}, ${img.section}.${img.field_id} (order ${img.image_order})`);
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkInspection14();

