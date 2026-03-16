
"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { calculateDepreciationSchedule, DepreciationMethod } from "@/utils/depreciation";
import { Asset, AssetHistoryEvent } from "@/types";
import { canRegisterAsset, canEditAsset, canApproveTransfer } from "@/lib/permissions";
import { UserRole } from "@/types";

/**
 * Fetch all assets from the database
 */
export async function getAssets() {
    try {
        const assets = await prisma.asset.findMany({
            include: {
                custodian: true,
                history: { include: { user: true }, orderBy: { date: 'desc' } },
                improvements: true,
                schedules: {
                    orderBy: { fiscalYear: 'asc' }
                }
            },
            orderBy: {
                registrationDate: 'desc'
            }
        });

        const currentYear = new Date().getFullYear();

        // Map Prisma models to frontend Asset interface
        return assets.map(a => {
            // Find the schedule entry for the current year
            const currentSchedule = a.schedules.find(s => s.fiscalYear === currentYear)
                || a.schedules[a.schedules.length - 1]; // Fallback to last known

            return {
                id: a.id,
                productId: a.productId,
                name: a.name,
                category: a.category,
                acquisitionCost: Number(a.acquisitionCost),
                acquisitionDate: a.acquisitionDate.toISOString().split('T')[0],
                netBookValue: currentSchedule ? Number(currentSchedule.netBookValue) : Number(a.acquisitionCost),
                location: a.location,
                subLocation: a.subLocation || undefined,
                custodian: a.custodian.name,
                status: a.status.toLowerCase().replace('_', ' ') as any,
                conditionCode: a.conditionCode as any,
                image: a.image || undefined,
                registrationDate: a.registrationDate.toISOString().split('T')[0],
                subCategory: a.subCategory || undefined,
                usefulLife: a.usefulLife,
                salvageValue: Number(a.salvageValue),
                method: a.method,
                improvements: a.improvements?.map(imp => ({
                    id: imp.id,
                    date: imp.date.toISOString().split('T')[0],
                    type: imp.type as 'Addition' | 'Reduction' | 'Revaluation',
                    amount: Number(imp.amount),
                    description: imp.description,
                    newAcquisitionCost: Number(imp.newAcquisitionCost)
                })),
                history: a.history?.map(h => ({
                    id: h.id,
                    assetId: h.assetId,
                    date: h.date.toISOString().slice(0, 16).replace('T', ' '),
                    action: h.action,
                    user: h.user?.name || 'System',
                    details: h.details,
                    type: h.type as any,
                    fromLocation: h.fromLocation || undefined,
                    toLocation: h.toLocation || undefined,
                    toCustodian: h.toCustodian || undefined
                })),
            };
        });
    } catch (error) {
        console.error("Error fetching assets:", error);
        return [];
    }
}

/**
 * Get the next serial number for a given asset ID prefix (e.g. ABDC/KAD/KD/FAF/).
 * Returns zero-padded 4-digit serial (0001, 0002, ...) based on existing assets in the register.
 */
export async function getNextSerialForPrefix(prefix: string): Promise<string> {
    try {
        const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
        const assets = await prisma.asset.findMany({
            where: { productId: { startsWith: normalizedPrefix } },
            select: { productId: true }
        });

        let maxSerial = 0;
        for (const a of assets) {
            const lastPart = a.productId.slice(normalizedPrefix.length).split('-')[0];
            const num = parseInt(lastPart, 10);
            if (!isNaN(num) && num > maxSerial) maxSerial = num;
        }

        const next = maxSerial + 1;
        return next.toString().padStart(4, '0');
    } catch (error) {
        console.error("Error getting next serial:", error);
        return "0001";
    }
}

/**
 * Register a new asset and generate its depreciation schedule
 */
export async function createAsset(formData: any, userId: string, userRole: UserRole) {
    if (!canRegisterAsset(userRole)) {
        return { success: false, error: "Insufficient permissions. You do not have permission to register assets." };
    }
    try {
        // Validate and parse acquisition date
        let acquisitionDate: Date;
        if (formData.acquisitionDate) {
            acquisitionDate = new Date(formData.acquisitionDate);
            // Validate date - if invalid or before 1900, use current date
            if (isNaN(acquisitionDate.getTime()) || acquisitionDate.getFullYear() < 1900 || acquisitionDate.getFullYear() > 2100) {
                console.warn(`Invalid acquisition date: ${formData.acquisitionDate}, using current date`);
                acquisitionDate = new Date();
            }
        } else {
            acquisitionDate = new Date();
        }

        // Validate and parse registration date
        let registrationDate: Date;
        if (formData.registrationDate) {
            const parsedRegDate = new Date(formData.registrationDate);
            // Validate date - if invalid or before 1900, use current date
            if (isNaN(parsedRegDate.getTime()) || parsedRegDate.getFullYear() < 1900 || parsedRegDate.getFullYear() > 2100) {
                console.warn(`Invalid registration date: ${formData.registrationDate}, using current date`);
                registrationDate = new Date();
            } else {
                registrationDate = parsedRegDate;
            }
        } else {
            registrationDate = new Date();
        }

        const asset = await prisma.asset.create({
            data: {
                productId: formData.productId,
                name: formData.name,
                category: formData.category,
                subCategory: formData.subCategory,
                acquisitionCost: formData.acquisitionCost,
                acquisitionDate: acquisitionDate,
                registrationDate: registrationDate,
                salvageValue: formData.salvageValue || 0,
                usefulLife: formData.usefulLife,
                method: formData.depreciationMethod as any,
                location: formData.location,
                subLocation: formData.subLocation,
                custodianId: userId,
                conditionCode: formData.condition || 'A1',
                status: 'ACTIVE',
                ...(formData.image && { image: formData.image }),
            }
        });

        // Generate and save depreciation schedule using registration date
        const assetRegistrationDate = asset.registrationDate || new Date();
        const scheduleData = calculateDepreciationSchedule({
            acquisition_cost: Number(asset.acquisitionCost),
            registration_date: assetRegistrationDate.toISOString(),
            useful_life: asset.usefulLife,
            salvage_value: Number(asset.salvageValue),
            method: asset.method as any
        });

        await prisma.depreciationSchedule.createMany({
            data: scheduleData.map(s => ({
                assetId: asset.id,
                year: s.year,
                fiscalYear: s.fiscal_year,
                depreciationExpense: s.depreciation_expense,
                accumulatedDepr: s.accumulated_depreciation,
                netBookValue: s.net_book_value
            }))
        });

        // Log history
        await prisma.assetHistory.create({
            data: {
                assetId: asset.id,
                userId: userId,
                action: 'Asset Registered',
                details: `Initial registration of ${asset.name}`,
                type: 'Registration'
            }
        });

        revalidatePath('/');
        return { success: true, assetId: asset.id };
    } catch (error) {
        console.error("Error creating asset:", error);
        return { success: false, error: "Failed to create asset" };
    }
}

/** Bulk create assets in a single transaction - much faster than sequential createAsset calls */
export async function createAssetsBulk(
    rows: Array<{
        prefix: string;
        name: string;
        category: string;
        subCategory?: string;
        cost: number;
        date: string;
        registrationDate: string;
        salvageValue: number;
        life: number;
        depreciationMethod: string;
        location: string;
        subLocation?: string;
        condition: string;
        assetClass?: string;
        custodian?: string;
        assignedUser?: string;
    }>,
    userId: string,
    userRole: UserRole
) {
    if (!canRegisterAsset(userRole)) {
        return { success: false, error: "Insufficient permissions.", createdIds: [], createdProductIds: [] };
    }
    if (rows.length === 0) return { success: true, createdIds: [], createdProductIds: [] };

    try {
        const uniquePrefixes = [...new Set(rows.map(r => r.prefix.endsWith('/') ? r.prefix : r.prefix + '/'))];

        const maxSerialByPrefix = new Map<string, number>();
        await Promise.all(uniquePrefixes.map(async (prefix) => {
            const assets = await prisma.asset.findMany({
                where: { productId: { startsWith: prefix } },
                select: { productId: true }
            });
            let max = 0;
            for (const a of assets) {
                const lastPart = a.productId.slice(prefix.length).split('-')[0];
                const num = parseInt(lastPart, 10);
                if (!isNaN(num) && num > max) max = num;
            }
            maxSerialByPrefix.set(prefix, max);
        }));

        const nextSerialByPrefix = new Map<string, number>();
        for (const [p, max] of maxSerialByPrefix) nextSerialByPrefix.set(p, max + 1);

        const createdIds: string[] = [];
        const createdProductIds: string[] = [];

        await prisma.$transaction(async (tx) => {
            for (const row of rows) {
                const prefix = row.prefix.endsWith('/') ? row.prefix : row.prefix + '/';
                const serial = (nextSerialByPrefix.get(prefix) ?? 1).toString().padStart(4, '0');
                nextSerialByPrefix.set(prefix, (nextSerialByPrefix.get(prefix) ?? 1) + 1);
                const productId = prefix + serial;

                let acquisitionDate = new Date(row.date);
                if (isNaN(acquisitionDate.getTime()) || acquisitionDate.getFullYear() < 1900) acquisitionDate = new Date();
                let registrationDate = new Date(row.registrationDate);
                if (isNaN(registrationDate.getTime()) || registrationDate.getFullYear() < 1900) registrationDate = new Date();

                const method = row.depreciationMethod === 'Reducing Balance' ? 'REDUCING_BALANCE' :
                    row.depreciationMethod === 'Sum of Years' ? 'SUM_OF_YEARS' : 'STRAIGHT_LINE';
                const condMap: Record<string, string> = { 'New': 'A1', 'Good': 'A2', 'Fair': 'A3', 'Poor': 'A4' };
                const condition = condMap[row.condition ?? ''] || 'A2';

                const asset = await tx.asset.create({
                    data: {
                        productId,
                        name: row.name,
                        category: row.category,
                        subCategory: row.subCategory,
                        acquisitionCost: row.cost,
                        acquisitionDate,
                        registrationDate,
                        salvageValue: row.salvageValue || 0,
                        usefulLife: row.life,
                        method: method as any,
                        location: row.location,
                        subLocation: row.subLocation,
                        custodianId: userId,
                        conditionCode: condition || 'A2',
                        status: 'ACTIVE',
                    }
                });

                const scheduleData = calculateDepreciationSchedule({
                    acquisition_cost: row.cost,
                    registration_date: registrationDate.toISOString(),
                    useful_life: row.life,
                    salvage_value: row.salvageValue || 0,
                    method: method as any
                });

                await tx.depreciationSchedule.createMany({
                    data: scheduleData.map(s => ({
                        assetId: asset.id,
                        year: s.year,
                        fiscalYear: s.fiscal_year,
                        depreciationExpense: s.depreciation_expense,
                        accumulatedDepr: s.accumulated_depreciation,
                        netBookValue: s.net_book_value
                    }))
                });

                await tx.assetHistory.create({
                    data: {
                        assetId: asset.id,
                        userId,
                        action: 'Asset Registered',
                        details: `Initial registration of ${row.name}`,
                        type: 'Registration'
                    }
                });

                createdIds.push(asset.id);
                createdProductIds.push(productId);
            }
        });

        revalidatePath('/');
        return { success: true, createdIds, createdProductIds };
    } catch (error) {
        console.error("Bulk create error:", error);
        return { success: false, error: "Bulk import failed", createdIds: [], createdProductIds: [] };
    }
}

/**
 * Update asset image
 */
export async function updateAssetImage(assetId: string, imageDataUrl: string, userId: string) {
    try {
        await prisma.asset.update({
            where: { id: assetId },
            data: {
                image: imageDataUrl
            }
        });

        // Log history
        const asset = await prisma.asset.findUnique({ where: { id: assetId } });
        if (asset) {
            await prisma.assetHistory.create({
                data: {
                    assetId: assetId,
                    userId: userId,
                    action: 'Image Updated',
                    details: `Image uploaded for ${asset.name}`,
                    type: 'Update'
                }
            });
        }

        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error("Error updating asset image:", error);
        return { success: false, error: "Failed to update asset image" };
    }
}

/**
 * Transfer an asset to a new location/custodian (direct - requires approve_transfer permission)
 */
export async function transferAsset(assetId: string, data: any, userId: string, userRole: UserRole) {
    if (!canApproveTransfer(userRole)) {
        return { success: false, error: "Insufficient permissions. Only Asset Managers can approve transfers." };
    }
    try {
        const asset = await prisma.asset.findUnique({
            where: { id: assetId },
            include: { custodian: true }
        });
        if (!asset) return { success: false, error: "Asset not found" };

        const newCustodian = await prisma.user.findUnique({
            where: { id: data.custodianId }
        });
        const toCustodianName = newCustodian?.name || data.custodianName || 'Unknown';

        await prisma.asset.update({
            where: { id: assetId },
            data: {
                location: data.location,
                subLocation: data.subLocation,
                custodianId: data.custodianId,
                history: {
                    create: {
                        userId: userId,
                        action: 'Asset Transferred',
                        details: `Transferred to ${data.location}. New custodian: ${toCustodianName}`,
                        type: 'Transfer',
                        fromLocation: asset.location,
                        toLocation: data.location,
                        toCustodian: toCustodianName
                    }
                }
            }
        });

        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error("Error transferring asset:", error);
        return { success: false, error: "Transfer failed" };
    }
}

/**
 * Update asset condition and log history
 */
export async function updateAssetCondition(assetId: string, conditionCode: string, userId: string) {
    try {
        const asset = await prisma.asset.findUnique({ where: { id: assetId } });
        if (!asset) return { success: false, error: "Asset not found" };

        await prisma.asset.update({
            where: { id: assetId },
            data: { conditionCode }
        });

        await prisma.assetHistory.create({
            data: {
                assetId,
                userId,
                action: 'Condition Update',
                details: `Condition changed to ${conditionCode}`,
                type: 'Maintenance'
            }
        });

        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error("Error updating condition:", error);
        return { success: false, error: "Failed to update condition" };
    }
}

/**
 * Add value adjustment (Addition or Reduction) and recalculate depreciation
 */
export async function addAssetImprovement(
    assetId: string,
    data: { type: 'Addition' | 'Reduction'; amount: number; description: string; date: string },
    userId: string
) {
    try {
        const asset = await prisma.asset.findUnique({ where: { id: assetId } });
        if (!asset) return { success: false, error: "Asset not found" };

        const currentCost = Number(asset.acquisitionCost);
        const newCost = data.type === 'Addition' ? currentCost + data.amount : Math.max(0, currentCost - data.amount);

        await prisma.$transaction([
            prisma.assetImprovement.create({
                data: {
                    assetId,
                    type: data.type,
                    amount: data.amount,
                    description: data.description,
                    newAcquisitionCost: newCost,
                    date: new Date(data.date)
                }
            }),
            prisma.asset.update({
                where: { id: assetId },
                data: { acquisitionCost: newCost }
            })
        ]);

        // Regenerate depreciation schedule with new cost
        const updatedAsset = await prisma.asset.findUnique({
            where: { id: assetId },
            include: { schedules: true }
        });
        if (updatedAsset) {
            await prisma.depreciationSchedule.deleteMany({ where: { assetId } });
            const scheduleData = calculateDepreciationSchedule({
                acquisition_cost: newCost,
                registration_date: updatedAsset.registrationDate.toISOString(),
                useful_life: updatedAsset.usefulLife,
                salvage_value: Number(updatedAsset.salvageValue),
                method: updatedAsset.method as any
            });
            await prisma.depreciationSchedule.createMany({
                data: scheduleData.map(s => ({
                    assetId,
                    year: s.year,
                    fiscalYear: s.fiscal_year,
                    depreciationExpense: s.depreciation_expense,
                    accumulatedDepr: s.accumulated_depreciation,
                    netBookValue: s.net_book_value
                }))
            });
        }

        await prisma.assetHistory.create({
            data: {
                assetId,
                userId,
                action: `Value ${data.type}: ₦${data.amount.toLocaleString()}`,
                details: data.description || `${data.type} of ₦${data.amount.toLocaleString()}`,
                type: 'Maintenance'
            }
        });

        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error("Error adding improvement:", error);
        return { success: false, error: "Failed to update value" };
    }
}

/**
 * Add asset history (e.g. report issue) and optionally update status
 */
export async function addAssetHistory(
    assetId: string,
    data: { action: string; details: string; type: string; updateStatus?: string },
    userId: string
) {
    try {
        const updateData: any = {};
        if (data.updateStatus) {
            const statusMap: Record<string, string> = {
                'Maintenance': 'MAINTENANCE',
                'Active': 'ACTIVE',
                'Disposed': 'DISPOSED'
            };
            updateData.status = statusMap[data.updateStatus] || data.updateStatus.toUpperCase().replace(' ', '_');
        }

        if (Object.keys(updateData).length > 0) {
            await prisma.asset.update({
                where: { id: assetId },
                data: updateData
            });
        }

        await prisma.assetHistory.create({
            data: {
                assetId,
                userId,
                action: data.action,
                details: data.details,
                type: data.type
            }
        });

        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error("Error adding history:", error);
        return { success: false, error: "Failed to save" };
    }
}

/**
 * Clear all assets from the database (and cascade: schedules, history, improvements).
 * Use for a fresh start. Does not delete users or settings.
 */
export async function clearAllAssets() {
    try {
        await prisma.depreciationSchedule.deleteMany({});
        await prisma.assetHistory.deleteMany({});
        await prisma.assetImprovement.deleteMany({});
        await prisma.asset.deleteMany({});
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error("Error clearing assets:", error);
        return { success: false, error: "Failed to clear assets" };
    }
}
