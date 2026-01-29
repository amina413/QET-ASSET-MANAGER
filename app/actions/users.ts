
"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getUsers() {
    try {
        return await prisma.user.findMany({
            orderBy: { name: 'asc' }
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        return [];
    }
}

export async function createUser(data: any) {
    try {
        const user = await prisma.user.create({
            data: {
                name: data.name,
                email: data.email,
                department: data.department,
                role: data.role || 'CUSTODIAN',
            }
        });
        revalidatePath('/');
        return { success: true, user };
    } catch (error) {
        console.error("Error creating user:", error);
        return { success: false, error: "Failed to create user" };
    }
}

export async function loginUser(email: string) {
    try {
        let user = await prisma.user.findUnique({
            where: { email }
        });

        // Auto-seed demo users if they don't exist
        if (!user && (email === 'admin@abdc.com' || email === 'manager@abdc.com' || email === 'emeka@abdc.com' || email === 'audit@abdc.com')) {
            const demoData: Record<string, any> = {
                'admin@abdc.com': { name: 'Amina Yusuf', department: 'IT', role: 'SYSTEM_ADMIN' },
                'manager@abdc.com': { name: 'Tunde Bakare', department: 'Finance', role: 'ASSET_MANAGER' },
                'emeka@abdc.com': { name: 'Emeka Okafor', department: 'Operations', role: 'CUSTODIAN' },
                'audit@abdc.com': { name: 'Chioma Obi', department: 'Internal Audit', role: 'AUDITOR' },
            };
            const data = demoData[email];
            user = await prisma.user.create({
                data: {
                    email,
                    name: data.name,
                    department: data.department,
                    role: data.role
                }
            });
        }

        if (user) {
            await prisma.user.update({
                where: { id: user.id },
                data: { lastLogin: new Date() }
            });
            return { success: true, user };
        }
        return { success: false, error: "User not found" };
    } catch (error) {
        console.error("Login error:", error);
        return { success: false, error: "Authentication failed" };
    }
}
