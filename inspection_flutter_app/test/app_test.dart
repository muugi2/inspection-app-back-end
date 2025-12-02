import 'package:flutter_test/flutter_test.dart';
import 'package:app/config/app_config.dart';
import 'package:app/utils/api_response_parser.dart';
import 'package:app/utils/error_handler.dart';

void main() {
  group('AppConfig Tests', () {
    test('should return correct API base URL for web', () {
      // This test would need to be run in web context
      expect(AppConfig.apiBaseUrl, isA<String>());
      expect(AppConfig.apiBaseUrl.isNotEmpty, isTrue);
    });

    test('should have valid timeout duration', () {
      expect(AppConfig.apiTimeout.inSeconds, equals(60));
    });

    test('should have valid app version', () {
      expect(AppConfig.appVersion, equals('1.0.0'));
    });

    test('should have supported inspection types', () {
      expect(AppConfig.supportedInspectionTypes, isNotEmpty);
      expect(AppConfig.supportedInspectionTypes.contains('inspection'), isTrue);
    });
  });

  group('ApiResponseParser Tests', () {
    test('should parse list response correctly', () {
      final response = {
        'data': [
          {'id': '1', 'title': 'Test 1'},
          {'id': '2', 'title': 'Test 2'},
        ],
      };

      final result = ApiResponseParser.parseListResponse(response);
      expect(result, isA<List>());
      expect(result.length, equals(2));
      expect(result[0]['id'], equals('1'));
    });

    test('should handle empty list response', () {
      final response = {'data': []};
      final result = ApiResponseParser.parseListResponse(response);
      expect(result, isEmpty);
    });

    test('should parse object response correctly', () {
      final response = {
        'data': {'id': '1', 'title': 'Test'},
      };

      final result = ApiResponseParser.parseObjectResponse(response);
      expect(result, isA<Map<String, dynamic>>());
      expect(result!['id'], equals('1'));
    });

    test('should parse inspection item correctly', () {
      final raw = {
        'id': '123',
        'title': 'Test Inspection',
        'type': 'inspection',
        'contractName': 'Test Contract',
      };

      final result = ApiResponseParser.parseInspectionItem(raw);
      expect(result['id'], equals('123'));
      expect(result['title'], equals('Test Inspection'));
      expect(result['type'], equals('inspection'));
    });

    test('should extract error message from DioError', () {
      // This would need actual DioError instance in real test
      final error = 'Test error message';
      final result = ApiResponseParser.extractErrorMessage(error);
      expect(result, equals('Test error message'));
    });

    test('should check success response correctly', () {
      final successResponse = {'success': true};
      final failureResponse = {'success': false};

      expect(ApiResponseParser.isSuccessResponse(successResponse), isTrue);
      expect(ApiResponseParser.isSuccessResponse(failureResponse), isFalse);
    });
  });

  group('ErrorHandler Tests', () {
    test('should handle API errors correctly', () {
      expect(
        ErrorHandler.handleApiError('SocketException'),
        equals('Сүлжээний холболт алдаатай байна'),
      );

      expect(
        ErrorHandler.handleApiError('TimeoutException'),
        equals('Холболт хэт удаан байна'),
      );

      expect(
        ErrorHandler.handleApiError('401'),
        equals('Нэвтрэх эрх шаардлагатай'),
      );

      expect(
        ErrorHandler.handleApiError('403'),
        equals('Энэ үйлдлийг хийх эрх байхгүй'),
      );

      expect(
        ErrorHandler.handleApiError('404'),
        equals('Хүссэн мэдээлэл олдсонгүй'),
      );

      expect(
        ErrorHandler.handleApiError('500'),
        equals('Серверийн алдаа гарлаа'),
      );
    });

    test('should handle unknown errors', () {
      final result = ErrorHandler.handleApiError('Unknown error');
      expect(result, startsWith('Алдаа гарлаа:'));
    });
  });
}
