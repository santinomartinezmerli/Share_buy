// Days after publishing a purchase before we remind its author to write a review.
// The only place this number lives: NewPost shows it and the Notifications screen asks the
// get_review_reminders() RPC for the posts that reached it.
export const REVIEW_REMINDER_DAYS = 30
