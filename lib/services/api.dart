import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

// Base URL for the API
final String baseUrl = kIsWeb
    ? "http://192.168.0.19:4555/api"
    : "http://192.168.0.19:4555/api";

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
        "/auth/login",
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
      final response = await api.post("/auth/register", data: userData);
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
    final response = await api.get("/auth/verify");
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
    final response = await api.get("/users");
    return response.data;
  }

  static Future<dynamic> getById(String id) async {
    final response = await api.get("/users/$id");
    return response.data;
  }

  static Future<dynamic> getProfile() async {
    final response = await api.get("/users/profile");
    return response.data;
  }

  static Future<dynamic> create(Map<String, dynamic> userData) async {
    final response = await api.post("/users", data: userData);
    return response.data;
  }

  static Future<dynamic> update(
    String id,
    Map<String, dynamic> userData,
  ) async {
    final response = await api.put("/users/$id", data: userData);
    return response.data;
  }

  static Future<dynamic> delete(String id) async {
    final response = await api.delete("/users/$id");
    return response.data;
  }
}

// Inspection API methods
class InspectionAPI {
  static Future<dynamic> getAll() async {
    final response = await api.get("/inspections");
    return response.data;
  }

  static Future<dynamic> getById(String id) async {
    final response = await api.get("/inspections/$id");
    return response.data;
  }

  static Future<dynamic> create(Map<String, dynamic> inspectionData) async {
    final response = await api.post("/inspections", data: inspectionData);
    return response.data;
  }

  static Future<dynamic> update(
    String id,
    Map<String, dynamic> inspectionData,
  ) async {
    final response = await api.put("/inspections/$id", data: inspectionData);
    return response.data;
  }

  static Future<dynamic> delete(String id) async {
    final response = await api.delete("/inspections/$id");
    return response.data;
  }

  static Future<dynamic> getAssigned() async {
    final response = await api.get("/inspections/assigned");
    return response.data;
  }

  static Future<dynamic> getAssignedByType(String type) async {
    final response = await api.get(
      "/inspections/${type.toLowerCase()}/assigned",
    );
    return response.data;
  }
}
