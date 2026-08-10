import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding PocketBank database...');

  await prisma.wallet.upsert({
    where: { userId: 'user-pocket-1' },
    update: {},
    create: {
      userId: 'user-pocket-1',
      balance: 1420.50,
      currency: 'USD',
    },
  });

  console.log('Seeding complete for PocketBank.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
