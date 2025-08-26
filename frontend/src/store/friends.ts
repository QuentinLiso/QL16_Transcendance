import { Friend } from "./../../backup/friends/friends.types";
// src/store/friends.ts
import { createStore } from "./createStore";
import { FriendsAPI } from "../api/friends";
import type { PublicUser, FriendRequest } from "../api/types";

export type FriendsState = {
  loading: boolean;
  friends: PublicUser[];
  requestsLoading: boolean;
  requests: FriendRequest[];
  error: string | null;
};

export const friends = createStore<FriendsState>({
  loading: false,
  friends: [],
  requestsLoading: false,
  requests: [],
  error: null,
});

export async function loadFriends() {
  friends.set((s) => ({ ...s, loading: true, error: null }));
  try {
    const res = await FriendsAPI.listFriends();
    friends.set((s) => ({ ...s, friends: res.friends, loading: false }));
  } catch (e: any) {
    friends.set((s) => ({ ...s, loading: false, error: e?.message ?? "Failed to load friends" }));
  }
}

export async function loadFriendRequests() {
  friends.set((s) => ({ ...s, requestsLoading: true, error: null }));
  try {
    const res = await FriendsAPI.listFriendRequests();
	friends.set((s) => ({...s, requests : }))
  } catch (e: any) {}
}
