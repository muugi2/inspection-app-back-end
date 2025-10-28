import 'dart:collection';
import 'package:flutter/foundation.dart';
import 'api.dart';

/// Service for handling inspection answer submissions
class AnswerService {
  /// Prepare section answers from form data
  static Map<String, dynamic> prepareSectionAnswers({
    required Map<String, dynamic> section,
    required String sectionName,
    required String sectionTitle,
    required Map<String, Set<int>> selectedOptionsByField,
    required Map<String, String> fieldTextByKey,
    required String Function(int, int) fieldKey,
    required int currentSection,
  }) {
    final fields = section['fields'] as List<dynamic>;
    final sectionAnswers = LinkedHashMap<String, dynamic>();

    for (int f = 0; f < fields.length; f++) {
      final field = fields[f] as Map<String, dynamic>;
      final fieldId = (field['id'] ?? '').toString();
      final options = (field['options'] as List<dynamic>)
          .map((e) => e.toString())
          .toList();
      final key = fieldKey(currentSection, f);
      final selectedIdx = selectedOptionsByField[key] ?? <int>{};
      final selectedOptions = selectedIdx.map((i) => options[i]).toList();
      final text = (fieldTextByKey[key] ?? '').trim();

      final questionText = (field['question'] ?? '').toString();
      debugPrint(
        'Field $fieldId: question="$questionText", status="${selectedOptions.isNotEmpty ? selectedOptions.first : ''}", comment="$text"',
      );

      sectionAnswers[fieldId] = {
        'question': questionText,
        'status': selectedOptions.isNotEmpty ? selectedOptions.first : '',
        'comment': text.isEmpty ? '' : text,
      };
    }

    return {
      'section': sectionName.isNotEmpty ? sectionName : sectionTitle,
      'sectionTitle': sectionTitle,
      'answers': sectionAnswers,
    };
  }

  /// Prepare remarks as field-structured data
  static Map<String, dynamic> prepareRemarksField({
    required String remarksText,
  }) {
    return {
      'section': 'remarks',
      'sectionTitle': 'Дүгнэлт',
      'answers': {
        'remarks_field': {
          'status': '', // ← Зөв
          'comment': remarksText.trim(),
        },
      },
    };
  }

  /// Save current section answers with meta information
  static Future<dynamic> saveCurrentSection({
    required String inspectionId,
    required Map<String, dynamic> section,
    required String sectionName,
    required String sectionTitle,
    required Map<String, Set<int>> selectedOptionsByField,
    required Map<String, String> fieldTextByKey,
    required String Function(int, int) fieldKey,
    required int currentSection,
    required int totalSections,
    String? answerId,
    Map<String, dynamic>? deviceInfo,
  }) async {
    try {
      final sectionAnswers = prepareSectionAnswers(
        section: section,
        sectionName: sectionName,
        sectionTitle: sectionTitle,
        selectedOptionsByField: selectedOptionsByField,
        fieldTextByKey: fieldTextByKey,
        fieldKey: fieldKey,
        currentSection: currentSection,
      );

      final sectionKey = sectionName.isNotEmpty ? sectionName : sectionTitle;
      final answersPayload = await _buildAnswersPayload(
        sectionAnswers['answers'],
        currentSection,
        deviceInfo,
      );

      final payload = {
        'inspectionId': inspectionId,
        'section': sectionKey,
        'answers': answersPayload,
        'progress': _calculateProgress(currentSection, totalSections),
        'sectionStatus': 'IN_PROGRESS',
        'sectionIndex': currentSection,
        'isFirstSection': currentSection == 0,
      };

      if (answerId?.isNotEmpty == true) payload['answerId'] = answerId!;

      return await InspectionAPI.submitSectionAnswers(inspectionId, payload);
    } catch (e) {
      // Log error silently
    }
  }

  /// Build answers payload with meta information for first section
  static Future<Map<String, dynamic>> _buildAnswersPayload(
    Map<String, dynamic> sectionAnswers,
    int currentSection,
    Map<String, dynamic>? deviceInfo,
  ) async {
    if (currentSection != 0) return sectionAnswers;

    final deviceData = _extractDeviceData(deviceInfo);
    final metaInfo = {
      'date': _getCurrentDate(),
      'inspector': await _getUser(),
      'location': _buildLocation(
        deviceData['organization'],
        deviceData['site'],
      ),
      'scale_id_serial_no': _buildSerialNumber(
        deviceData['serial'],
        deviceData['assetTag'],
      ),
      'model': deviceData['model'] ?? '',
    };

    return {...sectionAnswers, ...metaInfo};
  }

  /// Extract device information from deviceInfo map
  static Map<String, String?> _extractDeviceData(
    Map<String, dynamic>? deviceInfo,
  ) {
    if (deviceInfo == null) return {};

    String? serial = deviceInfo['serialNumber']?.toString();
    String? assetTag = deviceInfo['assetTag']?.toString();
    String? model, organization, site;

    if (deviceInfo['model'] is Map<String, dynamic>) {
      model = (deviceInfo['model'] as Map<String, dynamic>)['model']
          ?.toString();
    }

    if (deviceInfo['organization'] is Map<String, dynamic>) {
      organization =
          (deviceInfo['organization'] as Map<String, dynamic>)['name']
              ?.toString();
    }

    if (deviceInfo['site'] is Map<String, dynamic>) {
      site = (deviceInfo['site'] as Map<String, dynamic>)['name']?.toString();
    }

    return {
      'serial': serial,
      'assetTag': assetTag,
      'model': model,
      'organization': organization,
      'site': site,
    };
  }

  /// Get current date in YYYY-MM-DD format
  static String _getCurrentDate() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  /// Build location string from organization and site
  static String _buildLocation(String? organization, String? site) {
    return [organization, site].where((s) => s?.isNotEmpty == true).join(' • ');
  }

  /// Build serial number string from serial and asset tag
  static String _buildSerialNumber(String? serial, String? assetTag) {
    return [serial, assetTag].where((s) => s?.isNotEmpty == true).join(' / ');
  }

  /// Calculate progress percentage
  static int _calculateProgress(int currentSection, int totalSections) {
    return totalSections == 0
        ? 0
        : ((currentSection + 1) / totalSections * 100).round();
  }

  static Future<String> _getUser() async {
    try {
      debugPrint('=== GETTING USER INFO ===');

      // AuthAPI.getCurrentUser() ашиглан хэрэглэгчийн мэдээлэл авах
      final userData = await AuthAPI.getCurrentUser();
      debugPrint('User data from AuthAPI: $userData');

      if (userData != null) {
        debugPrint('User data keys: ${userData.keys.toList()}');

        // fullName (camelCase) талбарыг шалгах
        String? fullName = userData['fullName']?.toString();
        debugPrint('fullName (camelCase) found: $fullName');

        // Хэрэв fullName байхгүй бол full_name (snake_case) шалгах
        if (fullName == null || fullName.isEmpty) {
          fullName = userData['full_name']?.toString();
          debugPrint('full_name (snake_case) found: $fullName');
        }

        if (fullName != null && fullName.isNotEmpty) {
          debugPrint('✅ Returning fullName: $fullName');
          return fullName;
        } else {
          debugPrint('❌ Both fullName and full_name are null or empty');
        }
      } else {
        debugPrint('❌ User data is null');
      }

      // Бүгд байхгүй бол default утга
      debugPrint('⚠️ Returning default: Current User');
      return 'Current User';
    } catch (e) {
      debugPrint('❌ Error getting user info: $e');
      return 'Current User';
    }
  }

  /// Save remarks as field-structured section
  static Future<dynamic> saveRemarksField({
    required String inspectionId,
    required String remarksText,
    String? answerId,
  }) async {
    try {
      final remarksData = prepareRemarksField(remarksText: remarksText);

      final payload = {
        'inspectionId': inspectionId,
        'section': 'remarks',
        'answers': remarksData['answers'],
        'progress': 100,
        'sectionStatus': 'COMPLETED',
        'sectionIndex': 0, // ← Зөв
        'isFirstSection': false,
      };

      if (answerId?.isNotEmpty == true) payload['answerId'] = answerId!;

      return await InspectionAPI.submitSectionAnswers(inspectionId, payload);
    } catch (e) {
      debugPrint('❌ Error saving remarks field: $e');
      rethrow;
    }
  }
}
