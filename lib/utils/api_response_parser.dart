/// Utility class for parsing API responses consistently
class ApiResponseParser {
  /// Parse API response to extract data list
  static List<dynamic> parseListResponse(dynamic response) {
    if (response is Map<String, dynamic>) {
      final data =
          response['data'] ??
          response['items'] ??
          response['result'] ??
          response['users'] ??
          response['rows'];
      return data is List ? data : [];
    }
    return response is List ? response : [];
  }

  /// Parse API response to extract single data object
  static Map<String, dynamic>? parseObjectResponse(dynamic response) {
    if (response is Map<String, dynamic>) {
      return response['data'] ?? response;
    }
    return null;
  }

  /// Parse inspection item from raw API data
  static Map<String, dynamic> parseInspectionItem(dynamic raw) {
    if (raw is! Map<String, dynamic>) {
      return {
        'id': raw.toString(),
        'title': 'ID: ${raw.toString()}',
        'type': 'inspection',
      };
    }

    final dynamic idRaw =
        raw['id'] ?? raw['_id'] ?? raw['inspectionId'] ?? raw['taskId'];
    final String id = idRaw?.toString() ?? '';

    final String title =
        (raw['title'] ?? raw['name'] ?? raw['inspectionTitle'] ?? 'ID: $id')
            .toString();

    final String? contractName =
        (raw['contractName'] ??
                raw['contract_name'] ??
                (raw['contract'] is Map ? raw['contract']['name'] : null))
            ?.toString();

    final String type = (raw['type'] ?? raw['inspectionType'] ?? 'inspection')
        .toString();

    return {
      'id': id,
      'title': title,
      'type': type,
      'contractName': contractName,
    };
  }

  /// Extract error message from API response
  static String extractErrorMessage(dynamic error) {
    // Handle DioException (Dio 5.0+) or DioError (Dio 4.x)
    if (error.toString().contains('DioException') || 
        error.toString().contains('DioError')) {
      return 'Network error occurred';
    }

    if (error is Map<String, dynamic>) {
      return error['message'] ?? error['error'] ?? error.toString();
    }

    return error.toString();
  }

  /// Check if response indicates success
  static bool isSuccessResponse(dynamic response) {
    if (response is Map<String, dynamic>) {
      return response['success'] == true ||
          response['status'] == 'success' ||
          response['statusCode'] == 200;
    }
    return true; // Assume success if not a map
  }
}
