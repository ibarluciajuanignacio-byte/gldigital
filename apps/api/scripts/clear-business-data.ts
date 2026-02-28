/**
 * Borra SOLO los datos de negocio (OC, proveedores, equipos, revendedores,
 * clientes, consignaciones, pagos, deudas, chat, cajas, etc.) y deja el sistema
 * listo para que el usuario real cargue sus datos.
 *
 * NO TOCA: User admin, DeviceStatus, Technician, ProductCategory/Offer/Variant.
 *
 * Uso: cd apps/api && npx tsx scripts/clear-business-data.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Borrando solo datos de negocio (se preservan admin, estados, técnicos, catálogo)...\n");

  // Orden estricto por dependencias (hijos antes que padres)
  await prisma.chatAttachment.deleteMany({});
  console.log("  ChatAttachment");

  await prisma.chatMessage.deleteMany({});
  console.log("  ChatMessage");

  await prisma.chatMember.deleteMany({});
  console.log("  ChatMember");

  await prisma.chatGroup.deleteMany({});
  console.log("  ChatGroup");

  await prisma.chatConversation.deleteMany({});
  console.log("  ChatConversation");

  await prisma.consignmentMovement.deleteMany({});
  console.log("  ConsignmentMovement");

  await prisma.consignment.deleteMany({});
  console.log("  Consignment");

  await prisma.repairRecord.deleteMany({});
  console.log("  RepairRecord");

  await prisma.debtLedgerEntry.deleteMany({});
  console.log("  DebtLedgerEntry");

  await prisma.payment.deleteMany({});
  console.log("  Payment");

  await prisma.cashMovement.deleteMany({});
  console.log("  CashMovement");

  await prisma.stockRequest.deleteMany({});
  console.log("  StockRequest");

  await prisma.client.deleteMany({});
  console.log("  Client");

  // Desvincular dispositivos de ítems de OC antes de borrar
  await prisma.device.updateMany({ data: { purchaseOrderItemId: null, resellerId: null, technicianId: null } });
  await prisma.device.deleteMany({});
  console.log("  Device");

  await prisma.purchaseOrderItem.deleteMany({});
  console.log("  PurchaseOrderItem");

  await prisma.purchaseOrder.deleteMany({});
  console.log("  PurchaseOrder");

  await prisma.supplier.deleteMany({});
  console.log("  Supplier");

  // Borrar revendedores (los User con role reseller se borran después)
  const resellerIds = await prisma.reseller.findMany({ select: { userId: true } }).then((r) => r.map((x) => x.userId));
  await prisma.reseller.deleteMany({});
  console.log("  Reseller");

  // Borrar usuarios que eran solo revendedores (dejamos admins)
  if (resellerIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: resellerIds } } });
    console.log("  User (revendedores):", resellerIds.length);
  }

  await prisma.cashBox.deleteMany({});
  console.log("  CashBox");

  await prisma.notification.deleteMany({});
  console.log("  Notification");

  await prisma.auditLog.deleteMany({});
  console.log("  AuditLog");

  const adminCount = await prisma.user.count({ where: { role: "admin" } });
  const statusCount = await prisma.deviceStatus.count();

  console.log("\nListo. Datos de negocio borrados.");
  console.log("  Usuarios admin restantes:", adminCount);
  console.log("  Estados de equipo (DeviceStatus):", statusCount);
  console.log("\nEntrá con admin@gldigital.local / admin123 y cargá proveedores, OC, stock, revendedores, etc.");
}

main()
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
