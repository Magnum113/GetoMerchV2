export type ProductType = "tshirt" | "hoodie" | "cropped_hoodie" | "sweatshirt" | "unknown"
export type ProductColor = "black" | "white" | "blue" | "gray" | "unknown"
export type ProductSize = "XXL" | "XL" | "L" | "M" | "S" | "unknown"

export function parseProductType(name: string): ProductType {
  const lowerName = name.toLowerCase()
  if (lowerName.includes("hoodie") && lowerName.includes("укороченное")) {
    return "cropped_hoodie"
  }
  if (lowerName.includes("hoodie") || lowerName.includes("худи")) {
    return "hoodie"
  }
  if (
    lowerName.includes("tshirt") ||
    lowerName.includes("футболка") ||
    lowerName.includes("print") ||
    lowerName.includes("emb")
  ) {
    return "tshirt"
  }
  if (lowerName.includes("sweatshirt") || lowerName.includes("свитшот")) {
    return "sweatshirt"
  }
  return "unknown"
}

export function parseColor(name: string): ProductColor {
  const lowerName = name.toLowerCase()
  if (lowerName.includes("black") || lowerName.includes("черн")) {
    return "black"
  }
  if (lowerName.includes("white") || lowerName.includes("бел")) {
    return "white"
  }
  if (lowerName.includes("blue") || lowerName.includes("син")) {
    return "blue"
  }
  if (lowerName.includes("gray") || lowerName.includes("grey") || lowerName.includes("сер")) {
    return "gray"
  }
  return "unknown"
}

export function parseSize(name: string): ProductSize {
  const sizes: ProductSize[] = ["XXL", "XL", "L", "M", "S"]
  for (const size of sizes) {
    if (name.includes(`-${size}`) || name.includes(` ${size}`) || name.endsWith(size)) {
      return size
    }
  }
  return "unknown"
}
