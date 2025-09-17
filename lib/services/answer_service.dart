import 'dart:io';
import 'dart:collection';
import 'package:flutter/foundation.dart';
import 'api.dart';

/// Service class for handling inspection answer submissions
class AnswerService {
  /// Prepare section answers from form data
  static Map<String, dynamic> prepareSectionAnswers({
    required Map<String, dynamic> section,
    required String sectionName,
    required String sectionTitle,
    required Map<String, Set<int>> selectedOptionsByField,
    required Map<String, String> fieldTextByKey,
    required Map<String, List<File>> fieldImagesByKey,
    required String Function(int, int) fieldKey,
    required int currentSection,
  }) {
    final fields = (section['fields'] as List<dynamic>);
    final LinkedHashMap<String, dynamic> sectionAnswers =
        LinkedHashMap<String, dynamic>();

    for (int f = 0; f < fields.length; f++) {
      final field = fields[f] as Map<String, dynamic>;
      final String fieldId = (field['id'] ?? '').toString();
      final List<String> opts = (field['options'] as List<dynamic>)
          .map((e) => e.toString())
          .toList();
      final String key = fieldKey(currentSection, f);
      final Set<int> selectedIdx = selectedOptionsByField[key] ?? <int>{};
      final List<String> selectedOptions = selectedIdx
          .map((i) => opts[i])
          .toList();
      final String text = (fieldTextByKey[key] ?? '').trim();

      // Use original fieldId as key
      sectionAnswers[fieldId] = {
        'status': selectedOptions.isNotEmpty ? selectedOptions.first : '',
        'comment': text.isEmpty ? '' : text,
      };

      debugPrint(
        'Field[$f]: $fieldId -> Status: ${selectedOptions.isNotEmpty ? selectedOptions.first : ''}',
      );
    }

    debugPrint('=== PREPARE SECTION ANSWERS DEBUG ===');
    debugPrint('Section Name: $sectionName');
    debugPrint('Section Title: $sectionTitle');
    debugPrint('Answers Type: ${sectionAnswers.runtimeType}');
    debugPrint('Field Order: ${sectionAnswers.keys.toList()}');
    debugPrint('Field Count: ${sectionAnswers.length}');
    debugPrint('Answers Content: $sectionAnswers');
    debugPrint('=====================================');

    return {
      'section': sectionName.isNotEmpty ? sectionName : sectionTitle,
      'sectionTitle': sectionTitle,
      'answers': sectionAnswers,
    };
  }

  /// Save current section answers
  static Future<void> saveCurrentSection({
    required String inspectionId,
    required Map<String, dynamic> section,
    required String sectionName,
    required String sectionTitle,
    required Map<String, Set<int>> selectedOptionsByField,
    required Map<String, String> fieldTextByKey,
    required String Function(int, int) fieldKey,
    required int currentSection,
    required int totalSections,
  }) async {
    try {
      final sectionAnswers = prepareSectionAnswers(
        section: section,
        sectionName: sectionName,
        sectionTitle: sectionTitle,
        selectedOptionsByField: selectedOptionsByField,
        fieldTextByKey: fieldTextByKey,
        fieldImagesByKey: {}, // Empty for now
        fieldKey: fieldKey,
        currentSection: currentSection,
      );

      // Create payload with section name as key containing only current section answers
      final String sectionKey = sectionName.isNotEmpty
          ? sectionName
          : sectionTitle;
      final payload = <String, dynamic>{
        'inspectionId': inspectionId,
        'section': sectionKey,
        'answers': sectionAnswers['answers'], // Зөв формат
        'progress': ((currentSection + 1) / totalSections * 100).round(),
        'sectionStatus': 'IN_PROGRESS',
      };

      debugPrint('=== SECTION SAVE DEBUG ===');
      debugPrint('Section Key: $sectionKey');
      debugPrint(
        'Section Answers Type: ${sectionAnswers['answers'].runtimeType}',
      );
      debugPrint('Section Answers Content: ${sectionAnswers['answers']}');
      debugPrint('Full Payload: $payload');
      debugPrint('Payload Type: ${payload.runtimeType}');
      debugPrint('========================');

      await InspectionAPI.submitSectionAnswers(inspectionId, payload);
      debugPrint('Section saved successfully');
    } catch (e) {
      debugPrint('Error saving section: $e');
      // Don't show error to user, just log it
    }
  }

  /// Submit individual question answers
  static Future<void> submitQuestionAnswers({
    required String inspectionId,
    required Map<String, dynamic> payload,
  }) async {
    try {
      await InspectionAPI.submitQuestionAnswers(inspectionId, payload);
      debugPrint('Question answers submitted successfully');
    } catch (e) {
      debugPrint('Error submitting question answers: $e');
      rethrow;
    }
  }

  /// Get section answers for an inspection
  static Future<dynamic> getSectionAnswers(String inspectionId) async {
    try {
      return await InspectionAPI.getSectionAnswers(inspectionId);
    } catch (e) {
      debugPrint('Error getting section answers: $e');
      rethrow;
    }
  }

  /// Get section status for an inspection
  static Future<dynamic> getSectionStatus(String inspectionId) async {
    try {
      return await InspectionAPI.getSectionStatus(inspectionId);
    } catch (e) {
      debugPrint('Error getting section status: $e');
      rethrow;
    }
  }
}
