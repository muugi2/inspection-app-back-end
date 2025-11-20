// Analyze the copied text from Word template
const copiedText = `No photo description available. 

АВТО ЖИН ХЭМЖҮҮРИЙН ҮЗЛЭГИЙН ХУУДАС 

Гэрээний мэдээл 

Гэрээт компанийн нэр 

{{d.contractor.company}} 

Гэрээний дугаар 

{{d.contractor.contract_no}} 

Холбоо барих 

{{d.contractor.contact}} 

Ерөнхий мэдээлэл 

Огноо 

{{d.metadata.date}} 

Шалгагч 

{{d.metadata.inspector}} 

Байршил 

{{d.metadata.location}} 

Авто жингийн дугаар 

{{d.metadata.scale_id_serial_no}} 

Модель 

{{d.metadata.model}} 

Автожингийн тавцан 

№ 

Үзлэгийн эд анги 

Төлөв 

Тайлбар  

1 

Мэдрэгчийн суурь 

{{d.exterior.sensor_base.status}} 

{{d.exterior.sensor_base.comment}} 

2 

Дам нуруу 

{{d.exterior.beam.status}} 

{{d.exterior.beam.comment}} 

3 

Тавцангийн лист 

{{d.exterior.platform_plate.status}} 

{{d.exterior.platform_plate.comment}} 

4 

Дам нуруу холбосон лист 

{{d.exterior.beam_joint_plate.status}} 

{{d.exterior.beam_joint_plate.comment}} 

5 

Хязгаарлагчийн боолт 

{{d.exterior.stop_bolt.status}} 

{{d.exterior.stop_bolt.comment}} 

6 

Тавцан хоорондын боолт 

{{d.exterior.interplatform_bolts.status}} 

{{d.exterior.interplatform_bolts.comment}} 

{{#d.hasImages.exterior.sensor_base}} 

Мэдрэгчийн суурь: 

{{#d.images.exterior.sensor_base}} 

image 

 

{{/d.images.exterior.sensor_base}} 

{{/d.hasImages.exterior.sensor_base}} 

{{#d.hasImages.exterior.beam}} 

Дам нуруу: 

{{#d.images.exterior.beam}} 

image 

{{/d.images.exterior.beam}} 

{{/d.hasImages.exterior.beam}} 

{{#d.hasImages.exterior.platform_plate}} 

Тавцангийн лист: 

{{#d.images.exterior.platform_plate}} 

image 

{{/d.images.exterior.platform_plate}} 

{{/d.hasImages.exterior.platform_plate}} 

{{#d.hasImages.exterior.beam_joint_plate}} 

Дам нуруу холбосон лист: 

{{#d.images.exterior.beam_joint_plate}} 

image 

{{/d.images.exterior.beam_joint_plate}} 

{{/d.hasImages.exterior.beam_joint_plate}} 

{{#d.hasImages.exterior.stop_bolt}} 

Хязгаарлагчийн боолт: 

{{#d.images.exterior.stop_bolt}} 

image 

 

{{/d.images.exterior.stop_bolt}} 

{{/d.hasImages.exterior.stop_bolt}} 

{{#d.hasImages.exterior.interplatform_bolts}} 

Тавцан хоорондын боолт: 

{{#d.images.exterior.interplatform_bolts}} 

image 

{{/d.images.exterior.interplatform_bolts}} 

{{/d.hasImages.exterior.interplatform_bolts}} 

Тооцоолуур 

№ 

Үзлэгийн эд анги 

Төлөв 

Тайлбар  

1 

Лед дэлгэц 

{{d.indicator.led_display.status}} 

{{d.indicator.led_display.comment}} 

2 

Тэжээлийн залгуур 

{{d.indicator.power_plug.status}} 

{{d.indicator.power_plug.comment}} 

3 

Лац болон лацны боолт 

{{d.indicator.seal_bolt.status}} 

{{d.indicator.seal_and_bolt.comment}} 

4 

Товчлуур 

{{d.indicator.buttons.status}} 

{{d.indicator.buttons.comment}} 

5 

Холбогч хайрцаг болон сигналын утас 

{{d.indicator.junction_wiring.status}} 

{{d.indicator.junction_wiring.comment}} 

6 

Сериал хөрвүүлэгч залгуур 

{{d.indicator.serial_converter.status}} 

{{d.indicator.serial_converter_plug.comment}} 

{{#d.hasImages.indicator.led_display}}  

Лед дэлгэц: 

 {{#d.images.indicator.led_display}}  

image 

{{/d.images.indicator.led_display}}  

{{/d.hasImages.indicator.led_display}} 

{{#d.hasImages.indicator.power_plug}}  

Тэжээлийн залгуур:  

{{#d.images.indicator.power_plug}}  

image 

{{/d.images.indicator.power_plug}}  

{{/d.hasImages.indicator.power_plug}} 

{{#d.hasImages.indicator.seal_and_bolt}}  

Лац болон лацны боолт:  

{{#d.images.indicator.seal_and_bolt}}  

image 

{{/d.images.indicator.seal_and_bolt}}  

{{/d.hasImages.indicator.seal_and_bolt}} 

{{#d.hasImages.indicator.buttons}}  

Товчлуур:  

 

{{#d.images.indicator.buttons}}  

image 

{{/d.images.indicator.buttons}}  

{{/d.hasImages.indicator.buttons}} 

{{#d.hasImages.indicator.junction_wiring}}  

Холбогч хайрцаг болон сигналын утас:  

{{#d.images.indicator.junction_wiring}}  

image 

{{/d.images.indicator.junction_wiring}}  

{{/d.hasImages.indicator.junction_wiring}} 

{{#d.hasImages.indicator.serial_converter_plug}}  

Сериал хөрвүүлэгч залгуур:  

{{#d.images.indicator.serial_converter_plug}}  

image 

{{/d.images.indicator.serial_converter_plug}} 

 {{/d.hasImages.indicator.serial_converter_plug}} 

Автожингийн холбогч хайрцаг 

№ 

Үзлэгийн эд анги 

Төлөв 

Тайлбар  

1 

Хайрцагны бүрэн бүтэн байдал 

{{d.jbox.box_integrity.status}} 

{{d.jbox.box_integrity.comment}} 

2 

Сигналын утас цуглуулагч хавтан 

{{d.jbox.collector_board.status}} 

{{d.jbox.collector_board.comment}} 

3 

Сигналын утас чангалагч 

{{d.jbox.wire_tightener.status}} 

{{d.jbox.wire_tightener.comment}} 

4 

Эсэргүүцлийн элемент 

{{d.jbox.resistor_element.status}} 

{{d.jbox.resistor_element.comment}} 

5 

Холбогч хайрцагны хамгаалалтын хайрцаг 

{{d.jbox.protective_box.status}} 

{{d.jbox.protective_box.comment}} 

{{#d.hasImages.jbox.box_integrity}} 

Хайрцагны бүрэн бүтэн байдал: 

{{#d.images.jbox.box_integrity}} 

 

{{/d.images.jbox.box_integrity}} 

{{/d.hasImages.jbox.box_integrity}} 

{{#d.hasImages.jbox.collector_board}} 

Сигналын утас цуглуулагч хавтан: 

{{#d.images.jbox.collector_board}} 

 

{{/d.images.jbox.collector_board}} 

{{/d.hasImages.jbox.collector_board}} 

{{#d.hasImages.jbox.wire_tightener}} 

Сигналын утас чангалагч: 

{{#d.images.jbox.wire_tightener}} 

 

{{/d.images.jbox.wire_tightener}} 

{{/d.hasImages.jbox.wire_tightener}} 

{{#d.hasImages.jbox.resistor_element}} 

Эсэргүүцлийн элемент: 

{{#d.images.jbox.resistor_element}} 

 

{{/d.images.jbox.resistor_element}} 

{{/d.hasImages.jbox.resistor_element}} 

{{#d.hasImages.jbox.protective_box}} 

Холбогч хайрцагны хамгаалалтын хайрцаг: 

{{#d.images.jbox.protective_box}} 

 

 

{{/d.images.jbox.protective_box}} 

{{/d.hasImages.jbox.protective_box}} 

Мэдрэгч элемент 

№ 

Үзлэгийн эд анги 

Төлөв 

Тайлбар  

1 

Сигналын утас 

{{d.sensor.signal_wire.status}} 

{{d.sensor.signal_wire.comment}} 

2 

Шаариг 

{{d.sensor.ball.status}} 

{{d.sensor.ball.comment}} 

3 

Мэдрэгчийн суурь 

{{d.sensor.base.status}} 

{{d.sensor.base.comment}} 

4 

Шааригны аяган суурь /нимгэн/ 

{{d.sensor.ball_cup_thin.status}} 

{{d.sensor.ball_cup_thin.comment}} 

5 

Ялтсан хавтан 

{{d.sensor.plate.status}} 

{{d.sensor.plate.comment}} 

{{#d.hasImages.sensor.signal_wire}}  

Сигналын утас:  

{{#d.images.sensor.signal_wire}}  

 

{{/d.images.sensor.signal_wire}}  

{{/d.hasImages.sensor.signal_wire}} 

{{#d.hasImages.sensor.ball}}  

Шаариг:  

{{#d.images.sensor.ball}}  

 

{{/d.images.sensor.ball}}  

{{/d.hasImages.sensor.ball}} 

{{#d.hasImages.sensor.base}}  

Мэдрэгчийн суурь:  

{{#d.images.sensor.base}}  

 

{{/d.images.sensor.base}}  

{{/d.hasImages.sensor.base}} 

{{#d.hasImages.sensor.ball_cup_thin}}  

Шааригны аяган суурь /нимгэн/:  

{{#d.images.sensor.ball_cup_thin}}  

 

{{/d.images.sensor.ball_cup_thin}}  

{{/d.hasImages.sensor.ball_cup_thin}} 

{{#d.hasImages.sensor.plate}}  

Ялтсан хавтан:  

{{#d.images.sensor.plate}}  

 

{{/d.images.sensor.plate}}  

{{/d.hasImages.sensor.plate}} 

Суурь 

№ 

Үзлэгийн эд анги 

Төлөв 

Тайлбар  

1 

Хөндлөн суурь 

{{d.foundation.cross_base.status}} 

{{d.foundation.cross_base.status}} 

{{d.foundation.cross_base.comment}} 

2 

Суурийн анкщр лист 

{{d.foundation.anchor_plate.status}} 

{{d.foundation.anchor_plate.comment}} 

3 

Пандусын угольник 

{{d.foundation.ramp_angle.status}} 

{{d.foundation.ramp_angle.comment}} 

4 

Пандусын өшиглүүр 

{{d.foundation.ramp_stopper.status}} 

{{d.foundation.ramp_stopper.comment}} 

5 

Пандус 

{{d.foundation.ramp.status}} 

{{d.foundation.ramp.comment}} 

6 

Нил суурь 

{{d.foundation.slab_base.status}} 

{{d.foundation.slab_base.comment}} 

{{#d.hasImages.foundation.cross_base}} 

Хөндлөн суурь: 

{{#d.images.foundation.cross_base}} 

 

{{/d.images.foundation.cross_base}} 

{{/d.hasImages.foundation.cross_base}} 

{{#d.hasImages.foundation.anchor_plate}} 

Суурийн анкщр лист: 

{{#d.images.foundation.anchor_plate}} 

 

{{/d.images.foundation.anchor_plate}} 

{{/d.hasImages.foundation.anchor_plate}} 

{{#d.hasImages.foundation.ramp_angle}} 

Пандусын угольник: 

{{#d.images.foundation.ramp_angle}} 

 

{{/d.images.foundation.ramp_angle}} 

{{/d.hasImages.foundation.ramp_angle}} 

{{#d.hasImages.foundation.ramp_stopper}} 

Пандусын өшиглүүр: 

{{#d.images.foundation.ramp_stopper}} 

 

{{/d.images.foundation.ramp_stopper}} 

{{/d.hasImages.foundation.ramp_stopper}} 

{{#d.hasImages.foundation.ramp}} 

Пандус: 

{{#d.images.foundation.ramp}} 

 

{{/d.images.foundation.ramp}} 

{{/d.hasImages.foundation.ramp}} 

{{#d.hasImages.foundation.slab_base}} 

Нил суурь: 

{{#d.images.foundation.slab_base}} 

 

{{/d.images.foundation.slab_base}} 

{{/d.hasImages.foundation.slab_base}} 

Автожингийн бохирдол 

№ 

Үзлэгийн эд анги 

Төлөв 

Тайлбар  

1 

Тавцангийн доод тал 

{{d.cleanliness.under_platform.status}} 

{{d.cleanliness.under_platform.comment}} 

2 

Тавцангийн дээд тал 

{{d.cleanliness.top_platform.status}} 

{{d.cleanliness.top_platform.comment}} 

3 

Автожингийн тавцан болон Пандус хоорондын завсар 

{{d.cleanliness.gap_platform_ramp.status}} 

{{d.cleanliness.gap_platform_ramp.comment}} 

4 

Автожингийн 2 талын талбай 

{{d.cleanliness.both_sides_area.status}} 

{{d.cleanliness.both_sides_area.comment}} 

{{#d.hasImages.cleanliness.under_platform}} 

 Тавцангийн доод тал:  

{{#d.images.cleanliness.under_platform}}  

 

{{/d.images.cleanliness.under_platform}}  

{{/d.hasImages.cleanliness.under_platform}} 

{{#d.hasImages.cleanliness.top_platform}}  

Тавцангийн дээд тал:  

{{#d.images.cleanliness.top_platform}}  

 

{{/d.images.cleanliness.top_platform}}  

{{/d.hasImages.cleanliness.top_platform}} 

{{#d.hasImages.cleanliness.gap_platform_ramp}}  

Автожингийн тавцан болон Пандус хоорондын завсар: 

 {{#d.images.cleanliness.gap_platform_ramp}}  

 

{{/d.images.cleanliness.gap_platform_ramp}} 

 {{/d.hasImages.cleanliness.gap_platform_ramp}} 

{{#d.hasImages.cleanliness.both_sides_area}}  

Автожингийн 2 талын талбай:  

{{#d.images.cleanliness.both_sides_area}}  

 

{{/d.images.cleanliness.both_sides_area}}  

{{/d.hasImages.cleanliness.both_sides_area}}`;

// Find all loop placeholders
const loopPattern = /\{\{#d\.images\.([^\}]+)\}\}/g;
const loops = [];
let match;

while ((match = loopPattern.exec(copiedText)) !== null) {
  const path = match[1];
  const openIndex = match.index;
  const openFull = match[0];
  
  // Find closing placeholder
  const closePattern = new RegExp(`\\{\\{/d\\.images\\.${path.replace(/\./g, '\\.')}\\}\\}`);
  const closeMatch = copiedText.substring(openIndex).match(closePattern);
  
  if (closeMatch) {
    const closeIndex = openIndex + closeMatch.index;
    const closeFull = closeMatch[0];
    const loopContent = copiedText.substring(openIndex, closeIndex + closeFull.length);
    
    // Check for "image" text
    const hasImageText = /image/.test(loopContent);
    const imageTextMatches = loopContent.match(/image/g) || [];
    
    loops.push({
      path,
      hasImageText,
      imageTextCount: imageTextMatches.length,
      loopContent: loopContent.replace(/\s+/g, ' ').substring(0, 200),
    });
  }
}

console.log('='.repeat(80));
console.log('ANALYSIS OF COPIED TEXT FROM TEMPLATE');
console.log('='.repeat(80));
console.log('');

console.log(`Found ${loops.length} loops\n`);

const issues = [];

loops.forEach((loop, i) => {
  console.log(`${i + 1}. ${loop.path}:`);
  
  if (loop.hasImageText) {
    console.log(`   ❌ PROBLEM: Has "image" TEXT instead of placeholder image`);
    console.log(`      - "image" text appears ${loop.imageTextCount} time(s)`);
    console.log(`      - Content: ${loop.loopContent}`);
    issues.push({
      type: 'text_instead_of_image',
      path: loop.path,
    });
  } else {
    console.log(`   ⚠️  WARNING: Loop exists but no "image" text found`);
    console.log(`      - Content: ${loop.loopContent}`);
    issues.push({
      type: 'missing_image_placeholder',
      path: loop.path,
    });
  }
  console.log('');
});

// Check for field name mismatches
console.log('='.repeat(80));
console.log('FIELD NAME MISMATCHES:');
console.log('='.repeat(80));
console.log('');

// Check seal_and_bolt vs seal_bolt
const sealAndBoltLoops = loops.filter(l => l.path.includes('seal_and_bolt'));
if (sealAndBoltLoops.length > 0) {
  console.log('❌ Template uses "seal_and_bolt" but code expects "seal_bolt"');
  sealAndBoltLoops.forEach(loop => {
    console.log(`   - ${loop.path}`);
  });
}

// Check other field mismatches
const fieldMismatches = [];
if (copiedText.includes('{{d.indicator.seal_and_bolt.comment}}')) {
  console.log('❌ Template uses "seal_and_bolt" in status/comment but code expects "seal_bolt"');
  fieldMismatches.push('indicator.seal_and_bolt -> indicator.seal_bolt');
}
if (copiedText.includes('{{d.indicator.serial_converter.status}}')) {
  console.log('❌ Template uses "serial_converter" in status but code expects "serial_converter_plug"');
  fieldMismatches.push('indicator.serial_converter -> indicator.serial_converter_plug');
}

// Summary
console.log('\n' + '='.repeat(80));
console.log('SUMMARY:');
console.log('='.repeat(80));
console.log('');
console.log(`Total loops: ${loops.length}`);
console.log(`Issues found: ${issues.length}`);
console.log(`Field name mismatches: ${fieldMismatches.length + sealAndBoltLoops.length}`);
console.log('');

if (issues.length > 0) {
  const textIssues = issues.filter(i => i.type === 'text_instead_of_image');
  const missingIssues = issues.filter(i => i.type === 'missing_image_placeholder');
  
  console.log('ISSUE BREAKDOWN:');
  console.log(`  - Loops with "image" TEXT (need placeholder image): ${textIssues.length}`);
  console.log(`  - Loops missing image placeholder: ${missingIssues.length}`);
  console.log('');
  
  if (textIssues.length > 0) {
    console.log('LOOPS WITH "image" TEXT (need to replace with placeholder image):');
    textIssues.forEach(issue => {
      console.log(`  ❌ ${issue.path}`);
    });
    console.log('');
  }
  
  if (missingIssues.length > 0) {
    console.log('LOOPS MISSING IMAGE PLACEHOLDER:');
    missingIssues.forEach(issue => {
      console.log(`  ❌ ${issue.path}`);
    });
    console.log('');
  }
}

if (fieldMismatches.length > 0 || sealAndBoltLoops.length > 0) {
  console.log('FIELD NAME MISMATCHES:');
  if (sealAndBoltLoops.length > 0) {
    console.log('  ❌ Template uses "seal_and_bolt" but code expects "seal_bolt"');
    console.log('     Fix: Change all "seal_and_bolt" to "seal_bolt" in template');
  }
  fieldMismatches.forEach(mismatch => {
    console.log(`  ❌ ${mismatch}`);
  });
  console.log('');
}

