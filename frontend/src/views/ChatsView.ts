// src/views/ChatPrototypeView.ts
import { domElem as h, mount } from "../ui/DomElement";
import { Avatar } from "../ui/Avatar";

/* ---------------- Dummy data ---------------- */
type Friend = { id: number; name: string; avatar: string | null; online: boolean; last?: string };
type Msg = { id: number; authorId: number; body: string; at: string };

const me = { id: 1, name: "You", avatar: "/user.png" };

const friends: Friend[] = [
  { id: 2, name: "Ada Lovelace", avatar: "/user.png", online: true, last: "See you at 8?" },
  { id: 3, name: "Alan Turing", avatar: "/user.png", online: false, last: "" },
  { id: 4, name: "Grace Hopper", avatar: "/user.png", online: true, last: "Ship it." },
];

const conv: Record<number, Msg[]> = {
  2: [
    { id: 1, authorId: 2, body: "Hey!", at: "10:02" },
    { id: 2, authorId: 1, body: "Yo 👋", at: "10:03" },
    { id: 3, authorId: 2, body: "See you at 8?", at: "10:04" },
  ],
  3: [],
  4: [{ id: 1, authorId: 4, body: "Ship it.", at: "09:12" }],
};

/* ---------------- Small helpers ---------------- */
function statusDot(online: boolean) {
  const c = online ? "bg-emerald-500" : "bg-slate-400";
  return h("span", { class: `inline-block w-2.5 h-2.5 rounded-full ${c}` });
}

function MessageBubble(m: Msg, isMine: boolean) {
  const wrap = h("div", { class: "flex " + (isMine ? "justify-end" : "justify-start") });
  const bubble = h("div", {
    class: "max-w-[70%] px-3 py-2 rounded-2xl shadow-sm " + (isMine ? "bg-indigo-600 text-white rounded-br-sm" : "bg-slate-100 text-slate-800 rounded-bl-sm"),
  });
  bubble.append(h("div", { class: "whitespace-pre-wrap break-words", text: m.body }));
  bubble.append(h("div", { class: "text-[10px] opacity-70 mt-1 text-right", text: m.at }));
  wrap.append(bubble);
  return wrap;
}

/* ---------------- Panels ---------------- */
function LeftPanel(state: { activeId: number | null; query: string; setActive: (id: number) => void; setQuery: (q: string) => void }) {
  const box = h("aside", { class: "bg-emerald-50 border-r border-emerald-100 p-3 flex flex-col gap-3" });
  const header = h("div", { class: "px-2 pt-1 text-emerald-900 font-semibold", text: "Messages" });

  // NEW: search bar (filters friends list)
  const search = h("input", {
    class: "mx-2 mt-1 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-100/70 " + "placeholder-emerald-900/50 focus:outline-none focus:ring-2 focus:ring-emerald-400",
    attributes: { placeholder: "Search friends…", type: "search" },
  }) as HTMLInputElement;
  search.value = state.query;
  search.addEventListener("input", () => state.setQuery(search.value));

  const list = h("div", { class: "flex-1 overflow-y-auto pr-1 space-y-1" });

  function friendRow(f: Friend, active: boolean) {
    const row = h("button", {
      class: "w-full text-left px-3 py-2 rounded-xl transition grid grid-cols-[40px_1fr] gap-3 " + (active ? "bg-emerald-200/50" : "hover:bg-emerald-100/60"),
      attributes: { type: "button" },
    });
    const avatar = Avatar(f.avatar, 40);
    const name = h("div", { class: "font-medium text-emerald-900 truncate", text: f.name });
    const preview = h("div", {
      class: "text-sm text-emerald-700/80 truncate",
      text: f.last?.trim() ? f.last! : "Say hi to…",
    });
    const meta = h("div", { class: "flex items-center gap-2" });
    meta.append(statusDot(f.online), h("span", { class: "text-xs text-emerald-800/70", text: f.online ? "online" : "offline" }));
    const right = h("div", {});
    right.append(name, preview, meta);
    mount(row, avatar, right);
    row.addEventListener("click", () => state.setActive(f.id));
    return row;
  }

  function render() {
    list.replaceChildren();
    const q = state.query.trim().toLowerCase();
    const filtered = q ? friends.filter((f) => f.name.toLowerCase().includes(q)) : friends;

    if (filtered.length === 0) {
      list.appendChild(h("div", { class: "text-emerald-900/60 px-2 py-2", text: "No friends match your search." }));
    } else {
      filtered.forEach((f) => list.appendChild(friendRow(f, state.activeId === f.id)));
    }
  }

  mount(box, header, search, list);
  render();

  return { el: box, render };
}

function TopBarCenter(friend: Friend | null) {
  const bar = h("div", { class: "h-14 px-4 border-b border-slate-100 flex items-center justify-between" });
  const left = h("div", { class: "flex items-center gap-3" });
  if (friend) {
    left.append(Avatar(friend.avatar, 32));
    left.append(h("div", { class: "font-semibold text-slate-800", text: friend.name }));
    left.append(statusDot(friend.online));
  } else {
    left.append(h("div", { class: "text-slate-400", text: "Select a friend" }));
  }
  const search = h("input", {
    class: "ml-auto px-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500",
    attributes: { placeholder: "Search…", type: "search" },
  });
  bar.append(left, search);
  return bar;
}

function MessageList(centerWrap: HTMLElement, friendId: number | null) {
  const scroll = h("div", { class: "flex-1 overflow-y-auto p-4 space-y-2" });

  function render() {
    scroll.replaceChildren();
    if (!friendId) {
      scroll.appendChild(h("div", { class: "text-slate-400 text-center mt-20", text: "Pick a friend on the left to start chatting." }));
      return;
    }
    const msgs = conv[friendId] ?? [];
    if (msgs.length === 0) {
      scroll.appendChild(h("div", { class: "text-slate-400 text-center mt-20", text: "No messages yet. Say hi 👋" }));
      return;
    }
    msgs.forEach((m) => scroll.appendChild(MessageBubble(m, m.authorId === me.id)));
    setTimeout(() => (scroll.scrollTop = scroll.scrollHeight), 0);
  }

  centerWrap.appendChild(scroll);
  return { render, scroll };
}

function Composer(onSend: (text: string) => void) {
  const bar = h("form", { class: "h-14 px-3 border-t border-slate-100 flex items-center gap-2" });
  const input = h("input", {
    class: "flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500",
    attributes: { placeholder: "Type a message…", "aria-label": "Message", autocomplete: "off" },
  }) as HTMLInputElement;
  const send = h("button", {
    class: "w-10 h-10 grid place-items-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition",
    attributes: { type: "submit", title: "Send", "aria-label": "Send" },
  });
  send.append(h("i", { class: "fa-solid fa-paper-plane" }));

  bar.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    onSend(text);
    input.value = "";
  });

  bar.append(input, send);
  return bar;
}

function CenterPanel(state: { activeId: number | null }) {
  const box = h("section", { class: "bg-white flex flex-col" });

  const friend = () => friends.find((f) => f.id === state.activeId) ?? null;
  let top = TopBarCenter(friend());
  const messageArea = h("div", { class: "flex-1 flex flex-col" });
  let list = MessageList(messageArea, state.activeId);
  const composer = Composer((text) => {
    if (!state.activeId) return;
    const arr = conv[state.activeId] || (conv[state.activeId] = []);
    arr.push({ id: Date.now(), authorId: me.id, body: text, at: new Date().toLocaleTimeString().slice(0, 5) });
    list.render();
  });

  mount(box, top, messageArea, composer);
  if (state.activeId) composer.classList.remove("hidden");
  else composer.classList.add("hidden");

  function render() {
    // header
    const freshTop = TopBarCenter(friend());
    box.replaceChild(freshTop, top);
    top = freshTop;

    // messages
    messageArea.replaceChildren();
    list = MessageList(messageArea, state.activeId);
    list.render();

    if (state.activeId) composer.classList.remove("hidden");
    else composer.classList.add("hidden");
  }

  return { el: box, render };
}

function RightPanel(state: { activeId: number | null }) {
  const box = h("aside", { class: "bg-emerald-50 border-l border-emerald-100 p-4 flex flex-col" });

  function action(label: string, icon: string, tone: "green" | "red") {
    const base = "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition";
    const green = "text-emerald-700 hover:bg-emerald-100/60";
    const red = "text-rose-700 hover:bg-rose-100/60";
    const btn = h("button", {
      class: `${base} ${tone === "green" ? green : red}`,
      attributes: { type: "button" },
    });
    btn.append(h("i", { class: `fa-solid ${icon}` }), h("span", { class: "font-medium", text: label }));
    return btn;
  }

  // NEW: vertical actions, low-chrome, bottom anchored
  const actionsCol = h("div", { class: "mt-auto flex flex-col gap-2" });
  actionsCol.append(
    action("Invite to match", "fa-table-tennis-paddle-ball", "green"),
    action("Show profile", "fa-id-card", "green"),
    action("Unfriend", "fa-user-minus", "red"),
    action("Block user", "fa-ban", "red")
  );

  function render() {
    box.replaceChildren();

    const f = friends.find((x) => x.id === state.activeId) ?? null;
    const header = h("div", { class: "flex items-center gap-3" });
    const spacer = h("div", { class: "mt-2" });

    if (f) {
      header.append(Avatar(f.avatar, 40));
      header.append(h("div", { class: "font-semibold text-emerald-900", text: f.name }));
      box.append(header, spacer, actionsCol);
    } else {
      header.append(h("div", { class: "text-emerald-900/60", text: "No friend selected" }));
      box.append(header);
    }
  }

  render();
  return { el: box, render };
}

/* ---------------- Main view ---------------- */
export function ChatsView(root: HTMLElement) {
  const wrap = h("div", {
    class: "h-[calc(80vh-2rem)] m-4 rounded-2xl overflow-hidden " + "grid grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)_280px] border border-emerald-100 shadow bg-white",
  });

  // local UI state
  const state = {
    activeId: null as number | null,
    query: "",
    setActive(id: number) {
      this.activeId = id;
      left.render();
      center.render();
      right.render();
    },
    setQuery(q: string) {
      this.query = q;
      left.render();
    },
  };

  const left = LeftPanel(state);
  const center = CenterPanel(state);
  const right = RightPanel(state);

  mount(wrap, left.el, center.el, right.el);

  root.replaceChildren(wrap);
  return () => {};
}
