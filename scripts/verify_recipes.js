/**
 * Verification script to check that recipes are created correctly
 * This script verifies the grouping logic and recipe structure
 */

const fetch = require('node-fetch');

async function verifyRecipes() {
  console.log('🔍 Verifying recipe creation and grouping...\n');

  try {
    // Get all active recipes
    console.log('📋 Fetching all active recipes...');
    const recipesResponse = await fetch('http://localhost:3000/api/production/recipes');
    const recipes = await recipesResponse.json();

    if (!recipes.success || !recipes.data) {
      console.error('❌ Failed to fetch recipes:', recipes.error);
      return false;
    }

    console.log(`📊 Found ${recipes.data.length} active recipes`);

    // Verify recipe structure
    const validRecipes = recipes.data.filter(recipe => {
      const hasName = recipe.name && typeof recipe.name === 'string';
      const hasId = recipe.id && typeof recipe.id === 'string';
      const isActive = recipe.is_active === true;
      return hasName && hasId && isActive;
    });

    console.log(`✅ ${validRecipes.length} recipes have valid structure`);

    // Check for proper grouping patterns
    const groupingPatterns = {
      hoodie: 0,
      tshirt: 0,
      sweatshirt: 0,
      cropped_hoodie: 0,
      unknown: 0
    };

    const colorPatterns = {
      black: 0,
      white: 0,
      blue: 0,
      gray: 0,
      unknown: 0
    };

    const sizePatterns = {
      S: 0,
      M: 0,
      L: 0,
      XL: 0,
      XXL: 0,
      unknown: 0
    };

    validRecipes.forEach(recipe => {
      const nameLower = recipe.name.toLowerCase();

      // Check product types
      if (nameLower.includes('худи укороченное') || nameLower.includes('cropped')) {
        groupingPatterns.cropped_hoodie++;
      } else if (nameLower.includes('худи')) {
        groupingPatterns.hoodie++;
      } else if (nameLower.includes('свитшот')) {
        groupingPatterns.sweatshirt++;
      } else if (nameLower.includes('футболка') || nameLower.includes('print') || nameLower.includes('emb')) {
        groupingPatterns.tshirt++;
      } else {
        groupingPatterns.unknown++;
      }

      // Check colors
      if (nameLower.includes('черн')) {
        colorPatterns.black++;
      } else if (nameLower.includes('бел')) {
        colorPatterns.white++;
      } else if (nameLower.includes('син')) {
        colorPatterns.blue++;
      } else if (nameLower.includes('сер')) {
        colorPatterns.gray++;
      } else {
        colorPatterns.unknown++;
      }

      // Check sizes
      if (nameLower.includes('xxl')) {
        sizePatterns.XXL++;
      } else if (nameLower.includes('xl')) {
        sizePatterns.XL++;
      } else if (nameLower.includes('l')) {
        sizePatterns.L++;
      } else if (nameLower.includes('m')) {
        sizePatterns.M++;
      } else if (nameLower.includes('s')) {
        sizePatterns.S++;
      } else {
        sizePatterns.unknown++;
      }
    });

    console.log('\n📈 Grouping Analysis:');
    console.log('Product Types:');
    Object.entries(groupingPatterns).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    console.log('\nColors:');
    Object.entries(colorPatterns).forEach(([color, count]) => {
      console.log(`  ${color}: ${count}`);
    });

    console.log('\nSizes:');
    Object.entries(sizePatterns).forEach(([size, count]) => {
      console.log(`  ${size}: ${count}`);
    });

    // Check for sample recipe details
    if (validRecipes.length > 0) {
      console.log('\n📋 Sample Recipe Details:');
      const sampleRecipe = validRecipes[0];
      console.log(`Name: ${sampleRecipe.name}`);
      console.log(`ID: ${sampleRecipe.id}`);
      console.log(`Active: ${sampleRecipe.is_active}`);
      console.log(`Description: ${sampleRecipe.description || 'N/A'}`);
    }

    // Overall verification
    const allRecipesValid = validRecipes.length === recipes.data.length;
    const hasMultipleTypes = Object.values(groupingPatterns).filter(count => count > 0).length > 1;
    const hasMultipleColors = Object.values(colorPatterns).filter(count => count > 0).length > 1;
    const hasMultipleSizes = Object.values(sizePatterns).filter(count => count > 0).length > 1;

    console.log('\n✅ Verification Results:');
    console.log(`All recipes valid: ${allRecipesValid ? '✅' : '❌'}`);
    console.log(`Multiple product types: ${hasMultipleTypes ? '✅' : '❌'}`);
    console.log(`Multiple colors: ${hasMultipleColors ? '✅' : '❌'}`);
    console.log(`Multiple sizes: ${hasMultipleSizes ? '✅' : '❌'}`);

    return allRecipesValid && (hasMultipleTypes || hasMultipleColors || hasMultipleSizes);

  } catch (error) {
    console.error('❌ Verification error:', error.message);
    return false;
  }
}

// Run verification if this script is executed directly
if (require.main === module) {
  verifyRecipes().then(success => {
    console.log(`\n🎯 Overall verification: ${success ? '✅ PASSED' : '❌ FAILED'}`);
    process.exit(success ? 0 : 1);
  });
}

module.exports = { verifyRecipes };