import prisma from "../../db.server";

export async function findAppUser(shop: string, email: string) {
  return prisma.appUser.findUnique({
    where: {
      shop_email: {
        shop,
        email: email.toLowerCase().trim(),
      },
    },
  });
}
