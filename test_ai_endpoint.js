// Простой тест для проверки AI endpoint
// Запустите: node test_ai_endpoint.js

const fetch = require('node-fetch');

async function testAIEndpoint() {
  console.log('🧪 Testing AI Summary Endpoint...');
  
  try {
    const response = await fetch('http://localhost:3000/api/ai/summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ AI Endpoint works!');
      console.log('📊 Summary:', data.summary);
      console.log('📋 Context:', JSON.stringify(data.context, null, 2));
    } else {
      console.log('❌ Error:', data.error);
      console.log('📝 Details:', data.details);
    }
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

// Запуск теста
if (require.main === module) {
  testAIEndpoint();
}

module.exports = { testAIEndpoint };
