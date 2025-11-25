const { TemplateHandler } = require('easy-template-x');
const fs = require('fs').promises;
const path = require('path');

async function testTemplate() {
  const templatePath = path.join(__dirname, '..', 'templates', 'template.docx');
  
  console.log('Testing template with easy-template-x...\n');
  
  const templateFile = await fs.readFile(templatePath);
  
  // Test with different configurations
  const configs = [
    {
      name: 'Default',
      options: {}
    },
    {
      name: 'With fixRawXml',
      options: {
        fixRawXml: true
      }
    },
    {
      name: 'With maxXmlDepth',
      options: {
        maxXmlDepth: 25
      }
    },
    {
      name: 'With both fixRawXml and maxXmlDepth',
      options: {
        fixRawXml: true,
        maxXmlDepth: 25
      }
    }
  ];
  
  const testData = {
    d: {
      contractor: {
        company: 'Test Company',
        contract_no: '123',
        contact: 'test@test.com'
      },
      metadata: {
        date: '2025-11-15',
        inspector: 'Test Inspector',
        location: 'Test Location',
        scale_id_serial_no: 'SN-001',
        model: 'Model X'
      },
      exterior: {
        sensor_base: {
          status: 'Good',
          comment: 'No issues',
          question: 'Test?'
        },
        beam: {
          status: 'Good',
          comment: ''
        }
      },
      remarks: 'Test remarks'
    }
  };
  
  for (const config of configs) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${config.name}`);
    console.log(`${'='.repeat(60)}\n`);
    
    try {
      const handler = new TemplateHandler(config.options);
      const buffer = await handler.process(templateFile, testData);
      
      console.log(`✅ SUCCESS! Generated ${buffer.length} bytes`);
      
      // Save output
      const outputPath = path.join(__dirname, '..', 'templates', `output-${config.name.replace(/\s+/g, '-').toLowerCase()}.docx`);
      await fs.writeFile(outputPath, buffer);
      console.log(`   Saved to: ${outputPath}`);
      
    } catch (error) {
      console.log(`❌ FAILED: ${error.message}`);
      
      if (error.openDelimiterText) {
        console.log(`   Open delimiter: "${error.openDelimiterText}"`);
      }
      
      if (error.stack) {
        const stackLines = error.stack.split('\n').slice(0, 3);
        console.log(`   Stack: ${stackLines.join('\n           ')}`);
      }
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('Test complete');
  console.log(`${'='.repeat(60)}\n`);
}

testTemplate()
  .then(() => {
    console.log('\n✅ All tests completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test error:', error);
    process.exit(1);
  });









