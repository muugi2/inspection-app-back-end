import 'dart:collection';
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
    required String Function(int, int) fieldKey,
    required int currentSection,
  }) {
    final fields = section['fields'] as List<dynamic>;
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

      sectionAnswers[fieldId] = {
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

  /// Save current section answers
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

      final String sectionKey = sectionName.isNotEmpty
          ? sectionName
          : sectionTitle;
      final now = DateTime.now();
      final dateStr =
          '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';

      // Extract device info
      String? serialNumber, assetTag, model, organizationName, siteName;
      if (deviceInfo != null) {
        serialNumber = deviceInfo['serialNumber']?.toString();
        assetTag = deviceInfo['assetTag']?.toString();
        if (deviceInfo['model'] is Map<String, dynamic>) {
          model = (deviceInfo['model'] as Map<String, dynamic>)['model']
              ?.toString();
        }
        if (deviceInfo['organization'] is Map<String, dynamic>) {
          organizationName =
              (deviceInfo['organization'] as Map<String, dynamic>)['name']
                  ?.toString();
        }
        if (deviceInfo['site'] is Map<String, dynamic>) {
          siteName = (deviceInfo['site'] as Map<String, dynamic>)['name']
              ?.toString();
        }
      }

      // Build strings
      final location = [
        organizationName,
        siteName,
      ].where((s) => s?.isNotEmpty == true).join(' • ');
      final scaleIdSerialNo = [
        serialNumber,
        assetTag,
      ].where((s) => s?.isNotEmpty == true).join(' / ');

      // Create payload
      Map<String, dynamic> answersPayload;
      if (currentSection == 0) {
        answersPayload = Map<String, dynamic>.from(sectionAnswers['answers']);
        answersPayload.addAll({
          'date': dateStr,
          'inspector': 'Current User',
          'location': location,
          'scale_id_serial_no': scaleIdSerialNo,
          'model': model ?? '',
        });
      } else {
        answersPayload = sectionAnswers['answers'];
      }

      final payload = <String, dynamic>{
        'inspectionId': inspectionId,
        'section': sectionKey,
        'answers': answersPayload,
        'progress': _calculateProgress(currentSection, totalSections),
        'sectionStatus': 'IN_PROGRESS',
        'sectionIndex': currentSection,
        'isFirstSection': currentSection == 0,
      };

      if (answerId?.isNotEmpty == true) payload['answerId'] = answerId;

      return await InspectionAPI.submitSectionAnswers(inspectionId, payload);
    } catch (e) {
      // Log error silently
    }
  }

  /// Calculate progress percentage
  static int _calculateProgress(int currentSection, int totalSections) =>
      totalSections == 0
      ? 0
      : ((currentSection + 1) / totalSections * 100).round();
}
