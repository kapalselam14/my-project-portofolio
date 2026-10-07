import { z } from 'zod';

/** Zod validation for the user-facing appeal endpoint, matching the hand-checks in `submitAppeal`. */
const APPEAL_STATEMENT_MAX = 2000;
export const submitAppealSchema = z.object({
  type: z.enum(
    ['suspension', 'activity_removal', 'account_ban', 'content_removal'],
    'type must be suspension, activity_removal, account_ban, or content_removal',
  ),
  statement: z
    .string()
    .trim()
    .min(1, 'statement is required')
    .max(APPEAL_STATEMENT_MAX, `statement must be at most ${APPEAL_STATEMENT_MAX} characters`),
  relatedId: z.string().trim().min(1).optional(),
});

export type SubmitAppealInput = z.infer<typeof submitAppealSchema>;
