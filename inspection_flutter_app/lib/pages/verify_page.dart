import 'package:flutter/material.dart';
class VerifyPage extends StatelessWidget {
  const VerifyPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.only(bottom: 100), // Navbar-ийн өргөлтийн хувьд bottom padding
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: const [
              Icon(Icons.verified_user_outlined, size: 64, color: Colors.grey),
              SizedBox(height: 12),
              Text(
                'Баталгаажуулалтын модуль тун удахгүй.',
                style: TextStyle(fontSize: 16, color: Colors.grey),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
