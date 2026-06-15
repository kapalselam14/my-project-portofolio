// backend/src/utils/enrich-notification.js
// Utility to enrich notification objects with type and frontend-friendly fields

export function enrichNotification(n) {
  let type = n.type;
  // Only infer type if not set
  if (!type) {
    if (n.commentId || n.comment_id) {
      if (n.parentCommentId || n.parent_comment_id) {
        type = "comment.reply";
      } else {
        type = "comment.like";
      }
    } else if (n.articleId || n.article_id) {
      type = "article.like";
    } else {
      type = "article.like";
    }
    // Try to infer more specific types based on available fields
    if (n.parent_comment_id) {
      type = "comment.reply";
    } else if (n.comment_id) {
      type = "comment.like";
    } else if (n.article_id && n.actor_id && n.recipient_id) {
      type = "article.like";
    }
    // Try to infer article.comment
    if (
      n.article_id &&
      n.actor_id &&
      n.recipient_id &&
      n.comment_id == null &&
      n.parent_comment_id == null
    ) {
      type = "article.comment";
    }
  }
  return {
    ...n,
    type,
    actorId: n.actor_id,
    actor_username: n.actor_username,
    articleId: n.article_id,
    commentId: n.comment_id,
    parentCommentId: n.parent_comment_id,
    article_title: n.article_title,
    notificationId: n.id,
    created_at: n.created_at
  };
}

export default enrichNotification;
