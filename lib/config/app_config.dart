import 'package:flutter/foundation.dart';

/// Centralized application configuration
class AppConfig {
  static const String _defaultApiUrl = 'http://localhost:4555';
  static const String _defaultApiUrlMobile = 'http://192.168.0.6:4555';

  /// Get API base URL based on platform
  static String get apiBaseUrl {
    if (kIsWeb) {
      return _defaultApiUrl;
    }
    return _defaultApiUrlMobile;
  }

  /// API timeout duration (increased for network connectivity issues)
  static const Duration apiTimeout = Duration(seconds: 60);

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

  /// FTP configuration
  static const String ftpHost = '192.168.0.6';
  static const int ftpPort = 2121;
  static const String ftpUser = 'test';
  static const String ftpPassword = 'T3st!234';

  /// Remote directory inside FTP server where images are stored.
  /// Keep leading slash for clarity; the upload service will handle fallbacks.
  static const String ftpRemoteDirectory = '/ftp/test';

  /// Public-facing base URL for referencing uploaded images.
  /// If you later expose the FTP directory via HTTP, update this accordingly.
  static const String ftpPublicBaseUrl = 'ftp://192.168.0.6/test';

  /// Timeout for FTP operations (increased for USB/network connections)
  static const Duration ftpTimeout = Duration(seconds: 60);
}
