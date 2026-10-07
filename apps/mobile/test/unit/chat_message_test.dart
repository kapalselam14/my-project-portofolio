import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/features/chat/domain/chat_message.dart';

ChatMessage _msg({String? imagePath, String? imageUrl, String text = 'hi'}) {
  return ChatMessage(
    id: '1',
    senderId: 'u1',
    senderName: 'Alex',
    text: text,
    sentAt: DateTime(2026, 1, 1),
    imagePath: imagePath,
    imageUrl: imageUrl,
  );
}

void main() {
  group('ChatMessage.imageUrlFromText', () {
    test('detects Firebase Storage download URLs (no extension)', () {
      const url =
          'https://firebasestorage.googleapis.com/v0/b/matchup/o/chat%2Fimg.jpg?alt=media&token=abc';
      expect(ChatMessage.imageUrlFromText(url), url);
    });

    test('detects direct image links by extension', () {
      expect(
        ChatMessage.imageUrlFromText('https://example.com/photo.png'),
        'https://example.com/photo.png',
      );
      expect(
        ChatMessage.imageUrlFromText('http://example.com/a/b.JPEG '),
        'http://example.com/a/b.JPEG',
      );
    });

    test('rejects plain text, location shares, and non-image URLs', () {
      expect(ChatMessage.imageUrlFromText('hello'), isNull);
      expect(ChatMessage.imageUrlFromText(''), isNull);
      expect(
        ChatMessage.imageUrlFromText(
          '📍 Shared location: https://maps.google.com/?q=1.0,2.0',
        ),
        isNull,
      );
      expect(
        ChatMessage.imageUrlFromText('https://example.com/page.html'),
        isNull,
      );
      expect(ChatMessage.imageUrlFromText('not a url.jpg x'), isNull);
    });
  });

  group('ChatMessage.isImage', () {
    test('true for local path or remote url, false for plain text', () {
      expect(_msg().isImage, isFalse);
      expect(_msg(imagePath: '/tmp/a.jpg').isImage, isTrue);
      expect(_msg(imageUrl: 'https://example.com/a.jpg').isImage, isTrue);
    });
  });

  group('ChatMessage.previewText', () {
    test('hides raw download URLs from inbox previews', () {
      expect(
        ChatMessage.previewText(
          'https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media',
        ),
        '📷 Photo',
      );
      expect(ChatMessage.previewText('see you!'), 'see you!');
    });
  });
}
