import 'package:flutter/material.dart';

/// Centralized error handling utilities
class ErrorHandler {
  /// Show error snackbar
  static void showError(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
        duration: const Duration(seconds: 3),
      ),
    );
  }

  /// Show success snackbar
  static void showSuccess(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.green,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  /// Show info snackbar
  static void showInfo(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.blue,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  /// Handle API errors and return user-friendly message
  static String handleApiError(dynamic error) {
    if (error.toString().contains('SocketException')) {
      return 'Сүлжээний холболт алдаатай байна';
    }
    if (error.toString().contains('TimeoutException')) {
      return 'Холболт хэт удаан байна';
    }
    if (error.toString().contains('401')) {
      return 'Нэвтрэх эрх шаардлагатай';
    }
    if (error.toString().contains('403')) {
      return 'Энэ үйлдлийг хийх эрх байхгүй';
    }
    if (error.toString().contains('404')) {
      return 'Хүссэн мэдээлэл олдсонгүй';
    }
    if (error.toString().contains('500')) {
      return 'Серверийн алдаа гарлаа';
    }
    return 'Алдаа гарлаа: ${error.toString()}';
  }

  /// Show loading dialog
  static void showLoading(BuildContext context, {String? message}) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        content: Row(
          children: [
            const CircularProgressIndicator(),
            const SizedBox(width: 16),
            Text(message ?? 'Ачаалж байна...'),
          ],
        ),
      ),
    );
  }

  /// Hide loading dialog
  static void hideLoading(BuildContext context) {
    Navigator.of(context).pop();
  }
}

