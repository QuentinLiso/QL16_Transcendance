// src/views/ProfileView.ts
import { domElem, mount, bind } from "../ui/DomElement";
import { auth } from "../store/auth";
import { updateMe, uploadAvatar, deleteAvatar } from "../store/users";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { LabeledInput } from "../ui/Input";
import { Avatar } from "../ui/Avatar";

export const ProfileView = (root: HTMLElement) => {
  const title = domElem("h2", { class: "text-2xl font-semibold mb-4", text: "Your profile" });

  const card = Card();
  const avZone = domElem("div", { class: "flex items-center gap-4" });
  const form = domElem("form", { class: "mt-4 flex items-end gap-3" });

  const pseudo = LabeledInput("Pseudo");
  const avatarUrl = LabeledInput("Avatar URL");
  const save = Button("Save", { type: "submit" });
  const del = Button("Remove avatar", { variant: "ghost", onClick: () => deleteAvatar() });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const p = (pseudo.input as HTMLInputElement).value.trim();
    const url = (avatarUrl.input as HTMLInputElement).value.trim();
    if (p) await updateMe({ pseudo: p });
    if (url) await uploadAvatar(url);
  });

  mount(card, avZone, form);
  mount(form, pseudo.labelWrapper, avatarUrl.labelWrapper, save, del);

  const unbind = bind(auth, (s) => {
    avZone.replaceChildren(Avatar(s.me?.avatar_url ?? null, 64), domElem("div", { class: "font-medium", text: s.me?.pseudo ?? "..." }));
    pseudo.input.value = s.me?.pseudo ?? "";
    avatarUrl.input.value = s.me?.avatar_url ?? "";
  });

  root.append(title, card);
  return () => unbind();
};
