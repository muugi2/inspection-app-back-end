import 'package:flutter/material.dart';
import 'package:app/services/api.dart';
import 'package:app/app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  setupInterceptors(); // API interceptor-ийг эхэнд нэг удаа тохируулна
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});
  @override
  Widget build(BuildContext context) => const App();
}

// Splash moved to lib/app.dart (SplashGate)

// LoginPage moved to lib/pages/auth/login_page.dart

// DashboardPage moved to lib/pages/dashboard_page.dart
