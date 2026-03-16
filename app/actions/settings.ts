"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ============================================
// DEPARTMENTS
// ============================================

export async function getDepartments() {
    try {
        const departments = await prisma.department.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' }
        });
        return { success: true, departments };
    } catch (error) {
        console.error("Error fetching departments:", error);
        return { success: false, error: "Failed to fetch departments" };
    }
}

export async function createDepartment(data: {
    name: string;
    code: string;
    location: string;
}) {
    try {
        // Validate input
        if (!data.name?.trim() || !data.code?.trim() || !data.location?.trim()) {
            return { success: false, error: "All fields are required" };
        }

        const department = await prisma.department.create({
            data: {
                name: data.name.trim(),
                code: data.code.trim().toUpperCase(),
                location: data.location.trim()
            }
        });
        revalidatePath('/');
        return { success: true, department };
    } catch (error: any) {
        console.error("Error creating department:", error);
        console.error("Error details:", { code: error.code, message: error.message, meta: error.meta });
        if (error.code === 'P2002') {
            return { success: false, error: "Department name or code already exists" };
        }
        return { success: false, error: error.message || "Failed to create department" };
    }
}

export async function updateDepartment(id: string, data: {
    name?: string;
    code?: string;
    location?: string;
}) {
    try {
        const department = await prisma.department.update({
            where: { id },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.code && { code: data.code.toUpperCase() }),
                ...(data.location && { location: data.location })
            }
        });
        revalidatePath('/');
        return { success: true, department };
    } catch (error: any) {
        console.error("Error updating department:", error);
        if (error.code === 'P2002') {
            return { success: false, error: "Department name or code already exists" };
        }
        return { success: false, error: "Failed to update department" };
    }
}

export async function deleteDepartment(id: string) {
    try {
        // Soft delete
        await prisma.department.update({
            where: { id },
            data: { isActive: false }
        });
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error("Error deleting department:", error);
        return { success: false, error: "Failed to delete department" };
    }
}

/**
 * Sync departments from reference data (LOCATION_BRANCHES + DEPARTMENT_CODES).
 * Creates missing departments in the DB; skips existing ones.
 */
export async function syncDepartmentsFromReference(
    locationBranches: Record<string, string[]>,
    codes: Record<string, string>
) {
    try {
        let added = 0;
        const seen = new Set<string>();
        for (const [locationName, branchNames] of Object.entries(locationBranches)) {
            if (!locationName?.trim() || !Array.isArray(branchNames)) continue;
            for (const name of branchNames) {
                if (!name?.trim() || seen.has(name.trim())) continue;
                seen.add(name.trim());
                const existing = await prisma.department.findFirst({
                    where: { name: name.trim() }
                });
                if (!existing) {
                    const code = (codes[name.trim()] || name.trim().slice(0, 3).toUpperCase().replace(/\s/g, '') || 'DEPT').toUpperCase();
                    const codeStr = code.length > 5 ? code.slice(0, 5) : code;
                    await prisma.department.create({
                        data: {
                            name: name.trim(),
                            code: codeStr,
                            location: locationName.trim()
                        }
                    });
                    added++;
                }
            }
        }
        revalidatePath('/');
        return { success: true, added };
    } catch (error: unknown) {
        console.error("Error syncing departments:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to sync departments" };
    }
}

// ============================================
// CUSTODIANS
// ============================================

export async function getCustodians() {
    try {
        const custodians = await prisma.custodian.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' }
        });
        return { success: true, custodians };
    } catch (error) {
        console.error("Error fetching custodians:", error);
        return { success: false, error: "Failed to fetch custodians" };
    }
}

export async function createCustodian(data: {
    name: string;
    department: string;
    location: string;
    email?: string;
    phone?: string;
}) {
    try {
        const custodian = await prisma.custodian.create({
            data: {
                name: data.name,
                department: data.department,
                location: data.location,
                email: data.email,
                phone: data.phone
            }
        });
        revalidatePath('/');
        return { success: true, custodian };
    } catch (error) {
        console.error("Error creating custodian:", error);
        return { success: false, error: "Failed to create custodian" };
    }
}

export async function updateCustodian(id: string, data: {
    name?: string;
    department?: string;
    location?: string;
    email?: string;
    phone?: string;
}) {
    try {
        const custodian = await prisma.custodian.update({
            where: { id },
            data
        });
        revalidatePath('/');
        return { success: true, custodian };
    } catch (error) {
        console.error("Error updating custodian:", error);
        return { success: false, error: "Failed to update custodian" };
    }
}

export async function deleteCustodian(id: string) {
    try {
        // Soft delete
        await prisma.custodian.update({
            where: { id },
            data: { isActive: false }
        });
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error("Error deleting custodian:", error);
        return { success: false, error: "Failed to delete custodian" };
    }
}

// ============================================
// LOCATIONS
// ============================================

export async function getLocations() {
    try {
        const locations = await prisma.location.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' }
        });
        return { success: true, locations };
    } catch (error) {
        console.error("Error fetching locations:", error);
        return { success: false, error: "Failed to fetch locations" };
    }
}

export async function createLocation(data: {
    name: string;
    code?: string;
}) {
    try {
        if (!data.name?.trim()) {
            return { success: false, error: "Name is required" };
        }
        const name = data.name.trim();
        let code = data.code?.trim()?.toUpperCase();
        if (!code) {
            code = name.slice(0, 3).toUpperCase().replace(/\s/g, '') || 'LOC';
            const existing = await prisma.location.findFirst({ where: { code } });
            if (existing) code = code + String(Date.now()).slice(-4);
        }
        const location = await prisma.location.create({
            data: { name, code }
        });
        revalidatePath('/');
        return { success: true, location };
    } catch (error: any) {
        console.error("Error creating location:", error);
        if (error.code === 'P2002') {
            return { success: false, error: "Location name or code already exists" };
        }
        return { success: false, error: error.message || "Failed to create location" };
    }
}

export async function updateLocation(id: string, data: {
    name?: string;
    code?: string;
}) {
    try {
        const location = await prisma.location.update({
            where: { id },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.code && { code: data.code.toUpperCase() })
            }
        });
        revalidatePath('/');
        return { success: true, location };
    } catch (error: any) {
        console.error("Error updating location:", error);
        if (error.code === 'P2002') {
            return { success: false, error: "Location name or code already exists" };
        }
        return { success: false, error: "Failed to update location" };
    }
}

export async function deleteLocation(id: string) {
    try {
        // Soft delete
        await prisma.location.update({
            where: { id },
            data: { isActive: false }
        });
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error("Error deleting location:", error);
        return { success: false, error: "Failed to delete location" };
    }
}

// ============================================
// CATEGORIES
// ============================================

export async function getCategories() {
    try {
        const categories = await prisma.category.findMany({
            where: { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            include: { assetTypes: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] } }
        });
        return { success: true, categories };
    } catch (error) {
        console.error("Error fetching categories:", error);
        return { success: false, error: "Failed to fetch categories" };
    }
}

export async function createCategory(data: { name: string; code?: string }) {
    try {
        if (!data.name?.trim()) return { success: false, error: "Name is required" };
        const db = (await import("@/lib/prisma")).default;
        if (!db?.category) {
            return { success: false, error: "Database not ready. Run: npx prisma generate" };
        }
        const category = await db.category.create({
            data: { name: data.name.trim(), code: data.code?.trim() || null }
        });
        revalidatePath('/');
        return { success: true, category };
    } catch (error: any) {
        if (error.code === 'P2002') {
            try {
                const name = data.name?.trim();
                if (name) {
                    const db = (await import("@/lib/prisma")).default;
                    if (db?.category) {
                        const existing = await db.category.findFirst({ where: { name } });
                        if (existing && !existing.isActive) {
                            const category = await db.category.update({
                                where: { id: existing.id },
                                data: { isActive: true, ...(data.code?.trim() && { code: data.code.trim() }) }
                            });
                            revalidatePath('/');
                            return { success: true, category };
                        }
                    }
                }
            } catch (_) { /* fall through */ }
            return { success: false, error: "Category name already exists" };
        }
        return { success: false, error: error.message || "Failed to create category" };
    }
}

export async function updateCategory(id: string, data: { name?: string; code?: string }) {
    try {
        await prisma.category.update({
            where: { id },
            data: { ...(data.name && { name: data.name.trim() }), ...(data.code !== undefined && { code: data.code?.trim() || null }) }
        });
        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        if (error.code === 'P2002') return { success: false, error: "Category name already exists" };
        return { success: false, error: "Failed to update category" };
    }
}

export async function deleteCategory(id: string) {
    try {
        await prisma.category.update({ where: { id }, data: { isActive: false } });
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error("Error deleting category:", error);
        return { success: false, error: "Failed to delete category" };
    }
}

// ============================================
// ASSET TYPES (sub-categories per category)
// ============================================

export async function getAssetTypes(categoryId?: string) {
    try {
        const where: any = { isActive: true };
        if (categoryId) where.categoryId = categoryId;
        const assetTypes = await prisma.assetType.findMany({
            where,
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            include: { category: true }
        });
        return { success: true, assetTypes };
    } catch (error) {
        console.error("Error fetching asset types:", error);
        return { success: false, error: "Failed to fetch asset types" };
    }
}

export async function createAssetType(data: { categoryId: string; name: string; code?: string }) {
    try {
        if (!data.categoryId || !data.name?.trim()) return { success: false, error: "Category and name are required" };
        const assetType = await prisma.assetType.create({
            data: { categoryId: data.categoryId, name: data.name.trim(), code: data.code?.trim() || null }
        });
        revalidatePath('/');
        return { success: true, assetType };
    } catch (error) {
        console.error("Error creating asset type:", error);
        return { success: false, error: "Failed to create asset type" };
    }
}

export async function updateAssetType(id: string, data: { name?: string; code?: string }) {
    try {
        await prisma.assetType.update({
            where: { id },
            data: { ...(data.name && { name: data.name.trim() }), ...(data.code !== undefined && { code: data.code?.trim() || null }) }
        });
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error("Error updating asset type:", error);
        return { success: false, error: "Failed to update asset type" };
    }
}

export async function deleteAssetType(id: string) {
    try {
        await prisma.assetType.update({ where: { id }, data: { isActive: false } });
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error("Error deleting asset type:", error);
        return { success: false, error: "Failed to delete asset type" };
    }
}

// ============================================
// ASSET CLASSES & CUSTODIAN OPTIONS
// ============================================

export async function getAssetClasses() {
    try {
        const assetClasses = await prisma.assetClass.findMany({
            where: { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            include: { custodianOptions: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] } }
        });
        return { success: true, assetClasses };
    } catch (error) {
        console.error("Error fetching asset classes:", error);
        return { success: false, error: "Failed to fetch asset classes" };
    }
}

export async function createAssetClass(data: { name: string; code?: string }) {
    try {
        if (!data.name?.trim()) return { success: false, error: "Name is required" };
        const assetClass = await prisma.assetClass.create({
            data: { name: data.name.trim(), code: data.code?.trim() || null }
        });
        revalidatePath('/');
        return { success: true, assetClass };
    } catch (error: any) {
        if (error.code === 'P2002') return { success: false, error: "Asset class name already exists" };
        return { success: false, error: error.message || "Failed to create asset class" };
    }
}

export async function updateAssetClass(id: string, data: { name?: string; code?: string }) {
    try {
        await prisma.assetClass.update({
            where: { id },
            data: { ...(data.name && { name: data.name.trim() }), ...(data.code !== undefined && { code: data.code?.trim() || null }) }
        });
        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        if (error.code === 'P2002') return { success: false, error: "Asset class name already exists" };
        return { success: false, error: "Failed to update asset class" };
    }
}

export async function deleteAssetClass(id: string) {
    try {
        await prisma.assetClass.update({ where: { id }, data: { isActive: false } });
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error("Error deleting asset class:", error);
        return { success: false, error: "Failed to delete asset class" };
    }
}

export async function createCustodianOption(data: { assetClassId: string; name: string }) {
    try {
        if (!data.assetClassId || !data.name?.trim()) return { success: false, error: "Asset class and name are required" };
        const option = await prisma.custodianOption.create({
            data: { assetClassId: data.assetClassId, name: data.name.trim() }
        });
        revalidatePath('/');
        return { success: true, custodianOption: option };
    } catch (error) {
        console.error("Error creating custodian option:", error);
        return { success: false, error: "Failed to create custodian option" };
    }
}

export async function updateCustodianOption(id: string, data: { name?: string }) {
    try {
        if (data.name !== undefined && !data.name?.trim()) return { success: false, error: "Name is required" };
        await prisma.custodianOption.update({
            where: { id },
            data: { ...(data.name && { name: data.name.trim() }) }
        });
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error("Error updating custodian option:", error);
        return { success: false, error: "Failed to update custodian option" };
    }
}

export async function deleteCustodianOption(id: string) {
    try {
        await prisma.custodianOption.update({ where: { id }, data: { isActive: false } });
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error("Error deleting custodian option:", error);
        return { success: false, error: "Failed to delete custodian option" };
    }
}
