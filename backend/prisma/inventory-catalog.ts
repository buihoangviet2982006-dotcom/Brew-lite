import { Prisma, PrismaClient } from '@prisma/client';

const ingredientDefinitions = [
  { key: 'coffee', id: 'ing-coffee', name: 'Hạt cà phê', unit: 'g' },
  { key: 'condensedMilk', id: 'ing-condensed-milk', name: 'Sữa đặc', unit: 'ml' },
  { key: 'freshMilk', id: 'ing-fresh-milk', name: 'Sữa tươi', unit: 'ml' },
  { key: 'jasmineTea', id: 'ing-jasmine-tea', name: 'Trà lài', unit: 'g' },
  { key: 'oolongTea', id: 'ing-oolong-tea', name: 'Trà ô long', unit: 'g' },
  { key: 'matcha', id: 'ing-matcha', name: 'Bột matcha', unit: 'g' },
  { key: 'chocolate', id: 'ing-chocolate', name: 'Bột chocolate', unit: 'g' },
  { key: 'peachSyrup', id: 'ing-peach-syrup', name: 'Siro đào', unit: 'ml' },
  { key: 'peach', id: 'ing-peach', name: 'Đào ngâm', unit: 'g' },
  { key: 'lotus', id: 'ing-lotus', name: 'Hạt sen', unit: 'g' },
  { key: 'lychee', id: 'ing-lychee', name: 'Vải ngâm', unit: 'g' },
  { key: 'plum', id: 'ing-plum', name: 'Mận', unit: 'g' },
  { key: 'avocado', id: 'ing-avocado', name: 'Bơ', unit: 'g' },
  { key: 'durian', id: 'ing-durian', name: 'Sầu riêng', unit: 'g' },
  { key: 'almond', id: 'ing-almond', name: 'Hạnh nhân', unit: 'g' },
  { key: 'cheeseFoam', id: 'ing-cheese-foam', name: 'Kem cheese', unit: 'g' },
  { key: 'blackPearl', id: 'ing-black-pearl', name: 'Trân châu đen', unit: 'g' },
  { key: 'whitePearl', id: 'ing-white-pearl', name: 'Trân châu trắng', unit: 'g' },
  { key: 'peachTopping', id: 'ing-peach-topping', name: 'Đào topping', unit: 'g' },
  { key: 'grassJelly', id: 'ing-grass-jelly', name: 'Thạch sương sáo', unit: 'g' },
  { key: 'flan', id: 'ing-flan', name: 'Bánh flan', unit: 'cái' },
  { key: 'aloe', id: 'ing-aloe', name: 'Nha đam', unit: 'g' },
  { key: 'waterChestnut', id: 'ing-water-chestnut', name: 'Thạch củ năng', unit: 'g' },
  { key: 'saltedFoam', id: 'ing-salted-foam', name: 'Bọt sữa muối', unit: 'g' },
  { key: 'croissant', id: 'ing-croissant', name: 'Bánh Croissant Bơ Tỏi', unit: 'cái' },
  { key: 'mousse', id: 'ing-mousse', name: 'Bánh Mousse Chanh Leo', unit: 'cái' },
  { key: 'tiramisu', id: 'ing-tiramisu', name: 'Bánh Tiramisu Cacao Truyền Thống', unit: 'cái' },
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
  return product.category === 'bakery' ? ['STANDARD'] : ['S', 'M', 'L'];
}

function getBaseRecipe(product: { id: string; name: string; category: string }): RecipeLine[] {
  const name = product.name.toLowerCase();
  if (product.category === 'bakery') {
    const key =
      product.id === 'prod-bk-01'
        ? 'croissant'
        : product.id === 'prod-bk-02'
          ? 'mousse'
          : product.id === 'prod-bk-03'
            ? 'tiramisu'
            : null;
    return key ? [{ key, quantity: 1 }] : [];
  }
  if (
    product.category === 'coffee' ||
    name.includes('cà phê') ||
    name.includes('bạc xỉu') ||
    name.includes('americano') ||
    name.includes('cappuccino')
  ) {
    const lines: RecipeLine[] = [
      { key: 'coffee', quantity: name.includes('bạc xỉu') ? 12 : 18 },
    ];
    if (name.includes('sữa') || name.includes('bạc xỉu')) {
      lines.push({ key: 'condensedMilk', quantity: 25 });
    }
    if (name.includes('bạc xỉu') || name.includes('cappuccino')) {
      lines.push({ key: 'freshMilk', quantity: 100 });
    }
    if (name.includes('muối')) {
      lines.push({ key: 'saltedFoam', quantity: 35 });
    }
    return lines;
  }
  if (name.includes('matcha')) {
    return [
      { key: 'matcha', quantity: 8 },
      { key: 'freshMilk', quantity: 120 },
    ];
  }
  if (name.includes('chocolate')) {
    return [
      { key: 'chocolate', quantity: 25 },
      { key: 'freshMilk', quantity: 120 },
      { key: 'almond', quantity: 8 },
    ];
  }
  if (name.includes('bơ') || name.includes('sinh tố')) {
    return [
      { key: 'avocado', quantity: 100 },
      { key: 'durian', quantity: 30 },
      { key: 'freshMilk', quantity: 80 },
    ];
  }

  const teaKey = name.includes('ô long') || name.includes('sen') ? 'oolongTea' : 'jasmineTea';
  const lines: RecipeLine[] = [{ key: teaKey, quantity: 6 }];
  if (name.includes('đào')) {
    lines.push(
      { key: 'peachSyrup', quantity: 15 },
      { key: 'peach', quantity: 40 },
    );
  } else if (name.includes('sen')) {
    lines.push({ key: 'lotus', quantity: 35 });
  } else if (name.includes('vải')) {
    lines.push({ key: 'lychee', quantity: 45 });
  } else if (name.includes('mận')) {
    lines.push({ key: 'plum', quantity: 45 });
  } else if (name.includes('sữa')) {
    lines.push(
      { key: 'condensedMilk', quantity: 20 },
      { key: 'freshMilk', quantity: 80 },
    );
  }
  return lines;
}

export async function seedInventoryCatalog(prisma: PrismaClient) {
  const ingredientIds = new Map<string, string>();
  for (const definition of ingredientDefinitions) {
    const ingredient = await prisma.ingredient.upsert({
      where: { name: definition.name },
      update: {},
      create: {
        id: definition.id,
        name: definition.name,
        unit: definition.unit,
        currentQuantity: 0,
        lowStockThreshold: 0,
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
    'top-pearl': { key: 'blackPearl', quantity: 40 },
    'top-white-pearl': { key: 'whitePearl', quantity: 40 },
    'top-cheese': { key: 'cheeseFoam', quantity: 35 },
    'top-peach': { key: 'peachTopping', quantity: 45 },
    'top-lotus': { key: 'lotus', quantity: 35 },
    'top-jelly': { key: 'grassJelly', quantity: 40 },
    'top-flan': { key: 'flan', quantity: 1 },
    'top-aloe': { key: 'aloe', quantity: 40 },
    'top-popping': { key: 'waterChestnut', quantity: 35 },
    'top-foam': { key: 'saltedFoam', quantity: 35 },
  };

  for (const [toppingId, line] of Object.entries(toppingIngredientById)) {
    const existing = await prisma.recipe.findFirst({ where: { toppingId } });
    if (existing) continue;
    const topping = await prisma.topping.findUnique({ where: { id: toppingId } });
    if (!topping) continue;
    await prisma.recipe.create({
      data: {
        toppingId,
        isProvisional: true,
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

      const factor =
        size === 'S' ? 1 : size === 'L' ? 1.5 : size === 'STANDARD' ? 1 : 1.25;
      const lines = getBaseRecipe(product);
      if (!lines.length) continue;

      await prisma.recipe.create({
        data: {
          productId: product.id,
          size,
          isProvisional: true,
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
