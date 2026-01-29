
import { getAssets } from "@/app/actions/assets";
import { getUsers } from "@/app/actions/users";
import AppClient from "@/components/AppClient";

export default async function Home() {
    const initialAssets = await getAssets();
    const initialUsers = await getUsers();

    return (
        <AppClient
            initialAssets={initialAssets}
            initialUsers={initialUsers}
        />
    );
}
