import { PrismaClient, DiscountType, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Seed demo user
  const demoEmail = 'customer@brewlite.vn';
  const existingUser = await prisma.user.findUnique({
    where: { email: demoEmail },
  });

  if (!existingUser) {
    const passwordHash = await bcrypt.hash('password123', 10);
    const demoUser = await prisma.user.create({
      data: {
        id: 'usr-demo-01',
        email: demoEmail,
        fullName: 'Nguyễn Văn Pha Chế',
        role: UserRole.CUSTOMER,
        passwordHash,
        loyaltyPoints: 120,
      },
    });
    console.log(`✅ Seeded demo user: ${demoUser.email}`);
  }

  // 2. Seed toppings (Task 4 & 6)
  const toppings = [
    { id: 'top-pearl', name: 'Trân châu đen hoàng kim', price: 5000, stock: 100, isActive: true },
    { id: 'top-cheese', name: 'Kem Cheese Macchiato', price: 10000, stock: 80, isActive: true },
    { id: 'top-peach', name: 'Đào ngâm giòn', price: 8000, stock: 60, isActive: true },
    { id: 'top-lotus', name: 'Hạt sen vàng bùi ngọt', price: 9000, stock: 50, isActive: true },
    { id: 'top-jelly', name: 'Thạch sương sáo thanh mát', price: 5000, stock: 70, isActive: true },
  ];

  for (const top of toppings) {
    await prisma.topping.upsert({
      where: { id: top.id },
      update: top,
      create: top,
    });
  }
  console.log(`✅ Seeded ${toppings.length} toppings`);

  // 3. Seed vouchers (Task 10.4)
  const vouchers = [
    {
      id: 'vouch-brew10',
      code: 'BREWLITE10',
      description: 'Giảm 10% tối đa 20.000đ cho đơn từ 50.000đ',
      discountType: DiscountType.PERCENT,
      discountValue: 10,
      minOrderValue: 50000,
      maxDiscount: 20000,
      usageLimit: 100,
      isActive: true,
    },
    {
      id: 'vouch-banmoi',
      code: 'BANMOI',
      description: 'Giảm ngay 15.000đ cho khách hàng mới với đơn từ 40.000đ',
      discountType: DiscountType.FIXED,
      discountValue: 15000,
      minOrderValue: 40000,
      maxDiscount: null,
      usageLimit: 50,
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

  // 4. Seed products with flexible sizes JSON and version 0 (Optimistic Locking)
  const products = [
    {
      id: 'prod-cf-01',
      name: 'Cà phê sữa đá Sài Gòn',
      price: 29000,
      imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
      stock: 45,
      version: 0,
      isAvailable: true,
      description: 'Hương vị cà phê Robusta Đắk Lắk đậm đà kết hợp sữa đặc béo ngậy truyền thống.',
      category: 'coffee',
      sizes: [
        { size: 'S', price: 29000 },
        { size: 'M', price: 35000 },
        { size: 'L', price: 42000 },
      ],
    },
    {
      id: 'prod-cf-02',
      name: 'Bạc xỉu 3 tầng BrewLite',
      price: 32000,
      imageUrl: 'https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&w=600&q=80',
      stock: 38,
      version: 0,
      isAvailable: true,
      description: 'Nhiều sữa ít cà phê, béo ngậy thơm lừng hòa quyện sữa tươi thanh trùng.',
      category: 'coffee',
      sizes: [
        { size: 'S', price: 32000 },
        { size: 'M', price: 39000 },
        { size: 'L', price: 45000 },
      ],
    },
    {
      id: 'prod-cf-03',
      name: 'Cà phê muối xứ Huế',
      price: 35000,
      imageUrl: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80',
      stock: 25,
      version: 0,
      isAvailable: true,
      description: 'Sự kết hợp độc đáo giữa vị đậm đà của cà phê phin và lớp kem béo mặn sánh mịn.',
      category: 'special',
      sizes: [
        { size: 'S', price: 35000 },
        { size: 'M', price: 42000 },
        { size: 'L', price: 49000 },
      ],
    },
    {
      id: 'prod-tea-01',
      name: 'Trà đào cam sả thanh nhiệt',
      price: 38000,
      imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80',
      stock: 40,
      version: 0,
      isAvailable: true,
      description: 'Vị trà lài tươi mát cùng đào ngâm giòn sần sật và lát cam vàng tươi.',
      category: 'tea',
      sizes: [
        { size: 'M', price: 38000 },
        { size: 'L', price: 45000 },
      ],
    },
    {
      id: 'prod-tea-02',
      name: 'Trà sen vàng Macchiato',
      price: 42000,
      imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
      stock: 30,
      version: 0,
      isAvailable: true,
      description: 'Trà ô long thanh khiết kết hợp hạt sen bùi bùi và lớp bọt sữa macchiato đậm vị.',
      category: 'tea',
      sizes: [
        { size: 'M', price: 42000 },
        { size: 'L', price: 50000 },
      ],
    },
    {
      id: 'prod-bk-01',
      name: 'Bánh Croissant Bơ Tỏi',
      price: 28000,
      imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80',
      stock: 20,
      version: 0,
      isAvailable: true,
      description: 'Vỏ bánh ngàn lớp giòn rụm tỏa ngát hương bơ Pháp và tỏi thơm nức.',
      category: 'bakery',
      sizes: null,
    },
  ];

  for (const prod of products) {
    await prisma.product.upsert({
      where: { id: prod.id },
      update: prod,
      create: prod,
    });
  }

  console.log(`✅ Seeded ${products.length} products`);
  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
