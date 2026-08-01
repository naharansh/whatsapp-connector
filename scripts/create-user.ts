import { hashPassword } from "../app/lib/auth/password.server";
import prisma from "../app/db.server";

async function main() {
  const [shop, email, password] = process.argv.slice(2);

  if (!shop || !email || !password) {
    console.error("Usage: npm run user:create -- <shop> <email> <password>");
    console.error("Example: npm run user:create -- my-shop.myshopify.com admin@example.com secret123");
    process.exit(1);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.appUser.upsert({
    where: {
      shop_email: {
        shop,
        email: normalizedEmail,
      },
    },
    update: { passwordHash: hashPassword(password) },
    create: {
      shop,
      email: normalizedEmail,
      passwordHash: hashPassword(password),
    },
  });

  console.log(`App user ready: ${user.email} (${user.shop})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
