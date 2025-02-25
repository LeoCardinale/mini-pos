/*
  Warnings:

  - You are about to drop the column `email` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[sourceId,source]` on the table `SalesRecord` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[cedula]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `cedula` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "email",
ADD COLUMN     "cedula" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SalesRecord_sourceId_source_key" ON "SalesRecord"("sourceId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "User_cedula_key" ON "User"("cedula");
