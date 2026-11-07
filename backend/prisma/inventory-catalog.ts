import { Prisma, PrismaClient } from '@prisma/client';

const ingredientDefinitions = [
  { key: 'coffee', id: 'ing-coffee', name: 'Hạt cà phê Robusta & Arabica', unit: 'g', initialQuantity: 10000, lowStockThreshold: 300 },
  { key: 'condensedMilk', id: 'ing-condensed-milk', name: 'Sữa đặc thượng hạng', unit: 'ml', initialQuantity: 8000, lowStockThreshold: 200 },
  { key: 'freshMilk', id: 'ing-fresh-milk', name: 'Sữa tươi thanh trùng', unit: 'ml', initialQuantity: 15000, lowStockThreshold: 500 },
  { key: 'saltedFoam', id: 'ing-salted-foam', name: 'Bọt sữa muối biển', unit: 'g', initialQuantity: 5000, lowStockThreshold: 150 },
  { key: 'cheeseFoam', id: 'ing-cheese-foam', name: 'Kem Cheese béo ngậy', unit: 'g', initialQuantity: 5000, lowStockThreshold: 150 },
  { key: 'coffeeJelly', id: 'ing-coffee-jelly', name: 'Thạch cà phê giòn dai', unit: 'g', initialQuantity: 5000, lowStockThreshold: 200 },
  { key: 'blackPearl', id: 'ing-black-pearl', name: 'Trân châu đen hoàng kim', unit: 'g', initialQuantity: 5000, lowStockThreshold: 250 },
  { key: 'flan', id: 'ing-flan', name: 'Bánh Flan mềm mịn', unit: 'cái', initialQuantity: 100, lowStockThreshold: 10 },
] as const;

type RecipeLine = { key: (typeof ingredientDefinitions)[number]['key']; quantity: number };

function getSizes(product: { category: string; sizes: Prisma.JsonValue | null }) {
  if (Array.isArray(product.sizes)) {
    const sizes = product.sizes.flatMap((entry) => {
      if (
        typeof entry === 'object' &&
        entry !== null &&
        !Array.isArray(entry) &&
        typeof entry.size === 'string'
      ) {
        return [entry.size];
      }
      return [];
    });
    if (sizes.length) return sizes;
  }
  return ['S', 'M', 'L'];
}

function getBaseRecipe(product: { id: string; name: string }): RecipeLine[] {
  const name = product.name.toLowerCase();

  // Bạc xỉu: ít cà phê, nhiều sữa đặc và sữa tươi
  if (name.includes('bạc xỉu')) {
    return [
      { key: 'coffee', quantity: 12 },
      { key: 'condensedMilk', quantity: 25 },
      { key: 'freshMilk', quantity: 80 },
    ];
  }

  // Cà phê sữa đá: cà phê đậm, sữa đặc ngọt béo
  if (name.includes('sữa')) {
    return [
      { key: 'coffee', quantity: 18 },
      { key: 'condensedMilk', quantity: 25 },
    ];
  }

  // Cà phê muối: cà phê phin, sữa đặc kết hợp bọt sữa muối biển
  if (name.includes('muối')) {
    return [
      { key: 'coffee', quantity: 18 },
      { key: 'condensedMilk', quantity: 20 },
      { key: 'saltedFoam', quantity: 35 },
    ];
  }

  // Cappuccino: Espresso + sữa tươi nóng + bọt sữa
  if (name.includes('cappuccino')) {
    return [
      { key: 'coffee', quantity: 18 },
      { key: 'freshMilk', quantity: 100 },
    ];
  }

  // Latte: Espresso + nhiều sữa tươi
  if (name.includes('latte')) {
    return [
      { key: 'coffee', quantity: 16 },
      { key: 'freshMilk', quantity: 120 },
    ];
  }

  // Cold Brew: Cà phê Arabica ngâm ủ
  if (name.includes('cold brew')) {
    return [
      { key: 'coffee', quantity: 20 },
    ];
  }

  // Americano hoặc cà phê đen đá
  return [
    { key: 'coffee', quantity: 18 },
  ];
}

export async function seedInventoryCatalog(prisma: PrismaClient) {
  const ingredientIds = new Map<string, string>();
  for (const definition of ingredientDefinitions) {
    const ingredient = await prisma.ingredient.upsert({
      where: { name: definition.name },
      update: {
        currentQuantity: definition.initialQuantity,
        lowStockThreshold: definition.lowStockThreshold,
        version: 0,
        isActive: true,
      },
      create: {
        id: definition.id,
        name: definition.name,
        unit: definition.unit,
        currentQuantity: definition.initialQuantity,
        lowStockThreshold: definition.lowStockThreshold,
        version: 0,
        isActive: true,
      },
    });
    ingredientIds.set(definition.key, ingredient.id);
  }

  const getIngredientId = (key: RecipeLine['key']) => {
    const id = ingredientIds.get(key);
    if (!id) throw new Error(`Missing ingredient catalog entry: ${key}`);
    return id;
  };

  const toppingIngredientById: Record<
    string,
    { key: RecipeLine['key']; quantity: number }
  > = {
    'top-salted-foam': { key: 'saltedFoam', quantity: 35 },
    'top-cheese-foam': { key: 'cheeseFoam', quantity: 35 },
    'top-espresso-shot': { key: 'coffee', quantity: 15 },
    'top-coffee-jelly': { key: 'coffeeJelly', quantity: 40 },
    'top-pearl': { key: 'blackPearl', quantity: 40 },
    'top-flan': { key: 'flan', quantity: 1 },
  };

  for (const [toppingId, line] of Object.entries(toppingIngredientById)) {
    const existing = await prisma.recipe.findFirst({ where: { toppingId } });
    if (existing) continue;
    const topping = await prisma.topping.findUnique({ where: { id: toppingId } });
    if (!topping) continue;
    await prisma.recipe.create({
      data: {
        toppingId,
        isProvisional: false,
        items: {
          create: {
            ingredientId: getIngredientId(line.key),
            quantity: line.quantity,
          },
        },
      },
    });
  }

  const products = await prisma.product.findMany();
  for (const product of products) {
    for (const size of getSizes(product)) {
      const existing = await prisma.recipe.findFirst({
        where: { productId: product.id, size },
      });
      if (existing) continue;

      const factor = size === 'S' ? 1 : size === 'L' ? 1.5 : 1.25;
      const lines = getBaseRecipe(product);
      if (!lines.length) continue;

      await prisma.recipe.create({
        data: {
          productId: product.id,
          size,
          isProvisional: false,
          items: {
            create: lines.map((line) => ({
              ingredientId: getIngredientId(line.key),
              quantity: line.quantity * factor,
            })),
          },
        },
      });
    }
  }

  return { ingredients: ingredientDefinitions.length, recipes: await prisma.recipe.count() };
}
