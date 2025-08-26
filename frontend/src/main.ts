// main.ts
import "./styles/tailwind.css";
import { AuthAPI } from "./api/auth";
import { UsersAPI } from "./api/users";

// AuthAPI.register("z10@z.com", "zizou10", "Bonjour123");

await AuthAPI.login("z10@z.com", "Bonjour123");

await UsersAPI.me();
