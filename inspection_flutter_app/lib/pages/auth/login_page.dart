import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:app/providers/auth_provider.dart';
import 'package:app/pages/dashboard_page.dart';
import 'package:app/assets/app_colors.dart';
import 'package:app/widgets/common/app_components.dart';
import 'package:app/utils/error_handler.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final success = await authProvider.login(
      _emailController.text.trim(),
      _passwordController.text.trim(),
    );

    if (!mounted) return;

    if (success) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const DashboardPage()),
      );
    } else {
      ErrorHandler.showError(context, authProvider.error ?? 'Login failed');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text("Нэвтрэх"),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
      ),
      body: Consumer<AuthProvider>(
        builder: (context, authProvider, child) {
          return Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // App logo
                      Image.asset(
                        'assets/images/auto_scale_logo.jpg',
                        height: 160,
                        fit: BoxFit.contain,
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Тавтай морил',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      AppComponents.textField(
                        controller: _emailController,
                        labelText: "Имэйл",
                        keyboardType: TextInputType.emailAddress,
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Имэйл оруулна уу';
                          }
                          if (!value.contains('@')) {
                            return 'Зөв имэйл оруулна уу';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      AppComponents.textField(
                        controller: _passwordController,
                        labelText: "Нууц үг",
                        obscureText: true,
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Нууц үг оруулна уу';
                          }
                          if (value.length < 6) {
                            return 'Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),
                      AppComponents.primaryButton(
                        text: 'Нэвтрэх',
                        onPressed: authProvider.isLoading
                            ? () {}
                            : () => _login(),
                        isLoading: authProvider.isLoading,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
