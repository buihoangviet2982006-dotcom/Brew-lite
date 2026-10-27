import { PrismaClient, DiscountType, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 0. Xóa sạch dữ liệu cũ để tạo seed mới hoàn toàn
  console.log('🧹 Clearing old database records...');
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.voucher.deleteMany();
  await prisma.topping.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  console.log('✅ Cleared all existing tables.');

  // 1. Seed demo users (Customer, Barista, Admin)
  const passwordHash = await bcrypt.hash('password123', 10);

  const demoCustomer = await prisma.user.create({
    data: {
      id: 'usr-demo-01',
      email: 'customer@brewlite.vn',
      fullName: 'Khách Hàng BrewLite',
      role: UserRole.CUSTOMER,
      passwordHash,
      loyaltyPoints: 120,
    },
  });

  const demoBarista = await prisma.user.create({
    data: {
      id: 'usr-barista-01',
      email: 'barista@brewlite.vn',
      fullName: 'Pha Chế Viên BrewLite',
      role: UserRole.BARISTA,
      passwordHash,
      loyaltyPoints: 0,
    },
  });

  const demoAdmin = await prisma.user.create({
    data: {
      id: 'usr-admin-01',
      email: 'admin@brewlite.vn',
      fullName: 'Quản Trị Viên BrewLite',
      role: UserRole.ADMIN,
      passwordHash,
      loyaltyPoints: 0,
    },
  });
  console.log(`✅ Seeded users: Customer, Barista, Admin (Mật khẩu: password123)`);

  // 2. Seed toppings phong phú (giá 1.000đ - 3.000đ thuận tiện test QR)
  const toppings = [
    { id: 'top-pearl', name: 'Trân châu đen hoàng kim', price: 1000, stock: 200, isActive: true },
    { id: 'top-white-pearl', name: 'Trân châu trắng ngọc trai', price: 1000, stock: 200, isActive: true },
    { id: 'top-cheese', name: 'Kem Cheese Macchiato béo ngậy', price: 2000, stock: 150, isActive: true },
    { id: 'top-peach', name: 'Đào ngâm giòn thơm', price: 2000, stock: 150, isActive: true },
    { id: 'top-lotus', name: 'Hạt sen vàng bùi ngọt', price: 2000, stock: 120, isActive: true },
    { id: 'top-jelly', name: 'Thạch sương sáo thanh mát', price: 1000, stock: 180, isActive: true },
    { id: 'top-flan', name: 'Bánh Flan caramel mềm mịn', price: 3000, stock: 100, isActive: true },
    { id: 'top-aloe', name: 'Thạch nha đam thanh nhiệt', price: 1000, stock: 150, isActive: true },
    { id: 'top-popping', name: 'Thạch củ năng giòn ngọt', price: 2000, stock: 120, isActive: true },
    { id: 'top-foam', name: 'Lớp bọt sữa muối biển mặn mà', price: 2000, stock: 150, isActive: true },
  ];

  for (const top of toppings) {
    await prisma.topping.upsert({
      where: { id: top.id },
      update: top,
      create: top,
    });
  }
  console.log(`✅ Seeded ${toppings.length} toppings (giá 1k - 3k)`);

  // 3. Seed vouchers (điều chỉnh phù hợp với đơn giá 1k - 10k)
  const vouchers = [
    {
      id: 'vouch-brew10',
      code: 'BREWLITE10',
      description: 'Giảm 10% tối đa 2.000đ cho đơn từ 5.000đ',
      discountType: DiscountType.PERCENT,
      discountValue: 10,
      minOrderValue: 5000,
      maxDiscount: 2000,
      usageLimit: 500,
      isActive: true,
    },
    {
      id: 'vouch-banmoi',
      code: 'BANMOI',
      description: 'Giảm ngay 1.000đ cho khách hàng mới với đơn từ 3.000đ',
      discountType: DiscountType.FIXED,
      discountValue: 1000,
      minOrderValue: 3000,
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

  // 4. Seed products: nhiều món phong phú, giá chỉ từ 1.000đ đến 10.000đ
  const products = [
    // --- Nhóm Cà Phê (1.000đ - 5.000đ) ---
    {
      id: 'prod-cf-01',
      name: 'Cà phê sữa đá Sài Gòn',
      price: 2000,
      imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
      stock: 100,
      version: 0,
      isAvailable: true,
      description: 'Hương vị cà phê Robusta Đắk Lắk đậm đà kết hợp sữa đặc béo ngậy truyền thống.',
      category: 'coffee',
      sizes: [
        { size: 'S', price: 2000 },
        { size: 'M', price: 3000 },
        { size: 'L', price: 4000 },
      ],
    },
    {
      id: 'prod-cf-02',
      name: 'Bạc xỉu 3 tầng BrewLite',
      price: 3000,
      imageUrl: 'https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&w=600&q=80',
      stock: 100,
      version: 0,
      isAvailable: true,
      description: 'Nhiều sữa ít cà phê, béo ngậy thơm lừng hòa quyện sữa tươi thanh trùng.',
      category: 'coffee',
      sizes: [
        { size: 'S', price: 3000 },
        { size: 'M', price: 4000 },
        { size: 'L', price: 5000 },
      ],
    },
    {
      id: 'prod-cf-03',
      name: 'Cà phê muối xứ Huế',
      price: 3000,
      imageUrl: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80',
      stock: 80,
      version: 0,
      isAvailable: true,
      description: 'Sự kết hợp độc đáo giữa vị đậm đà của cà phê phin và lớp kem béo mặn sánh mịn.',
      category: 'special',
      sizes: [
        { size: 'S', price: 3000 },
        { size: 'M', price: 4000 },
        { size: 'L', price: 5000 },
      ],
    },
    {
      id: 'prod-cf-04',
      name: 'Cà phê đen đá truyền thống',
      price: 2000,
      imageUrl: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&q=80',
      stock: 120,
      version: 0,
      isAvailable: true,
      description: 'Đen đá đậm đà từ hạt Robusta rang mộc, thơm nồng tỉnh táo cả ngày dài.',
      category: 'coffee',
      sizes: [
        { size: 'S', price: 2000 },
        { size: 'M', price: 3000 },
        { size: 'L', price: 4000 },
      ],
    },
    {
      id: 'prod-cf-05',
      name: 'Americano đá thanh vị',
      price: 2000,
      imageUrl: 'https://images.unsplash.com/photo-1551030173-122aabc4489c?auto=format&fit=crop&w=600&q=80',
      stock: 90,
      version: 0,
      isAvailable: true,
      description: 'Espresso nguyên chất pha loãng với nước đá mát lạnh, vị chua nhẹ thanh khiết.',
      category: 'coffee',
      sizes: [
        { size: 'S', price: 2000 },
        { size: 'M', price: 3000 },
        { size: 'L', price: 4000 },
      ],
    },
    {
      id: 'prod-cf-06',
      name: 'Cappuccino bọt sữa Ý',
      price: 4000,
      imageUrl: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80',
      stock: 70,
      version: 0,
      isAvailable: true,
      description: 'Sự cân bằng hoàn hảo giữa espresso, sữa nóng và lớp bọt sữa bông dày mịn màng.',
      category: 'coffee',
      sizes: [
        { size: 'S', price: 4000 },
        { size: 'M', price: 5000 },
        { size: 'L', price: 6000 },
      ],
    },

    // --- Nhóm Trà & Trà Sữa (3.000đ - 6.000đ) ---
    {
      id: 'prod-tea-01',
      name: 'Trà đào cam sả thanh nhiệt',
      price: 3000,
      imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80',
      stock: 100,
      version: 0,
      isAvailable: true,
      description: 'Vị trà lài tươi mát cùng đào ngâm giòn sần sật và lát cam vàng thơm ngát.',
      category: 'tea',
      sizes: [
        { size: 'M', price: 3000 },
        { size: 'L', price: 4000 },
      ],
    },
    {
      id: 'prod-tea-02',
      name: 'Trà sen vàng Macchiato',
      price: 4000,
      imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
      stock: 80,
      version: 0,
      isAvailable: true,
      description: 'Trà ô long thanh khiết kết hợp hạt sen bùi bùi và lớp bọt sữa macchiato đậm vị.',
      category: 'tea',
      sizes: [
        { size: 'M', price: 4000 },
        { size: 'L', price: 5000 },
      ],
    },
    {
      id: 'prod-tea-03',
      name: 'Trà sữa ô long nướng Đài Loan',
      price: 4000,
      imageUrl: 'https://vncdn.ahafood.ai/ai-preview-images/tra-sua-o-long-nuong-1777147436.jpeg',
      stock: 100,
      version: 0,
      isAvailable: true,
      description: 'Lá trà ô long được sao nướng đậm hương khói kết hợp sữa béo ngậy ngọt ngào.',
      category: 'tea',
      sizes: [
        { size: 'M', price: 4000 },
        { size: 'L', price: 5000 },
      ],
    },
    {
      id: 'prod-tea-04',
      name: 'Trà vải lài hoa hồng',
      price: 3000,
      imageUrl: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=600&q=80',
      stock: 90,
      version: 0,
      isAvailable: true,
      description: 'Hương thơm hoa lài dịu nhẹ kết hợp những trái vải mọng nước ngọt thanh ngọt lịm.',
      category: 'tea',
      sizes: [
        { size: 'M', price: 3000 },
        { size: 'L', price: 4000 },
      ],
    },
    {
      id: 'prod-tea-05',
      name: 'Trà mận đỏ Tây Bắc',
      price: 3000,
      imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
      stock: 75,
      version: 0,
      isAvailable: true,
      description: 'Chua chua ngọt ngọt từ quả mận đỏ chín mọng vùng cao, giải khát tức thì.',
      category: 'tea',
      sizes: [
        { size: 'M', price: 3000 },
        { size: 'L', price: 4000 },
      ],
    },

    // --- Nhóm Món Đặc Biệt & Đá Xay (4.000đ - 7.000đ) ---
    {
      id: 'prod-sp-01',
      name: 'Matcha Latte Uji Nhật Bản',
      price: 5000,
      imageUrl: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80',
      stock: 60,
      version: 0,
      isAvailable: true,
      description: 'Bột trà xanh Uji cao cấp nhập khẩu từ Kyoto hòa cùng sữa tươi mịn màng.',
      category: 'special',
      sizes: [
        { size: 'S', price: 5000 },
        { size: 'M', price: 6000 },
        { size: 'L', price: 7000 },
      ],
    },
    {
      id: 'prod-sp-02',
      name: 'Chocolate Đá Xay Hạnh Nhân',
      price: 6000,
      imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80',
      stock: 50,
      version: 0,
      isAvailable: true,
      description: 'Sô cô la Bỉ nguyên chất xay nhuyễn cùng đá tuyết và hạnh nhân lát giòn rụm.',
      category: 'special',
      sizes: [
        { size: 'M', price: 6000 },
        { size: 'L', price: 7000 },
      ],
    },
    {
      id: 'prod-sp-03',
      name: 'Sinh tố bơ sầu riêng béo thơm',
      price: 7000,
      imageUrl: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80',
      stock: 40,
      version: 0,
      isAvailable: true,
      description: 'Bơ sáp Đắk Lắk dẻo mịn cùng cơm sầu riêng thơm lừng ngất ngây.',
      category: 'special',
      sizes: [
        { size: 'M', price: 7000 },
        { size: 'L', price: 8000 },
      ],
    },

    // --- Nhóm Bánh Ngọt Ăn Kèm (2.000đ - 4.000đ) ---
    {
      id: 'prod-bk-01',
      name: 'Bánh Croissant Bơ Tỏi',
      price: 2000,
      imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80',
      stock: 50,
      version: 0,
      isAvailable: true,
      description: 'Vỏ bánh ngàn lớp giòn rụm tỏa ngát hương bơ Pháp và sốt tỏi thơm nức.',
      category: 'bakery',
      sizes: null,
    },
    {
      id: 'prod-bk-02',
      name: 'Bánh Mousse Chanh Leo',
      price: 3000,
      imageUrl: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=600&q=80',
      stock: 40,
      version: 0,
      isAvailable: true,
      description: 'Lớp cốt bông lan mềm tan cùng mousse chanh leo chua ngọt dịu mát.',
      category: 'bakery',
      sizes: null,
    },
    {
      id: 'prod-bk-03',
      name: 'Bánh Tiramisu Cacao Truyền Thống',
      price: 4000,
      imageUrl: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=600&q=80',
      stock: 35,
      version: 0,
      isAvailable: true,
      description: 'Tiramisu đậm đà hương cà phê espresso và phô mai mascarpone hảo hạng.',
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

  console.log(`✅ Seeded ${products.length} products (giá 1k - 8k)`);
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
