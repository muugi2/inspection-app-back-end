import 'package:flutter/material.dart';
import 'package:app/widgets/assigned_list.dart';

class InspectionPage extends StatelessWidget {
  const InspectionPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const AssignedList(type: 'inspection');
  }
}
