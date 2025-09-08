import 'package:flutter/material.dart';
import 'package:app/widgets/assigned_list.dart';

class InstallPage extends StatelessWidget {
  const InstallPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const AssignedList(type: 'install');
  }
}
