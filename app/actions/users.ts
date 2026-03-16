
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

export async function loginUser(email: string, password?: string) {
    try {
        // Hardcode a check for now if database is not ready or seeded correctly yet during dev
        // BUT ideally we use the DB.

        let user = await prisma.user.findUnique({
            where: { email }
        });

        // If user not found, return error
        if (!user) {
            return { success: false, error: "User not found" };
        }

        // Verify password
        // START TEMP BYPASS FOR DEMO if password field is missing in runtime (shouldn't be if migration worked)
        if (password) {
            // Dynamically import bcrypt to avoid edge runtime issues if any (though this is a server action)
            const bcrypt = await import('bcryptjs');
            const isValid = await bcrypt.compare(password, user.password);

            if (!isValid) {
                return { success: false, error: "Invalid password" };
            }
        } else {
            // For safety, require password unless it's a legacy session check? 
            // But for this task, let's require it.
            return { success: false, error: "Password required" };
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() }
        });

        // Return valid user without password hash
        const { password: _, ...userWithoutPassword } = user;
        return { success: true, user: userWithoutPassword };

    } catch (error) {
        console.error("Login error:", error);
        return { success: false, error: "Authentication failed" };
    }
}
