import { getAssets } from "@/app/actions/assets";
import { getUsers } from "@/app/actions/users";
import AppClient from "@/components/AppClient";

const TIMEOUT_MS = 10000; // 10 second timeout

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) =>
                setTimeout(() => reject(new Error("Timeout")), ms)
            ),
        ]);
    } catch {
        return fallback;
    }
}

export default async function Home() {
    const [initialAssets, initialUsers] = await Promise.all([
        withTimeout(getAssets(), TIMEOUT_MS, []),
        withTimeout(getUsers(), TIMEOUT_MS, []),
    ]);

    return (
        <AppClient
            initialAssets={initialAssets}
            initialUsers={initialUsers}
        />
    );
}
