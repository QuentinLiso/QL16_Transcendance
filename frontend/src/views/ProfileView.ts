// src/views/ProfileView.ts
import { domElem, mount, bind } from "../ui/DomElement";
import { auth } from "../store/auth";
import { usersIndex } from "../store/usersIndex";
import { userStats, loadUserStats } from "../store/usersStats";

import { updateMe, uploadAvatarFile, deleteAvatar } from "../store/users";
import { createSplashScreen } from "../ui/SplashScreen";
import { Button } from "../ui/Button";
import { LabeledInput } from "../ui/Input";
import { Avatar } from "../ui/Avatar";
import { UsersAPI } from "../api/users";

const TITLE_CLASSES = "text-teal-600 text-lg font-extrabold";
const SHARED_CLASSES = "rounded-lg bg-slate-50 backdrop-blur shadow-sm hover:shadow-md transition p-4 overflow-hidden";
const DEFAULT_AVATAR = "/user.png";

const CARD_CLASSES = "rounded-lg bg-slate-50 backdrop-blur shadow-sm hover:shadow-md transition overflow-hidden";

function Card(title: string, opts?: { minH?: string; contentClass?: string }) {
  const { minH = "min-h-28", contentClass = "" } = opts ?? {};

  const box = domElem("section", { class: CARD_CLASSES + " flex flex-col" });

  // Title docked top-left
  const header = domElem("h2", { class: TITLE_CLASSES + " p-4 pb-2", text: title });

  // Centered content slot (this is the magic)
  // grid + place-items-center centers both axes; min-h gives it breathing room
  const slot = domElem("div", {
    class: `h-full grid place-items-center ${minH} p-4 ${contentClass}`,
  });

  mount(box, header, slot);
  return { box, slot };
}

const MatchHistoryCard = () => {
  const { box, slot } = Card("Match History", { minH: "min-h-24" });

  const scores: { me: number; opp: number }[] = [
    { me: 1, opp: 2 },
    { me: 4, opp: 2 },
    { me: 5, opp: 3 },
    { me: 5, opp: 2 },
    { me: 1, opp: 6 },
    { me: 7, opp: 2 },
    { me: 1, opp: 2 },
  ];

  if (scores.length === 0) {
    const emptyMatchSquare = domElem("div", {
      class: "text-slate-400 text-lg",
      text: "No match to display yet.",
    });
    slot.append(emptyMatchSquare);
  } else {
    const row = domElem("div", { class: "flex flex-wrap items-center justify-center gap-4" });
    const scoreSquare = ({ me, opp }: { me: number; opp: number }) => {
      const win = me > opp;
      const colors = win ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-600" : "bg-rose-200 border-rose-500/40 text-rose-600";

      const box = domElem("div", {
        class: `w-14 h-16 py-1 rounded-md border ${colors} flex flex-col items-center justify-around leading-none select-none font-bold`,
      });
      const topScore = domElem("div", { text: String(me) });
      const bottomScore = domElem("div", { text: String(opp) });
      mount(box, topScore, bottomScore);
      return box;
    };
    scores.forEach((s) => row.append(scoreSquare(s)));
    slot.append(row);
  }
  return box;
};

const WinrateCard = () => {
  const { box, slot } = Card("Winning Rate", { minH: "min-h-24" });

  const data = { won: 23, winrate: 0.53 };

  const wrap = domElem("div", { class: "flex flex-col text-center" });
  const gamesWon = domElem("div", { class: "font-extrabold text-2xl text-teal-600", text: `${data.won} games won` });
  const winRate = domElem("div", { class: "text-xl text-slate-400", text: `(${Math.round(data.winrate * 100)}%)` });

  mount(wrap, gamesWon, winRate);
  slot.append(wrap);
  return box;
};

const LongestStreakCard = () => {
  const { box, slot } = Card("Longest Streak", { minH: "min-h-24" });

  const data = { win: 4, loss: 3 };

  const wrap = domElem("div", {
    class: "flex flex-row justify-around items-center gap-12",
  });

  const winStreak = domElem("div", {
    class: "bg-emerald-600/20 border-emerald-500/40 text-emerald-600 w-10 h-14 py-1 rounded-md border font-bold flex justify-center items-center",
  });
  const wsText = domElem("div", { text: `${data.win}` });
  mount(winStreak, wsText);

  const loseStreak = domElem("div", {
    class: "bg-rose-200 border-rose-500/40 text-rose-600 w-10 h-14 py-1 rounded-md border font-bold flex justify-center items-center",
  });
  const lsText = domElem("div", { text: `${data.loss}` });
  mount(loseStreak, lsText);

  mount(wrap, winStreak, loseStreak);
  slot.append(wrap);
  return box;
};

const LeaderboardCard = () => {
  const { box, slot } = Card("LeaderBoard", { minH: "min-h-32" });

  const players: { name: string; score: number }[] = [
    { name: "Frank", score: 217 },
    { name: "Tom", score: 37 },
    { name: "Youri", score: 543 },
  ].sort((a, b) => b.score - a.score);

  if (players.length === 0) {
    const emptyLeaderBoard = domElem("div", {
      class: "text-slate-400 text-lg",
      text: "None has played yet.",
    });
    slot.append(emptyLeaderBoard);
  } else {
    const list = domElem("div", { class: "mx-auto w-full max-w-md flex flex-col gap-2" });

    players.forEach((p, i) => {
      const isFirst = i === 0;
      const isSecond = i === 1;

      const gold = "\u{1F947}";
      const silver = "\u{1F948}";
      const bronze = "\u{1F949}";

      const bgColor = isFirst ? "bg-amber-300/50" : isSecond ? "bg-slate-300/50" : "bg-amber-700/50";
      const bdColor = isFirst ? "border-amber-300" : isSecond ? "border-slate-300" : "border-amber-700";
      const textColor = isFirst ? "text-amber-500" : isSecond ? "text-slate-500" : "text-amber-800";
      const rankEmoji = isFirst ? gold : isSecond ? silver : bronze;
      const row = domElem("div", {
        class: `flex items-center justify-between h-18 px-3 rounded-xl border ${bgColor} ${bdColor} ${textColor}`,
      });
      const rank = domElem("div", { class: "text-center text-lg", text: rankEmoji });
      const name = domElem("div", { class: "truncate", text: p.name });
      const score = domElem("div", { class: "text-right font-semibold [font-variant-numeric:tabular-nums]", text: String(p.score) });
      mount(row, rank, name, score);
      list.appendChild(row);
    });
    slot.append(list);
  }
  return box;
};

const ProfileEditForm = (onDone: () => void) => {
  const wrap = domElem("form", { class: "flex flex-col gap-4" });

  // Fields
  const nameField = LabeledInput("Name");
  const emailField = LabeledInput("Email");
  //   const twoFfa = TwoFaSetup();

  // File picker
  const fileRow = domElem("div", { class: "flex items-center gap-3" });
  const pickBtn = Button("Choose image...", { variant: "ghost" });
  const hint = domElem("span", { class: "text-sm text-slate-500" });
  const fileInput = domElem("input", { attributes: { type: "file", accept: "image/*" }, class: "hidden" });

  pickBtn.addEventListener("click", (e) => {
    e.preventDefault();
    (fileInput as HTMLInputElement).click();
  });

  fileInput.addEventListener("change", async () => {
    const file = (fileInput as HTMLInputElement).files?.[0];
    if (!file) return;
    hint.textContent = "Uploading...";
    pickBtn.setAttribute("disabled", "true");
    try {
      await UsersAPI.uploadAvatar(file);
      hint.textContent = "Uploaded :)";
    } catch (e: any) {
      hint.textContent = "Upload failed";
      hint.classList.replace("text-slate-500", "text-rose-600");
    } finally {
      pickBtn.removeAttribute("disabled");
      setTimeout(() => {
        if (hint.textContent?.startsWith("Uploaded")) hint.textContent = "";
      }, 1200);
    }
  });

  mount(fileRow, pickBtn, hint, fileInput);

  // Buttons
  const actions = domElem("div", { class: "flex items-center justify-end gap-2 pt-2" });
  const cancelBtn = Button("Cancel", {
    variant: "ghost",
    onClick: (e) => {
      e.preventDefault();
      onDone();
    },
  });
  const saveBtn = Button("Save Changes", { variant: "primary", type: "submit" });
  mount(actions, cancelBtn, saveBtn);

  // Bind current values
  const unbind = bind(auth, (s) => {
    nameField.input.value = s.me?.pseudo ?? "";
    emailField.input.value = s.me?.email ?? "";
  });

  // Submit
  wrap.addEventListener("submit", async (e) => {
    e.preventDefault();
    saveBtn.setAttribute("disabled", "true");

    try {
      const pseudo = nameField.input.value.trim();
      // const email = emailField.input.value.trim();

      if (pseudo && pseudo !== auth.get().me?.pseudo) await updateMe({ pseudo });
      // if (email && email !== auth.get().me?.email) await updateMe({email});
      onDone();
    } finally {
      saveBtn.removeAttribute("disabled");
    }
  });

  // Mount everything
  mount(wrap, fileRow, nameField.labelWrapper, emailField.labelWrapper, actions);
  return { wrap, dispose: () => unbind() };
};

const ProfileCard = () => {
  const user = {
    username: "PlayerOne",
    email: "player@example.com",
    avatar_url: "/user.png",
    twofa_enabled: false,
  };

  const box = domElem("div", { class: "rounded-lg bg-slate-50 backdrop-blur shadow-sm hover:shadow-md transition overflow-hidden flex flex-col" });

  // Top: gradient header (~1/3 height)
  const header = domElem("div", {
    class: "h-44 sm:h-60 bg-gradient-to-r from-teal-700 to-emerald-300 p-4 flex flex-col justify-center items-center gap-6",
  });
  const avatar = domElem("img", {
    class: "w-14 h-14 sm:w-16 sm:h-16 rounded-full ring-2 ring-white/70 object-cover",
    attributes: {
      src: user.avatar_url || DEFAULT_AVATAR,
      alt: user.username,
    },
  });
  const uname = domElem("div", {
    class: "text-white font-semibold text-lg sm:text-xl",
    text: user.username,
  });
  mount(header, avatar, uname);

  // Bottom: details + button pinned at bottom
  const body = domElem("div", { class: "p-6 flex-1 flex flex-col gap-4" });

  // Row: email
  const emailRow = domElem("div", {
    class: "flex items-center justify-between",
  });
  const emailLabel = domElem("span", {
    class: "text-lg text-zinc-400",
    text: "Email",
  });
  const emailValue = domElem("span", {
    class: "text-lg font-medium text-teal-600 truncate max-w-[60%] text-right",
    text: user.email,
  });
  mount(emailRow, emailLabel, emailValue);

  // Row: 2FA status
  const twofaRow = domElem("div", { class: "flex items-center justify-between" });
  const twofaLabel = domElem("span", { class: "text-lg text-zinc-400", text: "2FA" });
  const twofaBadge = domElem("span", {
    class: `inline-flex items-center px-2 py-0.5 rounded-full text-lg border ${
      user.twofa_enabled ? "border-emerald-500/50 text-emerald-500 bg-emerald-600/15" : "border-rose-600 text-rose-600 bg-rose-200"
    }`,
    text: user.twofa_enabled ? "Enabled" : "Disabled",
  });
  mount(twofaRow, twofaLabel, twofaBadge);

  // Spacer so the button hugs the bottom
  const spacer = domElem("div", { class: "flex-1" });

  // Edit profile button
  const editBtn = domElem("button", {
    class: "text-gray-400 hover:text-teal-600 text-lg font-bold mouse-pointer",
    text: "Edit profile",
  });
  editBtn.append(domElem("i", { class: "ml-3 fa-solid fa-edit" }));

  const editProfileMenu = createSplashScreen("Edit Profile");
  document.body.appendChild(editProfileMenu.backdrop);

  const unbind = bind(auth, (s) => {
    const me = s.me;
    uname.textContent = me?.pseudo ?? "...";
    emailValue.textContent = me?.email ?? "...";
    const src = me?.avatar_url || DEFAULT_AVATAR;
    if (avatar.getAttribute("src") !== src) avatar.setAttribute("src", src);
  });

  editBtn.addEventListener("click", () => {
    const form = ProfileEditForm(() => editProfileMenu.close());
    editProfileMenu.setContent(form.wrap);
    editProfileMenu.open();
  });
  mount(body, emailRow, twofaRow, spacer, editBtn);

  mount(box, header, body);
  return box;
};

const LatestMatchCard = () => {
  const { box, slot } = Card("Latest Match", { minH: "min-h-10" });

  const matchesPlayed = 1;

  if (matchesPlayed === 0) {
    const emptyLeaderBoard = domElem("div", {
      class: "text-slate-400 text-lg",
      text: "None has played yet.",
    });
    slot.appendChild(emptyLeaderBoard);
  } else {
    const wrap = domElem("div", { class: "mx-auto w-full max-w-md flex flex-col gap-2" });
    const latestMatch = {
      me: { name: "Player One", avatar: DEFAULT_AVATAR, score: 7 },
      opponent: { name: "Tom", avatar: DEFAULT_AVATAR, score: 3 },
    };
    const didWin = latestMatch.me.score > latestMatch.opponent.score;

    function row(player: { name: string; avatar: string; score: number }, badge?: HTMLElement) {
      const rowEl = domElem("div", { class: "flex justify-between items-center w-full" });

      const nameBox = domElem("div", { class: "flex items-center gap-5" });
      const avatar = domElem("img", {
        class: "w-8 h-8 rounded-full object-cover",
        attributes: {
          src: player.avatar,
          alt: player.name,
        },
      });
      const name = domElem("div", { class: "truncate text-teal-600 font-medium", text: player.name });
      mount(nameBox, avatar, name);

      const scoreBox = domElem("div", { class: "flex items-center gap-2" });
      const score = domElem("div", { class: "w-6 text-right font-semibold [font-variant-numeric:tabular-nums]", text: String(player.score) });
      scoreBox.append(score, badge ?? domElem("div", { class: "w-5 h-5" }));

      mount(rowEl, nameBox, scoreBox);
      return rowEl;
    }
    const badge = domElem("div", {
      class: "w-5 h-5 rounded text-xs flex items-center justify-center " + (didWin ? "bg-emerald-600/70 text-white" : "bg-rose-600/70 text-white"),
      text: didWin ? "W" : "L",
    });

    const meRow = row(latestMatch.me, badge);
    const oppRow = row(latestMatch.opponent);
    mount(wrap, meRow, oppRow);
    slot.append(wrap);
  }

  return box;
};

export const ProfileView = (root: HTMLElement) => {
  const matchHistory = MatchHistoryCard();
  const winRate = WinrateCard();
  const longestStreak = LongestStreakCard();
  const leaderBoard = LeaderboardCard();
  const profileCard = ProfileCard();
  const latestMatch = LatestMatchCard();

  const meId = auth.get().meId as number;
  const me = usersIndex.get().byId[meId];

  const meStats = userStats.get().byId[me.id];

  root.className = "grid grid-cols-8 grid-rows-5 gap-3 px-8 py-12";

  matchHistory.className += " col-span-4 row-span-1";
  profileCard.className += " col-span-4 row-span-4";
  winRate.className += " col-span-2 row-span-2";
  longestStreak.className += " col-span-2 row-span-2";
  leaderBoard.className += " col-span-4 row-span-2";
  latestMatch.className += " col-span-4 row-span-1";

  root.replaceChildren(matchHistory, profileCard, winRate, longestStreak, leaderBoard, latestMatch);
};
//   const card = Card();
//   const avZone = domElem("div", { class: "flex items-center gap-4" });
//   const form = domElem("form", { class: "mt-4 flex items-end gap-3" });
//   const pseudo = LabeledInput("Pseudo");
//   const avatarUrl = LabeledInput("Avatar URL");
//   const save = Button("Save", { type: "submit" });
//   const del = Button("Remove avatar", { variant: "ghost", onClick: () => deleteAvatar() });
//   form.addEventListener("submit", async (e) => {
//     e.preventDefault();
//     const p = (pseudo.input as HTMLInputElement).value.trim();
//     const url = (avatarUrl.input as HTMLInputElement).value.trim();
//     if (p) await updateMe({ pseudo: p });
//     if (url) await uploadAvatar(url);
//   });
//   mount(card, avZone, form);
//   mount(form, pseudo.labelWrapper, avatarUrl.labelWrapper, save, del);
//   const unbind = bind(auth, (s) => {
//     avZone.replaceChildren(Avatar(s.me?.avatar_url ?? null, 64), domElem("div", { class: "font-medium", text: s.me?.pseudo ?? "..." }));
//     pseudo.input.value = s.me?.pseudo ?? "";
//     avatarUrl.input.value = s.me?.avatar_url ?? "";
//   });
//   root.append(card);
//   return () => unbind();
