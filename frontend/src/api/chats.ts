// src/api/chats.ts
import { getRequest, postRequest } from "./http";
import type { ChatListItem, Message, PublicUser } from "./types";

export const ChatsAPI = {
  /**
   * GET /api/chats?limit&offset -> { chats, limit, offset }
   */
  listMyChats: (limit = 50, offset = 0) => {
    getRequest<{ chats: ChatListItem[]; limit: Number; offset: number }>("/api/chats", { limit, offset });
  },

  /**
   * GET /api/chats/:chatId/messages?limit&offset -> { chatId, messages, limit, offset }
   */
  getMessages: (chatId: number, limit = 50, offset = 0) => {
    getRequest<{ chatId: Number; messages: Message[]; limit: number; offset: number }>(`/api/chats/${chatId}/messages`, { limit, offset });
  },

  /**
   * POST /api/chats/:chatId/messages (body : {body}) -> Message
   */
  sendMessage: (chatId: number, body: string) => {
    postRequest<Message>(`/api/chats/${chatId}/messages`, { body });
  },

  /**
   * POST /api/chats/with/:userId -> { id, peer }
   */
  ensureChatWithUser: (userId: number) => {
    postRequest<{ id: Number; peer: PublicUser }>(`/api/chats/with/${userId}`);
  },

  /**
   * POST /api/chats/with/:userId/messages (body: { body }) -> Message
   */
  ensureChatAndSend: (userId: number, body: string) => {
    postRequest<Message>(`/api/chats/with/${userId}/messages`, { body });
  },
};
