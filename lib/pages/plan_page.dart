import 'package:flutter/material.dart';
import 'package:app/assets/app_colors.dart';

class PlanPage extends StatefulWidget {
  const PlanPage({super.key});

  @override
  State<PlanPage> createState() => _PlanPageState();
}

class _PlanPageState extends State<PlanPage> {
  DateTime _selected = DateTime.now();

  @override
  Widget build(BuildContext context) {
    final DateTime first = DateTime(DateTime.now().year - 2);
    final DateTime last = DateTime(DateTime.now().year + 2, 12, 31);

    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            color: AppColors.surface,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            child: Padding(
              padding: const EdgeInsets.all(8.0),
              child: CalendarDatePicker(
                initialDate: _selected,
                firstDate: first,
                lastDate: last,
                onDateChanged: (d) => setState(() => _selected = d),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Сонгосон огноо: ${_selected.year}-${_selected.month.toString().padLeft(2, '0')}-${_selected.day.toString().padLeft(2, '0')}',
            style: const TextStyle(fontWeight: FontWeight.w600),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
