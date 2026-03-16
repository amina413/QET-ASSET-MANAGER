"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { canInitiateTransfer, canApproveTransfer } from "@/lib/permissions";
import { UserRole } from "@/types";

/**
 * Custodian initiates a transfer request (cannot approve)
 */
export async function initiateTransfer(
  assetId: string,
  data: { toLocation: string; subLocation?: string; toCustodian: string; toCustodianId?: string },
  userId: string,
  userRole: UserRole
) {
  if (!canInitiateTransfer(userRole)) {
    return { success: false, error: "Insufficient permissions. You cannot initiate transfers." };
  }

  try {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) return { success: false, error: "Asset not found" };

    await prisma.transferRequest.create({
      data: {
        assetId,
        fromLocation: asset.location,
        toLocation: data.toLocation,
        toCustodian: data.toCustodian,
        toCustodianId: data.toCustodianId,
        requestedById: userId,
        status: "PENDING",
      },
    });

    await prisma.asset.update({
      where: { id: assetId },
      data: { status: "PENDING_TRANSFER" },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error initiating transfer:", error);
    return { success: false, error: "Failed to initiate transfer" };
  }
}

/**
 * Asset Manager approves a transfer request
 */
export async function approveTransfer(
  requestId: string,
  data: { custodianId: string },
  userId: string,
  userRole: UserRole
) {
  if (!canApproveTransfer(userRole)) {
    return { success: false, error: "Insufficient permissions. Only Asset Managers can approve transfers." };
  }

  try {
    const req = await prisma.transferRequest.findUnique({
      where: { id: requestId },
      include: { asset: true },
    });
    if (!req) return { success: false, error: "Transfer request not found" };
    if (req.status !== "PENDING") return { success: false, error: "Transfer request is no longer pending" };

    await prisma.$transaction([
      prisma.asset.update({
        where: { id: req.assetId },
        data: {
          location: req.toLocation,
          custodianId: data.custodianId,
          status: "ACTIVE",
        },
      }),
      prisma.transferRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED", approvedById: userId, resolvedAt: new Date() },
      }),
      prisma.assetHistory.create({
        data: {
          assetId: req.assetId,
          userId,
          action: "Transfer Approved",
          details: `Transfer approved: ${req.fromLocation} → ${req.toLocation}. New custodian: ${req.toCustodian}`,
          type: "Transfer",
          fromLocation: req.fromLocation,
          toLocation: req.toLocation,
          toCustodian: req.toCustodian,
        },
      }),
    ]);

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error approving transfer:", error);
    return { success: false, error: "Failed to approve transfer" };
  }
}

/**
 * Asset Manager rejects a transfer request
 */
export async function rejectTransfer(requestId: string, userId: string, userRole: UserRole) {
  if (!canApproveTransfer(userRole)) {
    return { success: false, error: "Insufficient permissions. Only Asset Managers can reject transfers." };
  }

  try {
    const req = await prisma.transferRequest.findUnique({ where: { id: requestId } });
    if (!req) return { success: false, error: "Transfer request not found" };
    if (req.status !== "PENDING") return { success: false, error: "Transfer request is no longer pending" };

    await prisma.$transaction([
      prisma.asset.update({
        where: { id: req.assetId },
        data: { status: "ACTIVE" },
      }),
      prisma.transferRequest.update({
        where: { id: requestId },
        data: { status: "REJECTED", approvedById: userId, resolvedAt: new Date() },
      }),
    ]);

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error rejecting transfer:", error);
    return { success: false, error: "Failed to reject transfer" };
  }
}

/**
 * Get pending transfer requests
 */
export async function getPendingTransferRequests() {
  try {
    return await prisma.transferRequest.findMany({
      where: { status: "PENDING" },
      include: {
        asset: { include: { custodian: true } },
      },
      orderBy: { requestedAt: "desc" },
    });
  } catch (error) {
    console.error("Error fetching transfer requests:", error);
    return [];
  }
}
