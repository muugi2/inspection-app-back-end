import 'package:flutter/foundation.dart';

/// Centralized application configuration
class AppConfig {
  static const String _defaultApiUrl = 'http://localhost:4555';
  static const String _defaultApiUrlMobile = 'http://192.168.0.7:4555';

  /// Get API base URL based on platform
  static String get apiBaseUrl {
    if (kIsWeb) {
      return _defaultApiUrl;
    }
    return _defaultApiUrlMobile;
  }

  /// API timeout duration
  static const Duration apiTimeout = Duration(seconds: 30);

  /// Enable debug logging
  static const bool enableDebugLogging = kDebugMode;

  /// App version
  static const String appVersion = '1.0.0';

  /// Supported inspection types
  static const List<String> supportedInspectionTypes = [
    'inspection',
    'maintenance',
    'installation',
  ];

  /// Default page size for lists
  static const int defaultPageSize = 20;

  /// Maximum image file size in bytes (5MB)
  static const int maxImageFileSize = 5 * 1024 * 1024;

  /// Supported image formats
  static const List<String> supportedImageFormats = [
    'jpg',
    'jpeg',
    'png',
    'webp',
  ];
}

