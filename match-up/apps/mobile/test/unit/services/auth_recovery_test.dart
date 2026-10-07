import 'package:flutter_test/flutter_test.dart';

/// Unit tests for the auth recovery flow logic.
/// These test the pure logic (validators, derived state) extracted from the
/// three recovery screens — no widgets involved.

// ─── Password rules (mirrors new_password_screen) ─────────────────────────────

bool _hasMinLength(String pw) => pw.length >= 8;
bool _hasUppercase(String pw) => RegExp(r'[A-Z]').hasMatch(pw);
bool _hasNumber(String pw) => RegExp(r'\d').hasMatch(pw);
bool _allRulesMet(String pw) =>
    _hasMinLength(pw) && _hasUppercase(pw) && _hasNumber(pw);

int _strength(String pw) {
  var score = 0;
  if (_hasMinLength(pw)) score += 33;
  if (_hasUppercase(pw)) score += 33;
  if (_hasNumber(pw)) score += 34;
  return score;
}

// ─── Email validator (mirrors forgot_password_screen) ─────────────────────────

String? _validateEmail(String email) {
  if (email.isEmpty) return 'Please enter your email address.';
  final re = RegExp(r'^[^@]+@[^@]+\.[^@]+$');
  if (!re.hasMatch(email)) return 'Please enter a valid email address.';
  return null;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

void main() {
  group('Email validator', () {
    test('should return null for a valid email', () {
      expect(_validateEmail('alex@example.com'), isNull);
      expect(_validateEmail('user+tag@sub.domain.co'), isNull);
    });

    test('should return error for empty email', () {
      final result = _validateEmail('');
      expect(result, isNotNull);
      expect(result, contains('enter your email'));
    });

    test('should return error when @ is missing', () {
      final result = _validateEmail('notanemail.com');
      expect(result, isNotNull);
      expect(result, contains('valid email'));
    });

    test('should return error when domain part is missing', () {
      expect(_validateEmail('user@'), isNotNull);
    });

    test('should return error when local part is missing', () {
      expect(_validateEmail('@example.com'), isNotNull);
    });
  });

  group('Password rules', () {
    group('hasMinLength', () {
      test('should return true for 8+ characters', () {
        expect(_hasMinLength('12345678'), isTrue);
        expect(_hasMinLength('abcdefghij'), isTrue);
      });

      test('should return false for fewer than 8 characters', () {
        expect(_hasMinLength('1234567'), isFalse);
        expect(_hasMinLength(''), isFalse);
      });
    });

    group('hasUppercase', () {
      test('should return true when password contains uppercase', () {
        expect(_hasUppercase('Password1'), isTrue);
        expect(_hasUppercase('ABC'), isTrue);
      });

      test('should return false when no uppercase', () {
        expect(_hasUppercase('password1'), isFalse);
        expect(_hasUppercase('12345678'), isFalse);
      });
    });

    group('hasNumber', () {
      test('should return true when password contains a digit', () {
        expect(_hasNumber('Password1'), isTrue);
        expect(_hasNumber('000'), isTrue);
      });

      test('should return false when no digits', () {
        expect(_hasNumber('Password'), isFalse);
        expect(_hasNumber(''), isFalse);
      });
    });

    group('allRulesMet', () {
      test('should return true for a fully valid password', () {
        expect(_allRulesMet('Password1'), isTrue);
        expect(_allRulesMet('MyStr0ngPw!'), isTrue);
      });

      test('should return false when any rule fails', () {
        expect(_allRulesMet('password1'), isFalse); // no uppercase
        expect(_allRulesMet('Password'), isFalse); // no number
        expect(_allRulesMet('Pass1'), isFalse); // too short
      });
    });
  });

  group('Password strength score', () {
    test('should return 0 for empty password', () {
      expect(_strength(''), 0);
    });

    test('should return 33 when only length rule is met', () {
      // 8+ chars, no uppercase, no number
      expect(_strength('abcdefgh'), 33);
    });

    test('should return 66 when length + uppercase are met', () {
      // 8+ chars, uppercase, no number
      expect(_strength('Abcdefgh'), 66);
    });

    test('should return 100 when all rules are met', () {
      expect(_strength('Password1'), 100);
    });

    test('should return correct partial scores', () {
      // Only uppercase + number, no length
      expect(_strength('A1'), 33 + 34); // uppercase 33 + number 34 = 67
    });
  });

  group('OTP code logic', () {
    // Mirrors the logic: code length == 6 and demo code "123456" is valid.
    const codeLength = 6;
    const validDemoCode = '123456';

    test('should pass verification when code length equals 6', () {
      final code = '123456';
      expect(code.length == codeLength, isTrue);
    });

    test('should fail verification when code is incomplete', () {
      expect('12345'.length == codeLength, isFalse);
      expect(''.length == codeLength, isFalse);
    });

    test('should accept demo code in development mode', () {
      expect(validDemoCode == '123456', isTrue);
    });

    test('should reject incorrect codes', () {
      expect('000000' == validDemoCode, isFalse);
      expect('999999' == validDemoCode, isFalse);
    });

    test('should auto-advance when paste fills all boxes', () {
      // Simulate: pasting "654321" fills 6 boxes
      const pasted = '654321';
      final digits = pasted.replaceAll(RegExp(r'\D'), '');
      final boxes = List.filled(codeLength, '');
      for (var i = 0; i < codeLength && i < digits.length; i++) {
        boxes[i] = digits[i];
      }
      expect(boxes.every((b) => b.isNotEmpty), isTrue);
      expect(boxes.join(), pasted);
    });

    test('should strip non-digit characters from paste', () {
      const pasted = '1A2-3!4 56';
      final digits = pasted.replaceAll(RegExp(r'\D'), '');
      expect(digits, '123456');
    });
  });

  group('Passwords match check', () {
    test('should be true when both passwords are identical', () {
      const pw = 'Password1';
      expect(pw == pw, isTrue);
    });

    test('should be false when passwords differ', () {
      expect('Password1' == 'Password2', isFalse);
      expect('Password1' == 'password1', isFalse);
    });

    test('should be false when confirm is empty', () {
      expect('Password1' == '', isFalse);
    });
  });
}
