import 'package:flutter/material.dart';
import 'package:app/widgets/assigned_list.dart';

class RepairPage extends StatelessWidget {
  const RepairPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const AssignedList(type: 'repair');
  }
}
