"use server";

import { revalidatePath } from "next/cache";

import { scanChicagoBoard } from "@/lib/frontier/board";
import { scanWeekCatalog } from "@/lib/frontier/week";

export async function refreshChicagoBoard() {
  await scanChicagoBoard();
  revalidatePath("/");
}

export async function refreshWeekCatalog() {
  await scanWeekCatalog();
  revalidatePath("/");
  revalidatePath("/history");
}
