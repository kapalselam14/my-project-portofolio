import '../providers/form_data_provider.dart';

/// Validates form data and returns map of field names to error messages
Map<String, String> formValidator(ActivityFormData data) {
  final errors = <String, String>{};

  // Title validation
  if (data.title.trim().isEmpty) {
    errors['title'] = 'Please enter a title';
  }

  // Location validation
  if (data.location.trim().isEmpty) {
    errors['location'] = 'Please enter a location';
  }

  // Date validation
  if (data.selectedDate != null &&
      data.selectedDate!.isBefore(DateTime.now())) {
    errors['selectedDate'] = 'Date must be in the future';
  }

  // Participant count validation
  if (data.maxParticipants < 2) {
    errors['maxParticipants'] = 'Minimum 2 participants required';
  }

  if (data.maxParticipants > 50) {
    errors['maxParticipants'] = 'Maximum 50 participants allowed';
  }

  // Price validation
  if (data.feeType == 1 && (data.price == null || data.price!.trim().isEmpty)) {
    errors['price'] = 'Please enter a price';
  }

  // Split-mode min players validation
  if (data.feeType == 1 && data.priceMode == 1) {
    final min = data.minPlayers;
    if (min != null && (min < 2 || min > data.maxParticipants)) {
      errors['minPlayers'] = 'Min must be 2–${data.maxParticipants}';
    }
  }

  return errors;
}

/// Validates step-specific fields
Map<String, String> validateStep(int step, ActivityFormData data) {
  final allErrors = formValidator(data);
  final stepErrors = <String, String>{};

  switch (step) {
    case 1:
      // Step 1: Cover photo and basic information
      if (data.title.trim().isEmpty) {
        stepErrors['title'] = allErrors['title']!;
      }
      break;
    case 2:
      // Step 2: Date, location, and description
      if (data.location.trim().isEmpty) {
        stepErrors['location'] = allErrors['location']!;
      }
      if (data.selectedDate != null &&
          data.selectedDate!.isBefore(DateTime.now())) {
        stepErrors['selectedDate'] = allErrors['selectedDate']!;
      }
      break;
    case 3:
      // Step 3: Participants and skill level
      if (data.maxParticipants < 2) {
        stepErrors['maxParticipants'] = allErrors['maxParticipants']!;
      }
      if (data.maxParticipants > 50) {
        stepErrors['maxParticipants'] = allErrors['maxParticipants']!;
      }
      break;
    case 4:
      // Step 4: Fee and review No required fields for this step.
      break;
  }

  return stepErrors;
}

/// Validates form field by field
String? validateField(String fieldName, String? value, ActivityFormData data) {
  switch (fieldName) {
    case 'title':
      if (value == null || value.trim().isEmpty) {
        return 'Please enter a title';
      }
      return null;
    case 'location':
      if (value == null || value.trim().isEmpty) {
        return 'Please enter a location';
      }
      return null;
    case 'selectedDate':
      if (value != null) {
        final date = DateTime.parse(value);
        if (date.isBefore(DateTime.now())) {
          return 'Date must be in the future';
        }
      }
      return null;
    case 'maxParticipants':
      if (value != null) {
        final participants = int.tryParse(value);
        if (participants != null) {
          if (participants < 2) {
            return 'Minimum 2 participants required';
          }
          if (participants > 50) {
            return 'Maximum 50 participants allowed';
          }
        }
      }
      return null;
    case 'price':
      if (data.feeType == 1) {
        if (value == null || value.trim().isEmpty) {
          return 'Please enter a price';
        }
        // Validate format
        if (!RegExp(r'^\d+(\.\d{1,2})?$').hasMatch(value)) {
          return 'Please enter a valid price (e.g., 5.00)';
        }
      }
      return null;
    default:
      return null;
  }
}
