import '../domain/chat_message.dart';
import '../domain/chat_poll.dart';
import '../domain/chat_reaction.dart';

abstract class ChatRepository {
  /// One-shot fetch of all messages in [activityId].
  Future<List<ChatMessage>> messages(String activityId);

  /// Real-time stream of messages for [activityId]. Emits the current list whenever it changes.
  Stream<List<ChatMessage>> watchMessages(String activityId);

  Future<ChatMessage> send({required String activityId, required String text});

  /// Sends a photo attachment.
  Future<ChatMessage> sendImage({
    required String activityId,
    required String imagePath,
  });

  /// Shares the sender's current location as a message.
  Future<ChatMessage> sendLocation({
    required String activityId,
    required double latitude,
    required double longitude,
  });

  /// Real-time stream of emoji reactions for [activityId], keyed by message id (`messageId → emoji → uids`).
  Stream<MessageReactions> watchReactions(String activityId);

  /// Toggles the current user's [emoji] reaction on one message.
  Future<bool?> toggleReaction({
    required String activityId,
    required String messageId,
    required String emoji,
  });

  /// Real-time stream of single-choice polls for [activityId], oldest first.
  Stream<List<ChatPoll>> watchPolls(String activityId);

  /// Creates a poll with [question] and 2–6 [options].
  Future<String?> createPoll({
    required String activityId,
    required String question,
    required List<String> options,
  });

  /// Votes for [optionIndex] (single-choice; voting the same option again retracts the vote).
  Future<bool?> votePoll({
    required String activityId,
    required String pollId,
    required int optionIndex,
  });

  Future<List<ChatConversation>> conversations();
}
