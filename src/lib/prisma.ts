import { PrismaClient } from "@prisma/client";

// یک نمونه واحد PrismaClient در کل اپ (جلوگیری از اتصالات تکراری در dev hot-reload)
export const prisma = new PrismaClient();
