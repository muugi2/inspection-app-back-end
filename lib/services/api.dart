import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

// Base URL for the API
final String baseUrl = kIsWeb
    ? "http://localhost:4555"
    : "http://192.168.0.38:4555";

// Dio instance
final Dio api = Dio(
  BaseOptions(
    baseUrl: baseUrl,
    connectTimeout: const Duration(seconds: 30),
    receiveTimeout: const Duration(seconds: 30),
    headers: {"Content-Type": "application/json"},
  ),
);

// Interceptors
void setupInterceptors() {
  api.interceptors.clear();
  api.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        try {
          final prefs = await SharedPreferences.getInstance();
          final token = prefs.getString('authToken');
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
        } catch (e) {
          debugPrint('Token read error: $e');
        }
        return handler.next(options);
      },
      onError: (DioError e, handler) async {
        if (e.response?.statusCode == 401) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.remove('authToken');
          await prefs.remove('user');
        }
        return handler.next(e);
      },
    ),
  );
  api.interceptors.add(
    LogInterceptor(
      request: true,
      requestBody: true,
      responseBody: true,
      responseHeader: false,
      error: true,
      requestHeader: false,
    ),
  );
}

// Auth API methods
class AuthAPI {
  static Future<Map<String, dynamic>> login(
    String email,
    String password,
  ) async {
    try {
      final response = await api.post(
        "/api/auth/login",
        data: {"email": email, "password": password},
      );
      final data = response.data as Map<String, dynamic>;
      final token = data['data']?['token'] as String?;
      final user = data['data']?['user'];
      final prefs = await SharedPreferences.getInstance();
      if (token != null) {
        await prefs.setString('authToken', token);
      }
      if (user != null) {
        await prefs.setString('user', jsonEncode(user));
      }
      return data;
    } catch (e) {
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> register(
    Map<String, dynamic> userData,
  ) async {
    try {
      final response = await api.post("/api/auth/register", data: userData);
      final data = response.data as Map<String, dynamic>;
      final token = data['data']?['token'] as String?;
      final user = data['data']?['user'];
      final prefs = await SharedPreferences.getInstance();
      if (token != null) {
        await prefs.setString('authToken', token);
      }
      if (user != null) {
        await prefs.setString('user', jsonEncode(user));
      }
      return data;
    } catch (e) {
      rethrow;
    }
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('authToken');
    await prefs.remove('user');
  }

  static Future<Map<String, dynamic>> verify() async {
    final response = await api.get("/api/auth/verify");
    return (response.data as Map<String, dynamic>);
  }

  static Future<Map<String, dynamic>?> getCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userStr = prefs.getString('user');
    if (userStr == null) return null;
    try {
      return jsonDecode(userStr) as Map<String, dynamic>;
    } catch (e) {
      debugPrint('User decode error: $e');
      return null;
    }
  }

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('authToken');
  }
}

// User API methods
class UserAPI {
  static Future<dynamic> getAll() async {
    final response = await api.get("/api/users/");
    return response.data;
  }

  static Future<dynamic> getById(String id) async {
    final response = await api.get("/api/users/$id");
    return response.data;
  }

  static Future<dynamic> getProfile() async {
    final response = await api.get("/api/users/profile");
    return response.data;
  }

  static Future<dynamic> create(Map<String, dynamic> userData) async {
    final response = await api.post("/api/users/", data: userData);
    return response.data;
  }

  static Future<dynamic> update(
    String id,
    Map<String, dynamic> userData,
  ) async {
    final response = await api.put("/api/users/$id", data: userData);
    return response.data;
  }

  static Future<dynamic> delete(String id) async {
    final response = await api.delete("/api/users/$id");
    return response.data;
  }
}

// Inspection API methods
class InspectionAPI {
  static Future<dynamic> getAll() async {
    final response = await api.get("/api/inspections");
    return response.data;
  }

  static Future<dynamic> getById(String id) async {
    final response = await api.get("/api/inspections/$id");
    return response.data;
  }

  static Future<dynamic> create(Map<String, dynamic> inspectionData) async {
    final response = await api.post("/api/inspections", data: inspectionData);
    return response.data;
  }

  static Future<dynamic> update(
    String id,
    Map<String, dynamic> inspectionData,
  ) async {
    final response = await api.put(
      "/api/inspections/$id",
      data: inspectionData,
    );
    return response.data;
  }

  static Future<dynamic> delete(String id) async {
    final response = await api.delete("/api/inspections/$id");
    return response.data;
  }

  static Future<dynamic> getAssigned() async {
    final response = await api.get("/api/inspections/assigned");
    return response.data;
  }

  static Future<dynamic> getAssignedByType(String type) async {
    final response = await api.get(
      "/api/inspections/assigned/type/${type.toLowerCase()}",
    );
    return response.data;
  }

  // Get device information for an inspection
  // static Future<dynamic> getDeviceInfo(String inspectionId) async {
  //   final response = await api.get("/$inspectionId/device-info");
  //   return response.data;
  // }

  // Get device information for an inspection (new endpoint)
  static Future<dynamic> getDeviceDetails(String inspectionId) async {
    try {
      debugPrint('=== API CALL ===');
      debugPrint('Calling: /api/inspections/$inspectionId/devices');
      final response = await api.get("/api/inspections/$inspectionId/devices");
      debugPrint('Response status: ${response.statusCode}');
      debugPrint('Response data: ${response.data}');
      return response.data;
    } catch (e) {
      debugPrint('API Error: $e');
      rethrow;
    }
  }

  // Get inspection template + device information
  static Future<dynamic> getInspectionTemplate(String inspectionId) async {
    try {
      debugPrint('=== API CALL ===');
      debugPrint('Calling: /api/inspections/$inspectionId/template');
      final response = await api.get("/api/inspections/$inspectionId/template");
      debugPrint('Response status: ${response.statusCode}');
      debugPrint('Response data: ${response.data}');
      return response.data;
    } catch (e) {
      debugPrint('API Error: $e');
      rethrow;
    }
  }

  static Future<dynamic> submitAnswers(
    String inspectionId,
    Map<String, dynamic> payload,
  ) async {
    try {
      final response = await api.post(
        "/api/inspections/answers",
        data: payload,
      );
      debugPrint('Final answers submitted successfully: ${response.data}');
      return response.data;
    } catch (e) {
      debugPrint('Error submitting final answers: $e');
      rethrow;
    }
  }

  // Submit individual question answers
  static Future<dynamic> submitQuestionAnswers(
    String inspectionId,
    Map<String, dynamic> payload,
  ) async {
    final response = await api.post(
      "/api/inspections/question-answers",
      data: payload,
    );
    return response.data;
  }

  // Submit section answers
  static Future<dynamic> submitSectionAnswers(
    String inspectionId,
    Map<String, dynamic> payload,
  ) async {
    try {
      debugPrint('=== API SUBMIT SECTION ANSWERS DEBUG ===');
      debugPrint('Inspection ID: $inspectionId');
      debugPrint('Payload Type: ${payload.runtimeType}');
      debugPrint('Payload Content: $payload');
      debugPrint('Payload Keys: ${payload.keys.toList()}');
      debugPrint('========================================');

      final response = await api.post(
        "/api/inspections/section-answers",
        data: payload,
      );
      debugPrint('Section answers submitted successfully: ${response.data}');
      return response.data;
    } catch (e) {
      debugPrint('Error submitting section answers: $e');
      rethrow;
    }
  }

  // Get section answers for an inspection
  static Future<dynamic> getSectionAnswers(String inspectionId) async {
    final response = await api.get(
      "/api/inspections/$inspectionId/section-answers",
    );
    return response.data;
  }

  // Get section status for an inspection
  static Future<dynamic> getSectionStatus(String inspectionId) async {
    final response = await api.get(
      "/api/inspections/$inspectionId/section-status",
    );
    return response.data;
  }

  // Complete a section
  static Future<dynamic> completeSection(
    String inspectionId,
    String section,
  ) async {
    final response = await api.post(
      "/api/inspections/$inspectionId/complete-section",
      data: {"section": section},
    );
    return response.data;
  }

  // Get section questions
  static Future<dynamic> getSectionQuestions(
    String inspectionId,
    String sectionName,
  ) async {
    final response = await api.get(
      "/api/inspections/$inspectionId/section/$sectionName/questions",
    );
    return response.data;
  }

  // Get section review (template + answers)
  static Future<dynamic> getSectionReview(
    String inspectionId,
    String sectionName,
  ) async {
    final response = await api.get(
      "/api/inspections/$inspectionId/section/$sectionName/review",
    );
    return response.data;
  }

  // Confirm section
  static Future<dynamic> confirmSection(
    String inspectionId,
    String sectionName,
  ) async {
    final response = await api.post(
      "/api/inspections/$inspectionId/section/$sectionName/confirm",
    );
    return response.data;
  }

  // Get next section
  static Future<dynamic> getNextSection(
    String inspectionId,
    String currentSection,
  ) async {
    final response = await api.get(
      "/api/inspections/$inspectionId/next-section/$currentSection",
    );
    return response.data;
  }

  // Get section review data (saved answers)
  static Future<dynamic> getSectionReviewData(
    String inspectionId,
    String section,
  ) async {
    final response = await api.get(
      "/api/inspections/$inspectionId/section-review/$section",
    );
    return response.data;
  }
}

// Templates API methods
class TemplateAPI {
  static Future<dynamic> getTemplates({
    required String type,
    bool isActive = true,
  }) async {
    final response = await api.get(
      "/api/templates/type/${type.toLowerCase()}",
      queryParameters: {"isActive": isActive},
    );
    return response.data;
  }

  static Future<dynamic> getTemplatesWithQuery({
    required String type,
    bool isActive = true,
    String? name,
    int? page,
    int? limit,
    String? sortBy,
    String? sortOrder,
  }) async {
    final queryParams = <String, dynamic>{"isActive": isActive};
    if (name != null) queryParams["name"] = name;
    if (page != null) queryParams["page"] = page;
    if (limit != null) queryParams["limit"] = limit;
    if (sortBy != null) queryParams["sortBy"] = sortBy;
    if (sortOrder != null) queryParams["sortOrder"] = sortOrder;

    final response = await api.get(
      "/api/templates/type/${type.toLowerCase()}",
      queryParameters: queryParams,
    );
    return response.data;
  }

  static Future<dynamic> getTemplateById(String id) async {
    final response = await api.get("/api/templates/$id");
    return response.data;
  }

  // Legacy support for backward compatibility
  static Future<dynamic> getTemplatesLegacy({
    required String type,
    bool isActive = true,
  }) async {
    final response = await api.get(
      "/api/templates",
      queryParameters: {"type": type.toUpperCase(), "isActive": isActive},
    );
    return response.data;
  }
}
