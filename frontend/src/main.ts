// main.ts
import "./styles/tailwind.css";
import * as authStore from "./store/auth";
import * as usersStore from "./store/users";
import * as matchesStore from "./store/matches";

// AuthAPI.register("z10@z.com", "zizou10", "Bonjour123");

await authStore.bootstrapSession();
// await authStore.register("z11@z.z", "zizou11", "Bonjour123");
await authStore.login("zizou11", "Bonjour123");
await matchesStore.createMatch(6);
