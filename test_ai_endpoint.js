// Test script for AI endpoint - we'll repurpose this for API testing
const { parseProductType, parseColor, parseSize } = require('./test_helpers');

// Test cases for product parsing
const testProducts = [
  "Худи черное XL",
  "Футболка белая M", 
  "Свитшот синий S",
  "Худи укороченное черное L",
  "Print Design Black XXL",
  "Unknown Product",
];

console.log("Testing product parsing logic:");
testProducts.forEach(product => {
  const type = parseProductType(product);
  const color = parseColor(product);
  const size = parseSize(product);
  console.log(`Product: "${product}"`);
  console.log(`  Type: ${type}, Color: ${color}, Size: ${size}`);
  console.log(`  Group Key: ${type}_${color}_${size}`);
  console.log("---");
});

// Test material type mapping
const materialTypeMapping = {
  tshirt: "футболка",
  hoodie: "худи", 
  cropped_hoodie: "укороченное худи",
  sweatshirt: "свитшот",
  unknown: "",
};

console.log("\nMaterial type mapping:");
Object.entries(materialTypeMapping).forEach(([key, value]) => {
  console.log(`${key} -> ${value}`);
});