// src/views/LoginView.ts
import { domElem, mount, bind } from "../ui/DomElement";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { LabeledInput } from "../ui/Input";
import { auth, login, verify2faLogin } from "../store/auth";
import { AuthAPI } from "../api/auth";

const LoginForm = () => {
  const idField = LabeledInput("Email or Pseudo", { name: "id", placeholder: "Zizou10 or example@mail.com" });
  const pwField = LabeledInput("Password", { type: "password", name: "pw", placeholder: "••••••••" });
  const err = domElem("div", { class: "text-sm text-rose-600 min-h-[1.25rem]" });
  const submit = Button("Sign in", { type: "submit" });

  const form = domElem("form", { class: "flex flex-col gap-3 text-gray-500" });
  mount(form, idField.labelWrapper, pwField.labelWrapper, err, submit);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.textContent = "";
    submit.setAttribute("disabled", "true");
    submit.classList.add("opacity-60", "cursor-not-allowed");

    try {
      await login((idField.input as HTMLInputElement).value, (pwField.input as HTMLInputElement).value);
      if (!auth.get().twofaRequired) location.hash = "/home";
    } catch (e: any) {
      err.textContent = e?.message ?? "Login failed";
    } finally {
      submit.removeAttribute("disabled");
      submit.classList.remove("opacity-60", "cursor-not-allowed");
    }
  });

  return { form, err };
};

const TwofaForm = () => {
  const codeField = LabeledInput("2FA Code", { name: "code", placeholder: "123 456" });
  const twofaSubmit = Button("Verify", { type: "submit" });
  const twofaErr = domElem("div", { class: "text-sm text-rose-600 min-h-[1.25rem]" });
  const twofaForm = domElem("form", { class: "flex flex-col gap-3 hidden" });
  mount(twofaForm, codeField.labelWrapper, twofaErr, twofaSubmit);

  twofaForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    twofaErr.textContent = "";
    try {
      await verify2faLogin((codeField.input as HTMLInputElement).value);
      location.hash = "/home";
    } catch (e: any) {
      twofaErr.textContent = e?.message ?? "Verification failed";
    }
  });

  return twofaForm;
};

const OAuthBar = () => {
  const oauthBar = domElem("div", { class: "flex flex-cols gap-3" });
  const github = Button("Login with Github", { variant: "ghost", onClick: () => AuthAPI.startGithubOAuth() });
  const google = Button("Login with Google", { variant: "ghost", onClick: () => AuthAPI.startGoogleOAuth() });
  const fortyTwo = Button("Login with 42", { variant: "ghost", onClick: () => AuthAPI.start42OAuth() });
  oauthBar.append(github, google, fortyTwo);

  return oauthBar;
};

export const LoginView = (root: HTMLElement) => {
  root.className = "min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-800 text-slate-100 grid place-items-center p-6";
  const box = Card();
  box.classList.add("w-full", "max-w-md", "bg-white/90");

  const title = domElem("h1", { class: "text-2xl font-semibold text-gray-800 mb-2", text: "Transcendance" });
  const subtitle = domElem("p", { class: "text-sm text-gray-500 mb-4", text: "Sign in to play Pong, chat and battle in tournaments." });

  const loginForm = LoginForm();
  const twofaForm = TwofaForm();
  const separator = domElem("div", { class: "h-px bg-gray-200 my-3" });
  const oauthBar = OAuthBar();

  mount(box, title, subtitle, loginForm.form, twofaForm, separator, oauthBar);
  root.appendChild(box);

  const stop = bind(auth, (s) => {
    if (s.twofaRequired) {
      loginForm.form.classList.add("hidden");
      twofaForm.classList.remove("hidden");
    } else {
      twofaForm.classList.add("hidden");
      loginForm.form.classList.remove("hidden");
    }
    loginForm.err.textContent = s.error ?? "";
  });

  return () => stop();
};
