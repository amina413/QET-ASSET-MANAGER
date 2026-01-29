
"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { calculateDepreciationSchedule, DepreciationMethod } from "@/utils/depreciation";
import { Asset, AssetHistoryEvent } from "@/types";

/**
 * Fetch all assets from the database
 */
export async function getAssets() {
    try {
        const assets = await prisma.asset.findMany({
            include: {
                custodian: true,
                history: true,
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
            };
        });
    } catch (error) {
        console.error("Error fetching assets:", error);
        return [];
    }
}

/**
 * Register a new asset and generate its depreciation schedule
 */
export async function createAsset(formData: any, userId: string) {
    try {
        const asset = await prisma.asset.create({
            data: {
                productId: formData.productId,
                name: formData.name,
                category: formData.category,
                subCategory: formData.subCategory,
                acquisitionCost: formData.acquisitionCost,
                acquisitionDate: new Date(formData.acquisitionDate),
                salvageValue: formData.salvageValue || 0,
                usefulLife: formData.usefulLife,
                method: formData.depreciationMethod as any,
                location: formData.location,
                subLocation: formData.subLocation,
                custodianId: userId,
                conditionCode: formData.condition || 'A1',
                status: 'ACTIVE',
            }
        });

        // Generate and save depreciation schedule
        const scheduleData = calculateDepreciationSchedule({
            acquisition_cost: Number(asset.acquisitionCost),
            acquisition_date: asset.acquisitionDate.toISOString(),
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

/**
 * Transfer an asset to a new location/custodian
 */
export async function transferAsset(assetId: string, data: any, userId: string) {
    try {
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
                        details: `Transferred to ${data.location}, ${data.subLocation}. New custodian ID: ${data.custodianId}`,
                        type: 'Transfer'
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
