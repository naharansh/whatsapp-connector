-- CreateTable
CREATE TABLE "WhatsAppTrigger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL DEFAULT 'en',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppTrigger_shop_triggerEvent_key" ON "WhatsAppTrigger"("shop", "triggerEvent");
