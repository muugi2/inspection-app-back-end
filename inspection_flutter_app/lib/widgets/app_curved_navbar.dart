import 'package:flutter/material.dart';
import 'package:curved_navigation_bar/curved_navigation_bar.dart';
import 'package:app/assets/app_colors.dart';

class AppCurvedNavBar extends StatelessWidget {
  const AppCurvedNavBar({
    super.key,
    required this.index,
    required this.onTap,
    this.bottomPadding = 0,
  });

  final int index;
  final ValueChanged<int> onTap;
  final double bottomPadding;

  List<Widget> _defaultItems(BuildContext context) => [
    _NavItem(label: 'Үзлэг', icon: Icons.fact_check, active: index == 0),
    _NavItem(label: 'Засвар', icon: Icons.build, active: index == 1),
    Container(
      width: 62,
      height: 62,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: AppColors.centerGradient,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.2),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
        border: Border.all(color: Colors.white, width: 3),
      ),
      child: Center(
        child: _NavItem(
          label: 'Төлөвлөгөө',
          icon: Icons.dashboard_customize,
          active: index == 2,
        ),
      ),
    ),
    _NavItem(
      label: 'Баталгаажуулалт',
      icon: Icons.verified_user,
      active: index == 3,
    ),
    _NavItem(
      label: 'Суурьлуулалт',
      icon: Icons.install_mobile,
      active: index == 4,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final labels = const [
      'Үзлэг',
      'Засвар',
      'Төлөвлөгөө',
      'Баталгаажуулалт',
      'Суурьлуулалт',
    ];

    return SafeArea(
      minimum: EdgeInsets.only(bottom: bottomPadding),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            labels[index],
            style: const TextStyle(color: Colors.white, fontSize: 11),
          ),
          const SizedBox(height: 6),
          Transform.translate(
            offset: const Offset(0, 6),
            child: CurvedNavigationBar(
              index: index,
              height: 72,
              backgroundColor: Colors.transparent,
              color: AppColors.primary,
              buttonBackgroundColor: Colors.transparent,
              items: _defaultItems(context),
              onTap: onTap,
            ),
          ),
        ],
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.label,
    required this.icon,
    required this.active,
  });

  final String label;
  final IconData icon;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(icon, color: active ? Colors.black : Colors.white),
        const SizedBox(height: 2),
        // Label is rendered under the bar by AppCurvedNavBar
        const SizedBox.shrink(),
      ],
    );
  }
}
