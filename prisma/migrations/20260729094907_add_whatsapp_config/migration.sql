-- CreateTable
CREATE TABLE "WhatsAppConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "apiVersion" TEXT NOT NULL DEFAULT 'v22.0',
    "businessAccountId" TEXT NOT NULL,
    "webhookVerifyToken" TEXT NOT NULL,
    "webhookSecret" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConfig_shop_key" ON "WhatsAppConfig"("shop");
