import 'package:flutter/material.dart';
import 'package:app/widgets/assigned_list.dart';

/// Verification page for inspection validation
class VerifyPage extends StatelessWidget {
  const VerifyPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Баталгаажуулалт'), centerTitle: true),
      body: const AssignedList(type: 'verify'),
    );
  }
}
