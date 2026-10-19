import { PrismaClient } from '@prisma/client';
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
        passwordHash,
        loyaltyPoints: 120,
      },
    });
    console.log(`✅ Seeded demo user: ${demoUser.email}`);
  }

  // 2. Seed products
  const products = [
    {
      id: 'prod-cf-01',
      name: 'Cà phê sữa đá Sài Gòn',
      price: 29000,
      imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
      stock: 45,
      description: 'Hương vị cà phê Robusta Đắk Lắk đậm đà kết hợp sữa đặc béo ngậy truyền thống.',
      category: 'coffee',
      isPopular: true,
    },
    {
      id: 'prod-cf-02',
      name: 'Bạc xỉu 3 tầng BrewLite',
      price: 32000,
      imageUrl: 'https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&w=600&q=80',
      stock: 38,
      description: 'Nhiều sữa ít cà phê, béo ngậy thơm lừng hòa quyện sữa tươi thanh trùng.',
      category: 'coffee',
      isPopular: true,
    },
    {
      id: 'prod-cf-03',
      name: 'Cà phê muối xứ Huế',
      price: 35000,
      imageUrl: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80',
      stock: 25,
      description: 'Sự kết hợp độc đáo giữa vị đậm đà của cà phê phin và lớp kem béo mặn sánh mịn.',
      category: 'special',
      isPopular: true,
    },
    {
      id: 'prod-tea-01',
      name: 'Trà đào cam sả thanh nhiệt',
      price: 38000,
      imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80',
      stock: 40,
      description: 'Vị trà lài tươi mát cùng đào ngâm giòn sần sật và lát cam vàng tươi.',
      category: 'tea',
      isPopular: true,
    },
    {
      id: 'prod-tea-02',
      name: 'Trà sen vàng Macchiato',
      price: 42000,
      imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
      stock: 30,
      description: 'Trà ô long thanh khiết kết hợp hạt sen bùi bùi và lớp bọt sữa macchiato đậm vị.',
      category: 'tea',
      isPopular: false,
    },
    {
      id: 'prod-bk-01',
      name: 'Bánh Croissant Bơ Tỏi',
      price: 28000,
      imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80',
      stock: 20,
      description: 'Vỏ bánh ngàn lớp giòn rụm tỏa ngát hương bơ Pháp và tỏi thơm nức.',
      category: 'bakery',
      isPopular: false,
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
