// main.ts
import "./styles/tailwind.css";
import { LoginView } from "./views/LoginView";

const app = document.getElementById("app") as HTMLElement;
LoginView(app);
