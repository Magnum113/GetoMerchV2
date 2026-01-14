/**
 * Test script to verify the update-all-recipes functionality
 * This script simulates calling the API endpoint to update recipes
 */

const fetch = require('node-fetch');

async function testUpdateRecipes() {
  console.log('🧪 Testing update-all-recipes functionality...\n');

  try {
    // Test the update-all-recipes endpoint
    console.log('📦 Calling update-all-recipes endpoint...');
    
    const response = await fetch('http://localhost:3000/api/production/update-all-recipes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        confirmUpdate: true,
        backupFirst: true,
      }),
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Update successful!');
      console.log(`🗑️  Deleted: ${result.deletedCount} recipes`);
      console.log(`🆕 Created: ${result.createdCount} recipes`);
      console.log(`📊 Total groups: ${result.totalGroups}`);
      
      if (result.errors > 0) {
        console.log(`⚠️  Errors: ${result.errors}`);
        console.log('Error details:', result.errorsList);
      }
      
      // Show some sample recipes
      if (result.recipes && result.recipes.length > 0) {
        console.log('\n📋 Sample recipes created:');
        result.recipes.slice(0, 5).forEach((recipe, index) => {
          console.log(`  ${index + 1}. ${recipe.groupKey} (${recipe.productCount} products)`);
        });
        if (result.recipes.length > 5) {
          console.log(`  ... and ${result.recipes.length - 5} more`);
        }
      }
      
      return true;
    } else {
      console.error('❌ Update failed:', result.error);
      console.error('Step:', result.step || 'unknown');
      if (result.deletedCount !== undefined) {
        console.error('Partially deleted:', result.deletedCount, 'recipes');
      }
      return false;
    }
  } catch (error) {
    console.error('❌ Network or server error:', error.message);
    return false;
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testUpdateRecipes().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testUpdateRecipes };