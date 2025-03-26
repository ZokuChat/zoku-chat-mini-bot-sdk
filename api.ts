import zod from 'zod';

export type DesensitizedUser = { username: string, tagline: number, }
export const DesensitizedUserSchema = zod.object({
  username: zod.string().min(3).max(20),
  tagline: zod.number(),
});

export type User = DesensitizedUser & { userid: string };
export const UserSchema = zod.object({
  ...DesensitizedUserSchema.shape,
  userid: zod.string().uuid(),
});

export type DesensitizedMessage = {
  content: string,
  id: string,
  user: DesensitizedUser,
}
export const DesensitizedMessageSchema = zod.object({
  content: zod.string(),
  id: zod.string().ulid(),
  user: DesensitizedUserSchema,
});

export type BroadcastMessage = DesensitizedMessage & {
  timestamp: number,
  processedContent: string,
  self: boolean
};
export const BroadcastMessageSchema = zod.object({
  ...DesensitizedMessageSchema.shape,
  timestamp: zod.number(),
  processedContent: zod.string(),
  self: zod.boolean(),
});

export type GETData = { exists: boolean, messages: BroadcastMessage[] };
export const GETSchema = zod.object({
  exists: zod.boolean(),
  messages: zod.array(BroadcastMessageSchema),
});

export type POSTData = { username: string };
export const POSTSchema = zod.object({
  username: zod.string().min(3).max(20),
});

export type POSTResponse = User
export const POSTResponseSchema = UserSchema

export type ImagePOSTResponseData = { success: boolean, url?: string };
export const ImagePOSTResponseSchema = zod.object({
  success: zod.boolean(),
  url: zod.string().optional(),
});
