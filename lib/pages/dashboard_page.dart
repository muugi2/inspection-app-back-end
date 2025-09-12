import 'package:flutter/material.dart';
import 'package:app/services/api.dart';
import 'package:app/widgets/app_curved_navbar.dart';
import 'package:app/pages/inspection_page.dart';
import 'package:app/pages/repair_page.dart';
import 'package:app/pages/plan_page.dart';
import 'package:app/pages/verify_page.dart';
import 'package:app/pages/install_page.dart';
import 'package:app/pages/auth/login_page.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  int _index = 2;

  final List<Widget> _pages = const [
    InspectionPage(),
    RepairPage(),
    PlanPage(),
    VerifyPage(),
    InstallPage(),
  ];

  // Items provided by AppCurvedNavBar; keep here if you want custom per-page icons.

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: true,
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            onPressed: () async {
              await AuthAPI.logout();
              if (!context.mounted) return;
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const LoginPage()),
                (_) => false,
              );
            },
            icon: const Icon(Icons.logout),
            tooltip: 'Logout',
          ),
        ],
      ),
      body: _pages[_index],
      bottomNavigationBar: AppCurvedNavBar(
        index: _index,
        onTap: (i) => setState(() => _index = i),
        bottomPadding: 0,
      ),
    );
  }
}

// LoginPage is imported from lib/pages/auth/login_page.dart
