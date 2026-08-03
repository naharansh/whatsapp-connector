-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WhatsAppConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "apiVersion" TEXT NOT NULL DEFAULT 'v25.0',
    "businessAccountId" TEXT NOT NULL,
    "webhookVerifyToken" TEXT NOT NULL,
    "webhookSecret" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_WhatsAppConfig" ("accessToken", "apiVersion", "businessAccountId", "createdAt", "id", "phoneNumberId", "shop", "updatedAt", "webhookSecret", "webhookVerifyToken") SELECT "accessToken", "apiVersion", "businessAccountId", "createdAt", "id", "phoneNumberId", "shop", "updatedAt", "webhookSecret", "webhookVerifyToken" FROM "WhatsAppConfig";
DROP TABLE "WhatsAppConfig";
ALTER TABLE "new_WhatsAppConfig" RENAME TO "WhatsAppConfig";
CREATE UNIQUE INDEX "WhatsAppConfig_shop_key" ON "WhatsAppConfig"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
