import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('admin123', 12);
  const receptionPassword = await bcrypt.hash('reception123', 12);

  await prisma.user.upsert({
    where: { email: 'admin@srinamo.com' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@srinamo.com',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'reception@srinamo.com' },
    update: {},
    create: {
      name: 'Receptionist',
      email: 'reception@srinamo.com',
      passwordHash: receptionPassword,
      role: UserRole.RECEPTIONIST,
      isActive: true,
    },
  });

  const roomTypes = [
    {
      name: '6 Single + 1 Double + 2 Sofa',
      description: '6 single beds, 1 double bed, 2 sofa cum beds',
      maxOccupancy: 10,
      amenities: ['6 single beds', '1 double bed', '2 sofa cum beds'],
      rooms: [{ roomNumber: '0111', floor: 1 }],
    },
    {
      name: '6 Single + 3 Sofa',
      description: '6 single beds, 3 sofa cum beds',
      maxOccupancy: 9,
      amenities: ['6 single beds', '3 sofa cum beds'],
      rooms: [{ roomNumber: '0112', floor: 1 }],
    },
    {
      name: '2 Double + 4 Sofa',
      description: '2 double beds, 4 sofa cum beds',
      maxOccupancy: 8,
      amenities: ['2 double beds', '4 sofa cum beds'],
      rooms: [{ roomNumber: '0011', floor: 0 }],
    },
    {
      name: '2 Double + 1 Sofa',
      description: '2 double beds, 1 sofa cum bed',
      maxOccupancy: 5,
      amenities: ['2 double beds', '1 sofa cum bed'],
      rooms: [
        { roomNumber: '0022', floor: 0 },
        { roomNumber: '0033', floor: 0 },
        { roomNumber: '0044', floor: 0 },
        { roomNumber: '0055', floor: 0 },
        { roomNumber: '0066', floor: 0 },
      ],
    },
  ];

  for (const rt of roomTypes) {
    const type = await prisma.roomType.upsert({
      where: { name: rt.name },
      update: {
        description: rt.description,
        maxOccupancy: rt.maxOccupancy,
        basePrice: 0,
        amenities: rt.amenities,
      },
      create: {
        name: rt.name,
        description: rt.description,
        maxOccupancy: rt.maxOccupancy,
        basePrice: 0,
        amenities: rt.amenities,
        images: [],
      },
    });
    for (const room of rt.rooms) {
      await prisma.room.upsert({
        where: { roomNumber: room.roomNumber },
        update: { roomTypeId: type.id, floor: room.floor },
        create: {
          roomTypeId: type.id,
          roomNumber: room.roomNumber,
          floor: room.floor,
        },
      });
    }
  }

  const menuCategories = [
    {
      category: 'Starters',
      items: [
        { name: 'Paneer Tikka', price: 280, isVeg: true, description: 'Marinated cottage cheese grilled in tandoor' },
        { name: 'Chicken 65', price: 320, isVeg: false, description: 'Spicy deep-fried chicken' },
        { name: 'Veg Manchurian', price: 240, isVeg: true, description: 'Indo-Chinese vegetable balls in tangy sauce' },
        { name: 'Fish Fry', price: 350, isVeg: false, description: 'Crispy fried fish with masala coating' },
      ],
    },
    {
      category: 'Main Course',
      items: [
        { name: 'Butter Chicken', price: 380, isVeg: false, description: 'Tender chicken in rich tomato-butter gravy' },
        { name: 'Paneer Butter Masala', price: 320, isVeg: true, description: 'Cottage cheese in creamy tomato gravy' },
        { name: 'Dal Makhani', price: 260, isVeg: true, description: 'Black lentils slow-cooked with butter and cream' },
        { name: 'Mutton Biryani', price: 420, isVeg: false, description: 'Fragrant basmati rice layered with spiced mutton' },
        { name: 'Veg Biryani', price: 280, isVeg: true, description: 'Aromatic rice with seasonal vegetables' },
        { name: 'Chicken Curry', price: 340, isVeg: false, description: 'Traditional home-style chicken curry' },
      ],
    },
    {
      category: 'Breads',
      items: [
        { name: 'Butter Naan', price: 60, isVeg: true, description: null },
        { name: 'Garlic Naan', price: 70, isVeg: true, description: null },
        { name: 'Tandoori Roti', price: 40, isVeg: true, description: null },
        { name: 'Paratha', price: 80, isVeg: true, description: null },
      ],
    },
    {
      category: 'Beverages',
      items: [
        { name: 'Masala Chai', price: 50, isVeg: true, description: 'Traditional Indian spiced tea' },
        { name: 'Filter Coffee', price: 60, isVeg: true, description: 'South Indian style filter coffee' },
        { name: 'Fresh Lime Soda', price: 80, isVeg: true, description: null },
        { name: 'Mango Lassi', price: 120, isVeg: true, description: 'Creamy yogurt drink with mango pulp' },
        { name: 'Buttermilk', price: 60, isVeg: true, description: 'Spiced traditional chaas' },
      ],
    },
    {
      category: 'Desserts',
      items: [
        { name: 'Gulab Jamun', price: 100, isVeg: true, description: 'Deep-fried milk solids soaked in sugar syrup' },
        { name: 'Rasmalai', price: 120, isVeg: true, description: 'Soft paneer dumplings in saffron milk' },
        { name: 'Ice Cream', price: 90, isVeg: true, description: 'Choice of vanilla, chocolate, or butterscotch' },
      ],
    },
  ];

  const existingMenuCount = await prisma.menuItem.count();
  if (existingMenuCount === 0) {
    let sortOrder = 0;
    for (const cat of menuCategories) {
      for (const item of cat.items) {
        sortOrder++;
        await prisma.menuItem.create({
          data: {
            name: item.name,
            category: cat.category,
            description: item.description,
            price: item.price,
            isVeg: item.isVeg,
            isAvailable: true,
            sortOrder,
          },
        });
      }
    }
  }

  const activities = [
    { name: 'Farm Tour', description: 'Guided tour of the organic farm with hands-on farming experience', price: 500, maxParticipants: 20, duration: '2 hours' },
    { name: 'Bonfire Night', description: 'Evening bonfire with live music and barbecue', price: 800, maxParticipants: 30, duration: '3 hours' },
    { name: 'Nature Walk', description: 'Early morning nature walk through forest trails', price: 300, maxParticipants: 15, duration: '1.5 hours' },
    { name: 'Cooking Class', description: 'Learn to cook traditional regional dishes with our chef', price: 1200, maxParticipants: 10, duration: '2.5 hours' },
  ];

  const existingActivityCount = await prisma.activity.count();
  if (existingActivityCount === 0) {
    for (const activity of activities) {
      await prisma.activity.create({ data: activity });
    }
  }

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
