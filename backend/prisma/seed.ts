import { Prisma, PrismaClient, DiscountType, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { seedInventoryCatalog } from './inventory-catalog';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding for BrewLite (Specialty Coffee)...');

  // 0. Xóa sạch dữ liệu cũ theo đúng thứ tự ràng buộc khóa ngoại
  console.log('🧹 Clearing old database records...');
  await prisma.inventoryMovement.deleteMany();
  await prisma.orderIngredientUsage.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.voucher.deleteMany();
  await prisma.topping.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  console.log('✅ Cleared all existing tables.');

  // 1. Seed demo users (Customer, Barista)
  const passwordHash = await bcrypt.hash('password123', 10);

  await prisma.user.create({
    data: {
      id: 'usr-demo-01',
      email: 'customer@brewlite.vn',
      fullName: 'Khách Hàng BrewLite',
      role: UserRole.CUSTOMER,
      passwordHash,
      loyaltyPoints: 120,
    },
  });

  await prisma.user.create({
    data: {
      id: 'usr-barista-01',
      email: 'barista@brewlite.vn',
      fullName: 'Pha Chế Viên BrewLite',
      role: UserRole.BARISTA,
      passwordHash,
      loyaltyPoints: 0,
    },
  });
  console.log(`✅ Seeded users: Customer, Barista (Mật khẩu: password123)`);

  // 2. Seed toppings chuyên biệt cho Cà phê (giá siêu rẻ 500đ - 1.000đ thuận tiện test QR)
  const toppings = [
    { id: 'top-salted-foam', name: 'Lớp bọt sữa muối biển', price: 500, isActive: true },
    { id: 'top-cheese-foam', name: 'Kem Cheese Macchiato béo ngậy', price: 500, isActive: true },
    { id: 'top-espresso-shot', name: 'Thêm 1 Shot Espresso đậm đà', price: 1000, isActive: true },
    { id: 'top-coffee-jelly', name: 'Thạch cà phê giòn dai', price: 500, isActive: true },
    { id: 'top-pearl', name: 'Trân châu đen hoàng kim', price: 500, isActive: true },
    { id: 'top-flan', name: 'Bánh Flan caramel mềm mịn', price: 1000, isActive: true },
  ];

  for (const top of toppings) {
    await prisma.topping.upsert({
      where: { id: top.id },
      update: top,
      create: top,
    });
  }
  console.log(`✅ Seeded ${toppings.length} coffee toppings (giá 500đ - 1.000đ)`);

  // 3. Seed vouchers (điều chỉnh phù hợp với đơn giá 1k - 4k)
  const vouchers = [
    {
      id: 'vouch-brew10',
      code: 'BREWLITE10',
      description: 'Giảm 10% tối đa 1.000đ cho đơn từ 2.000đ',
      discountType: DiscountType.PERCENT,
      discountValue: 10,
      minOrderValue: 2000,
      maxDiscount: 1000,
      usageLimit: 500,
      isActive: true,
    },
    {
      id: 'vouch-banmoi',
      code: 'BANMOI',
      description: 'Giảm ngay 500đ cho khách hàng mới với đơn từ 1.500đ',
      discountType: DiscountType.FIXED,
      discountValue: 500,
      minOrderValue: 1500,
      maxDiscount: null,
      usageLimit: 500,
      isActive: true,
    },
  ];

  for (const vouch of vouchers) {
    await prisma.voucher.upsert({
      where: { id: vouch.id },
      update: vouch,
      create: vouch,
    });
  }
  console.log(`✅ Seeded ${vouchers.length} vouchers`);

  // 4. Seed 8 sản phẩm Cà Phê đặc sắc với mức giá siêu ưu đãi 1.000đ - 4.000đ
  const products = [
    {
      id: 'prod-cf-01',
      name: 'Cà phê sữa đá Sài Gòn',
      price: 1000,
      imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
      description: 'Hương vị cà phê Robusta Đắk Lắk đậm đà kết hợp sữa đặc béo ngậy truyền thống.',
      category: 'coffee',
      sizes: [
        { size: 'S', price: 1000 },
        { size: 'M', price: 2000 },
        { size: 'L', price: 3000 },
      ],
    },
    {
      id: 'prod-cf-02',
      name: 'Bạc xỉu 3 tầng BrewLite',
      price: 1500,
      imageUrl: 'https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
      description: 'Nhiều sữa ít cà phê, béo ngậy thơm lừng hòa quyện sữa tươi thanh trùng.',
      category: 'coffee',
      sizes: [
        { size: 'S', price: 1500 },
        { size: 'M', price: 2500 },
        { size: 'L', price: 3500 },
      ],
    },
    {
      id: 'prod-cf-03',
      name: 'Cà phê đen đá Robusta',
      price: 1000,
      imageUrl: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
      description: 'Đen đá đậm đà từ hạt Robusta rang mộc, thơm nồng tỉnh táo cả ngày dài.',
      category: 'coffee',
      sizes: [
        { size: 'S', price: 1000 },
        { size: 'M', price: 2000 },
        { size: 'L', price: 3000 },
      ],
    },
    {
      id: 'prod-cf-04',
      name: 'Americano đá thanh vị',
      price: 1000,
      imageUrl: 'https://images.unsplash.com/photo-1551030173-122aabc4489c?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
      description: 'Espresso nguyên chất pha loãng với nước đá mát lạnh, vị chua nhẹ thanh khiết.',
      category: 'coffee',
      sizes: [
        { size: 'S', price: 1000 },
        { size: 'M', price: 2000 },
        { size: 'L', price: 3000 },
      ],
    },
    {
      id: 'prod-cf-05',
      name: 'Cà phê muối béo ngậy xứ Huế',
      price: 1500,
      imageUrl: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
      description: 'Sự kết hợp độc đáo giữa vị đậm đà của cà phê phin và lớp kem bọt sữa muối biển.',
      category: 'coffee',
      sizes: [
        { size: 'S', price: 1500 },
        { size: 'M', price: 2500 },
        { size: 'L', price: 3500 },
      ],
    },
    {
      id: 'prod-cf-06',
      name: 'Cappuccino bọt sữa Ý',
      price: 2000,
      imageUrl: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
      description: 'Sự cân bằng hoàn hảo giữa espresso, sữa nóng và lớp bọt sữa bông dày mịn màng.',
      category: 'coffee',
      sizes: [
        { size: 'S', price: 2000 },
        { size: 'M', price: 3000 },
        { size: 'L', price: 4000 },
      ],
    },
    {
      id: 'prod-cf-07',
      name: 'Latte Macchiato thơm béo',
      price: 2000,
      imageUrl: 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
      description: 'Vị cà phê êm dịu hòa quyện cùng dòng sữa tươi đánh nóng tạo hình nghệ thuật.',
      category: 'coffee',
      sizes: [
        { size: 'S', price: 2000 },
        { size: 'M', price: 3000 },
        { size: 'L', price: 4000 },
      ],
    },
    {
      id: 'prod-cf-08',
      name: 'Cold Brew ủ lạnh truyền thống',
      price: 2000,
      imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
      description: 'Cà phê Arabica Cầu Đất được chiết xuất lạnh suốt 16 giờ, vị thanh mát hậu vị ngọt.',
      category: 'coffee',
      sizes: [
        { size: 'S', price: 2000 },
        { size: 'M', price: 3000 },
        { size: 'L', price: 4000 },
      ],
    },
  ];

  for (const prod of products) {
    await prisma.product.upsert({
      where: { id: prod.id },
      update: prod,
      create: prod,
    });
  }

  const inventoryCatalog = await seedInventoryCatalog(prisma);

  console.log(`✅ Seeded ${products.length} specialty coffee products (giá 1k - 4k)`);
  console.log(
    `✅ Seeded ${inventoryCatalog.ingredients} ingredients and ${inventoryCatalog.recipes} coffee recipes`,
  );
  console.log('🎉 Coffee Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
