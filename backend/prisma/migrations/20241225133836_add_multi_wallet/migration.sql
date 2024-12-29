/*
  Warnings:

  - You are about to drop the column `finalAmount` on the `CashRegister` table. All the data in the column will be lost.
  - You are about to drop the column `initialAmount` on the `CashRegister` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('PREPAID', 'ACCUMULATED');

-- AlterTable
ALTER TABLE "CashRegister" DROP COLUMN "finalAmount",
DROP COLUMN "initialAmount",
ADD COLUMN     "dollarRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "finalCashBs" DOUBLE PRECISION,
ADD COLUMN     "finalCashUSD" DOUBLE PRECISION,
ADD COLUMN     "finalCuentaBs" DOUBLE PRECISION,
ADD COLUMN     "finalTransferUSD" DOUBLE PRECISION,
ADD COLUMN     "initialCashBs" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "initialCashUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "initialCuentaBs" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "initialTransferUSD" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "wallet" TEXT NOT NULL DEFAULT 'CASH_USD';

-- CreateTable
CREATE TABLE "TransactionItem" (
    "id" SERIAL NOT NULL,
    "transactionId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TransactionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" SERIAL NOT NULL,
    "type" "AccountType" NOT NULL,
    "customerName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "creditLimit" DOUBLE PRECISION,
    "createdBy" TEXT NOT NULL,
    "closedBy" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrepaidProduct" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "paid" INTEGER NOT NULL,
    "consumed" INTEGER NOT NULL,

    CONSTRAINT "PrepaidProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountTransaction" (
    "id" TEXT NOT NULL,
    "accountId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" VARCHAR(10) NOT NULL,
    "method" TEXT,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AccountTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountTransactionItem" (
    "id" SERIAL NOT NULL,
    "transactionId" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "AccountTransactionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesRecord" (
    "id" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "SalesRecord_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepaidProduct" ADD CONSTRAINT "PrepaidProduct_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepaidProduct" ADD CONSTRAINT "PrepaidProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransaction" ADD CONSTRAINT "AccountTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransaction" ADD CONSTRAINT "AccountTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransactionItem" ADD CONSTRAINT "AccountTransactionItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "AccountTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransactionItem" ADD CONSTRAINT "AccountTransactionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRecord" ADD CONSTRAINT "SalesRecord_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRecord" ADD CONSTRAINT "SalesRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
