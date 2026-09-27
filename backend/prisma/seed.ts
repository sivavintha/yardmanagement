import dotenv from "dotenv";
dotenv.config();
import { ensureBootstrapData } from "../src/bootstrap";
import { prisma } from "../src/lib/prisma";

ensureBootstrapData()
  .then(() => {
    console.log("Seed complete.");
  })
  .finally(() => prisma.$disconnect());
