import { z } from 'zod';

/** Pilot per-route zod schema (see `middleware/validate.ts`). */
export const sendMessageSchema = z.object({
  activityId: z.string().trim().min(1, 'activityId is required'),
  text: z
    .string()
    .trim()
    .min(1, 'text is required')
    .max(2000, 'text must be at most 2000 characters'),
  type: z.enum(['text', 'system']).optional().default('text'),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/** Chat media posts. */
export const sendImageMessageSchema = z.object({
  imageUrl: z
    .string()
    .trim()
    .min(1, 'imageUrl is required')
    .max(2000, 'imageUrl must be at most 2000 characters')
    .regex(/^https:\/\/\S+$/i, 'imageUrl must be an https URL'),
});

export type SendImageMessageInput = z.infer<typeof sendImageMessageSchema>;

export const sendLocationMessageSchema = z.object({
  latitude: z
    .number({ error: 'latitude must be a number between -90 and 90' })
    .min(-90, 'latitude must be a number between -90 and 90')
    .max(90, 'latitude must be a number between -90 and 90'),
  longitude: z
    .number({ error: 'longitude must be a number between -180 and 180' })
    .min(-180, 'longitude must be a number between -180 and 180')
    .max(180, 'longitude must be a number between -180 and 180'),
});

export type SendLocationMessageInput = z.infer<typeof sendLocationMessageSchema>;

/** Closed emoji set for message reactions. */
export const reactionEmojis = ['❤️', '😂', '👍', '👏', '🔥', '😮', '😢', '🙏', '🎉', '💯'] as const;

export type ReactionEmoji = (typeof reactionEmojis)[number];

export const toggleReactionSchema = z.object({
  emoji: z.enum(reactionEmojis, 'emoji must be one of the supported reactions'),
});

export type ToggleReactionInput = z.infer<typeof toggleReactionSchema>;

/** Group-chat polls ("Play at 4 or 5?"). */
export const createPollSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, 'question is required')
    .max(200, 'question must be at most 200 characters'),
  options: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'options must not be blank')
        .max(80, 'each option must be at most 80 characters'),
    )
    .min(2, 'at least 2 options are required')
    .max(6, 'at most 6 options are allowed'),
});

export type CreatePollInput = z.infer<typeof createPollSchema>;

export const votePollSchema = z.object({
  optionIndex: z.number().int().min(0, 'optionIndex must be a valid option'),
});

export type VotePollInput = z.infer<typeof votePollSchema>;
