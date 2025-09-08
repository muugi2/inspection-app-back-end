import 'package:flutter/material.dart';
import 'package:app/services/api.dart';
import 'package:app/assets/app_colors.dart';

class InspectionRunPage extends StatefulWidget {
  final String inspectionId;
  const InspectionRunPage({super.key, required this.inspectionId});

  @override
  State<InspectionRunPage> createState() => _InspectionRunPageState();
}

class _InspectionRunPageState extends State<InspectionRunPage> {
  bool _loading = true;
  String _error = '';
  Map<String, dynamic>?
  _template; // expecting { name, questions: [{title, fields:[...]}, ...] }

  // Parsed sections from template for rendering by section
  List<Map<String, dynamic>> _sections = const [];

  // Pagination by section (one section per screen)
  int _currentSection = 0;

  // Selections per field (sectionIdx|fieldIdx)
  final Map<String, Set<int>> _selectedOptionsByField = {}; // option indices
  final Map<String, String> _fieldTextByKey = {}; // extra text if required
  final Map<String, bool> _fieldHasImageByKey = {}; // image flag if required

  @override
  void initState() {
    super.initState();
    _loadTemplate();
  }

  Future<void> _loadTemplate() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final dynamic resp = await TemplateAPI.getTemplates(
        type: 'INSPECTION',
        isActive: true,
      );
      // Support both list and object shapes. If list, pick the first active template.
      Map<String, dynamic>? tpl;
      if (resp is Map<String, dynamic>) {
        final dynamic data =
            resp['data'] ?? resp['result'] ?? resp['items'] ?? resp;
        if (data is List && data.isNotEmpty) {
          tpl = (data.first is Map<String, dynamic>)
              ? data.first as Map<String, dynamic>
              : null;
        } else if (data is Map<String, dynamic>) {
          tpl = data;
        }
      } else if (resp is List && resp.isNotEmpty) {
        tpl = (resp.first is Map<String, dynamic>)
            ? resp.first as Map<String, dynamic>
            : null;
      }
      final parsedSections = _extractSections(tpl);
      setState(() {
        _template = tpl;
        _sections = parsedSections;
        _currentSection = 0;
        _selectedOptionsByField.clear();
        _fieldTextByKey.clear();
        _fieldHasImageByKey.clear();
      });
    } catch (e) {
      setState(() {
        _error = 'Template ачаалах үед алдаа гарлаа: $e';
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  List<Map<String, dynamic>> _extractSections(Map<String, dynamic>? tpl) {
    if (tpl == null) return const [];
    final dynamic rawSections = tpl['questions'];
    if (rawSections is! List) return const [];
    return rawSections.map<Map<String, dynamic>>((sec) {
      if (sec is Map<String, dynamic>) {
        final String secTitle = (sec['title'] ?? '').toString();
        final List<dynamic> fields = (sec['fields'] ?? []) as List<dynamic>;
        final List<Map<String, dynamic>>
        normalizedFields = fields.map<Map<String, dynamic>>((f) {
          if (f is Map<String, dynamic>) {
            final String qText = (f['question'] ?? f['title'] ?? '').toString();
            final List<dynamic> optionsDyn =
                (f['options'] ?? []) as List<dynamic>;
            final List<String> options = optionsDyn
                .map((e) => e.toString())
                .toList();
            final bool textRequired = (f['text_required'] ?? false) == true;
            final bool imageRequired = (f['image_required'] ?? false) == true;
            final String fieldId = (f['id'] ?? '').toString();
            return {
              'id': fieldId,
              'question': qText,
              'options': options,
              'text_required': textRequired,
              'image_required': imageRequired,
            };
          }
          return {
            'id': '',
            'question': f.toString(),
            'options': <String>[],
            'text_required': false,
            'image_required': false,
          };
        }).toList();
        return {'title': secTitle, 'fields': normalizedFields};
      }
      return {'title': sec.toString(), 'fields': <Map<String, dynamic>>[]};
    }).toList();
  }

  String _fieldKey(int sIdx, int fIdx) => '$sIdx|$fIdx';

  void _toggleOption(int sIdx, int fIdx, int optIdx, bool value) {
    final key = _fieldKey(sIdx, fIdx);
    final selected = _selectedOptionsByField[key] ?? <int>{};
    if (value) {
      selected.add(optIdx);
    } else {
      selected.remove(optIdx);
    }
    setState(() {
      _selectedOptionsByField[key] = selected;
    });
  }

  void _setFieldText(int sIdx, int fIdx, String text) {
    setState(() {
      _fieldTextByKey[_fieldKey(sIdx, fIdx)] = text;
    });
  }

  void _toggleFieldImage(int sIdx, int fIdx) {
    final key = _fieldKey(sIdx, fIdx);
    setState(() {
      _fieldHasImageByKey[key] = !(_fieldHasImageByKey[key] ?? false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Үзлэг эхлүүлэх')),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error.isNotEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              _error,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.redAccent),
            ),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: _loadTemplate,
              child: const Text('Дахин ачаалах'),
            ),
          ],
        ),
      );
    }
    if (_template == null || _sections.isEmpty) {
      return const Center(child: Text('Идэвхтэй INSPECTION загвар олдсонгүй.'));
    }

    final String name = (_template!['name'] ?? 'INSPECTION').toString();
    final Map<String, dynamic> section = _sections[_currentSection];
    final String sectionTitle = (section['title'] ?? '').toString();
    final List<dynamic> fields = (section['fields'] as List<dynamic>);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Text(
            name,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
          ),
        ),
        if (sectionTitle.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Text(
              sectionTitle,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
          ),
        const Divider(height: 1),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(16.0),
            itemCount: fields.length,
            itemBuilder: (context, fIdx) {
              final Map<String, dynamic> field =
                  fields[fIdx] as Map<String, dynamic>;
              final String qText = (field['question'] ?? '').toString();
              final List<dynamic> options = (field['options'] as List<dynamic>);
              final bool textRequired = field['text_required'] == true;
              final bool imageRequired = field['image_required'] == true;
              final String fKey = _fieldKey(_currentSection, fIdx);
              final Set<int> selected =
                  _selectedOptionsByField[fKey] ?? <int>{};
              final String textValue = _fieldTextByKey[fKey] ?? '';
              final bool hasImage = _fieldHasImageByKey[fKey] ?? false;
              return Padding(
                padding: const EdgeInsets.only(bottom: 12.0),
                child: Card(
                  color: AppColors.surface,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(12.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          qText,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 8),
                        for (int oIdx = 0; oIdx < options.length; oIdx++)
                          CheckboxListTile(
                            value: selected.contains(oIdx),
                            onChanged: (v) => _toggleOption(
                              _currentSection,
                              fIdx,
                              oIdx,
                              v ?? false,
                            ),
                            title: Text(options[oIdx].toString()),
                            contentPadding: EdgeInsets.zero,
                            controlAffinity: ListTileControlAffinity.leading,
                          ),
                        if (textRequired)
                          Padding(
                            padding: const EdgeInsets.only(top: 8.0),
                            child: TextField(
                              decoration: const InputDecoration(
                                labelText: 'Тайлбар',
                                border: OutlineInputBorder(),
                              ),
                              onChanged: (v) =>
                                  _setFieldText(_currentSection, fIdx, v),
                              controller: TextEditingController.fromValue(
                                TextEditingValue(
                                  text: textValue,
                                  selection: TextSelection.collapsed(
                                    offset: textValue.length,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        if (imageRequired)
                          Padding(
                            padding: const EdgeInsets.only(top: 8.0),
                            child: OutlinedButton.icon(
                              onPressed: () =>
                                  _toggleFieldImage(_currentSection, fIdx),
                              icon: const Icon(Icons.image_outlined),
                              label: Text(
                                hasImage ? 'Зураг нэмэгдсэн' : 'Зураг оруулах',
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 46),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _currentSection == 0
                      ? null
                      : () => setState(() => _currentSection -= 1),
                  child: const Text('Өмнөх'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: _currentSection >= (_totalSections - 1)
                      ? _onFinish
                      : () => setState(() => _currentSection += 1),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.black,
                  ),
                  child: Text(
                    _currentSection >= (_totalSections - 1)
                        ? 'Дуусгах'
                        : 'Дараах',
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  int get _totalSections => _sections.length;

  void _onFinish() {
    // For now, just show a confirmation. Submission wiring can be added later.
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Асуултууд дууслаа')));
  }
}
