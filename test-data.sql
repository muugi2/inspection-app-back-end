-- 1. Insert Roles (no dependencies)
INSERT INTO roles (id, name) VALUES
(1, 'admin'),
(2, 'inspector');

-- 2. Insert System Config (no dependencies)
INSERT INTO system_config (id, `key`, value, description, category, is_active, created_at, updated_at) VALUES
(1, 'app_name', 'inspection_management_system', 'Application name', 'general', 1, NOW(), NOW()),
(2, 'max_file_size', '10485760', 'Maximum file upload size in bytes (10MB)', 'upload', 1, NOW(), NOW()),
(3, 'allowed_file_types', 'jpg,jpeg,png,pdf,doc,docx', 'Allowed file extensions for uploads', 'upload', 1, NOW(), NOW()),
(4, 'inspection_reminder_days', '7', 'Days before inspection due date to send reminder', 'inspection', 1, NOW(), NOW()),
(5, 'auto_assign_inspections', 'false', 'Automatically assign inspections to available inspectors', 'inspection', 1, NOW(), NOW());

-- 3. Insert Device Models (no dependencies)
INSERT INTO device_models (id, manufacturer, model, specs, created_at, updated_at) VALUES
(1, 'Puu', 'Puu-1200', '{"max_weight": "150000kg", "min_weight": "100kg", "precision": "50kg", "platform_size": "1000mm x 1000mm", "platform_count": 5}', NOW(), NOW()),
(2, 'Puu', 'Puu-1201', '{"max_weight": "100000kg", "min_weight": "100kg", "precision": "50kg", "platform_size": "1000mm x 1000mm", "platform_count": 5}', NOW(), NOW()),
(3, 'Puu', 'Puu-1202', '{"max_weight": "200000kg", "min_weight": "100kg", "precision": "50kg", "platform_size": "1000mm x 1000mm", "platform_count": 5}', NOW(), NOW()),
(4, 'Puu', 'Puu-1203', '{"max_weight": "250000kg", "min_weight": "100kg", "precision": "50kg", "platform_size": "1000mm x 1000mm", "platform_count": 5}', NOW(), NOW());


-- 4. Insert Organizations (no dependencies)
INSERT INTO organizations (id, name, code, created_at, updated_at) VALUES
(1, 'Energy Resourse.', 'ER', NOW(), NOW()),
(2, 'Tavan Tolgoi', 'TT', NOW(), NOW()),
(3, 'Oy Tolgoi', 'OT', NOW(), NOW()),
(4, 'Measurement', 'MMNT', NOW(), NOW());

-- 5. Insert Users (depends on organizations and roles)
INSERT INTO users (id, org_id, role_id, email, password_hash, full_name, phone, is_active, created_at, updated_at) VALUES
(1, 4, 1, 'admin@mmnt.mn', '$2b$10$K8JVH1zK8JVH1zK8JVH1zK8JVH1zK8JVH1zK8JVH1zK8JVH1zK8JVH1z', 'john_smith', '+1-555-0101', 1, NOW(), NOW()),
(2, 2, 2, 'inspector1@mmnt.mn', '$2a$12$4HnB5ML219t6v3U287P4qetrAlWR2RPUKm.2Pp13zLEVa27nhAp7m', 'bachka', '+1-555-0103', 1, NOW(), NOW()),
(3, 2, 2, 'inspector2@mmnt.mn', '$2b$10$N1MYK4cN1MYK4cN1MYK4cN1MYK4cN1MYK4cN1MYK4cN1MYK4cN1MYK4c', 'batka', '+1-555-0104', 1, NOW(), NOW()),
(4, 2, 2, 'inspector3@mmnt.mn', '$2b$10$N1MYK4cN1MYK4cN1MYK4cN1MYK4cN1MYK4cN1MYK4cN1MYK4cN1MYK4c', 'ideree', '+1-555-0104', 1, NOW(), NOW());



-- 6. Insert Sites (depends on organizations)
INSERT INTO sites (id, org_id, name, created_at, updated_at) VALUES
(1, 1, 'Ухаа худаг', NOW(), NOW()),
(2, 1, 'Цагаан хад', NOW(), NOW()),
(3, 1, 'Баруун наран', NOW(), NOW()),
(4, 2, 'урд', NOW(), NOW()),
(5, 2, 'Хойд', NOW(), NOW()),
(6, 3, 'Урд', NOW(), NOW()),
(7, 3, 'Хойд', NOW(), NOW());

-- 7. Insert Contracts (depends on organizations)
INSERT INTO contracts (id, org_id, contract_name, contract_number, start_date, end_date, metadata, created_at, updated_at) VALUES
(1, 1, 'Ухаа худаг Пүү сервис', 'MAINT-2024-001', '2024-01-01', '2024-12-31', '{"coverage": "24/7", "included_parts": true}', NOW(), NOW()),
(2, 1, 'Баруун наран сервис', 'SAFE-2024-002', '2024-01-01', '2024-12-31', '{"coverage": "24/7", "included_parts": false}', NOW(), NOW()),
(3, 1, 'Цагаан хад сервис', 'MOD-2024-003', '2024-03-01', '2024-11-30', '{"coverage": "24/7", "included_parts": true}', NOW(), NOW()),
(4, 2, 'Таван толгой Пүү сервис', 'PREV-2022-001', '2024-02-01', '2025-01-31', '{"coverage": "24/7", "included_parts": true}', NOW(), NOW()),
(5, 2, 'Таван толгой Пүү сервис', 'PREV-2023-001', '2024-02-01', '2025-01-31', '{"coverage": "24/7", "included_parts": false}', NOW(), NOW()),
(6, 3, 'Оюу толгой Пүү сервис', 'PREV-2025-001', '2024-02-01', '2025-01-31', '{"coverage": "24/7", "included_parts": false}', NOW(), NOW()),
(7, 3, 'Оюу толгой Пүү сервис', 'PREV-2026-001', '2024-02-01', '2025-01-31', '{"coverage": "24/7", "included_parts": false}', NOW(), NOW());

-- 8. Insert Inspection Templates (no dependencies - standardized across all organizations)
INSERT INTO inspection_templates (id, name, type, description, questions, is_active, created_at, updated_at) VALUES

(1, 'weighing_scale_inspection', 'inspection', 'Comprehensive weighing scale inspection checklist',
'[
  {"section": "exterior", "title": "Exterior Inspection", "fields": [
    {"id": "sensor_base_status", "question": "Мэдрэгчийн суурь", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": true, "image_required": true},
    {"id": "beam_status", "question": "Дам нуруу", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "platform_plate_status", "question": "Тавцангийн лист", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "beam_joint_plate_status", "question": "Дам нуруу холбосон лист", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "stop_bolt_status", "question": "Хязгаарлагчийн боолт", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "interplatform_bolts_status", "question": "Тавцан хоорондын боолт", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false}
  ]},
  {"section": "indicator", "title": "Indicator Inspection", "fields": [
    {"id": "led_display_status", "question": "Лед дэлгэц", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "power_plug_status", "question": "Тэжээлийн залгуур", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "seal_bolt_status", "question": "Лац болон лацны боолт", "type": "select", "options": ["Бүтэн", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "buttons_status", "question": "Товчлуур", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "junction_wiring_status", "question": "Холбогч хайрцаг болон сигналын утас", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "serial_converter_status", "question": "Сериал хөрвүүлэгч залгуур", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false}
  ]},
  {"section": "jbox", "title": "Junction Box Inspection", "fields": [
    {"id": "box_integrity_status", "question": "Хайрцагны бүрэн бүтэн байдал", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "collector_board_status", "question": "Сигналын утас цуглуулагч хавтан", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "wire_tightener_status", "question": "Сигналын утас чангалагч", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "resistor_element_status", "question": "Эсэргүүцлийн элемент", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "protective_box_status", "question": "Холбогч хайрцагны хамгаалалтын хайрцаг", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false}
  ]},
  {"section": "sensor", "title": "Sensor Inspection", "fields": [
    {"id": "signal_wire_status", "question": "Сигналын утас", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "ball_status", "question": "Шаариг", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "base_status", "question": "Мэдрэгчийн суурь", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "ball_cup_thin_status", "question": "Шааригны аяган суурь /нимгэн/", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "plate_status", "question": "Ялтсан хавтан", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false}
  ]},
  {"section": "foundation", "title": "Foundation Inspection", "fields": [
    {"id": "cross_base_status", "question": "Хөндлөн суурь", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "anchor_plate_status", "question": "Суурийн анкщр лист", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "ramp_angle_status", "question": "Пандусын угольник", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "ramp_stopper_status", "question": "Пандусын өшиглүүр", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "ramp_status", "question": "Пандус", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "slab_base_status", "question": "Нил суурь", "type": "select", "options": ["Зүгээр", "Сайжруулах шаардлагатай", "Солих шаардлагатай"], "text_required": false, "image_required": false}
  ]},
  {"section": "cleanliness", "title": "Cleanliness Inspection", "fields": [
    {"id": "under_platform_status", "question": "Тавцангийн доод тал", "type": "select", "options": ["Цэвэр", "Цэвэрлэх шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "top_platform_status", "question": "Тавцангийн дээд тал", "type": "select", "options": ["Цэвэр", "Цэвэрлэх шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "gap_platform_ramp_status", "question": "Автожингийн тавцан болон Пандус хоорондын завсар", "type": "select", "options": ["Саадгүй", "Цэвэрлэх шаардлагатай"], "text_required": false, "image_required": false},
    {"id": "both_sides_area_status", "question": "Автожингийн 2 талын талбай", "type": "select", "options": ["Саадгүй", "Цэвэрлэх шаардлагатай"], "text_required": false, "image_required": false}
  ]}
]', 1, NOW(), NOW());

-- 9. Insert Devices (depends on organizations, sites, contracts, device_models)
INSERT INTO devices (id, org_id, site_id, contract_id, model_id, serial_number, asset_tag, status, installed_at, metadata, created_at, updated_at) VALUES
(1, 1, 1, 1, 1, '12345678', 'Хөрөнгө 1', 'normal', '2024-01-15 10:00:00', '{"location": "con",trol_panel_a "firmware": "v4.2.1"}', NOW(), NOW()),
(2, 1, 2, 2, 2, '12345679', 'хөрөнгө 2', 'normal', '2024-01-20 14:30:00', '{"location": "control_panel_b", "firmware": "v21.01"}', NOW(), NOW()),
(3, 1, 3, 3, 3, '12345680', 'Хөрөнгө 3', 'normal', '2024-02-01 09:15:00', '{"location": "warehouse_control", "firmware": "v1.4.0"}', NOW(), NOW()),
(4, 2, 4, 4, 4, '5941234', 'Хөрөнгө 4', 'normal', '2024-02-10 11:45:00', '{"location": "qc_station_1", "firmware": "v2.3.1"}', NOW(), NOW()),
(5, 2, 5, 5, 1, '5941235', 'Хөрөнгө 5', 'normal', '2024-03-01 08:00:00', '{"location": "line_1_control", "firmware": "v3.1.2"}', NOW(), NOW()),
(6, 3, 6, 6, 2, '5941236', 'Хөрөнгө 6', 'normal', '2024-03-15 13:20:00', '{"location": "conveyor_control", "firmware": "v4.2.0"}', NOW(), NOW()),
(7, 3, 7, 7, 3, '5941237', 'Хөрөнгө 7', 'normal', '2024-04-01 10:30:00', '{"location": "assembly_station_a", "firmware": "v21.02"}', NOW(), NOW());

-- 10. Insert Inspection Schedules (depends on organizations, devices, sites, inspection_templates)
INSERT INTO inspection_schedules (id, org_id, device_id, site_id, template_id, frequency, next_due_date, is_active, created_at, updated_at) VALUES
(1, 1, 1, 1, 1, 'daily', '2024-02-15', 1, NOW(), NOW()),
(2, 1, 2, 2, 1, 'daily', '2024-02-20', 1, NOW(), NOW()),
(3, 1, 3, 3, 1, 'weekly', '2024-05-10', 1, NOW(), NOW()),
(4, 2, 4, 4, 1, 'daily', '2024-01-22', 1, NOW(), NOW()),
(5, 2, 5, 5, 1, 'weekly', '2024-04-15', 1, NOW(), NOW()),
(6, 3, 6, 6, 1, 'daily', '2024-05-01', 1, NOW(), NOW()),
(7, 3, 3, 7, 1, 'weekly', '2024-05-01', 1, NOW(), NOW());

-- 11. Insert Doc Details (no dependencies)
INSERT INTO doc_details (id, doc_name, created_at, updated_at) VALUES
(1, 'plc_manual_s7_1200_v4_2.pdf', NOW(), NOW()),
(2, 'safety_procedures_2024.pdf', NOW(), NOW()),
(3, 'maintenance_schedule_q1.xlsx', NOW(), NOW()),
(4, 'installation_guide_compactlogix.pdf', NOW(), NOW());

-- 12. Insert Inspections (depends on organizations, devices, sites, contracts, users, inspection_templates)
INSERT INTO inspections (id, org_id, device_id, site_id, contract_id, template_id, type, title, scheduled_at, started_at, completed_at, status, progress, assigned_to, created_by, updated_by, notes, created_at, updated_at) VALUES
(1, 1, 1, 1, 1, 1, 'inspection', 'Өдөр тутмын үзлэг, шалгалт', '2024-01-15 09:00:00', '2024-01-15 09:15:00', '2024-01-15 10:30:00', 'approved', 0, 2, 1, 1, '2025-04-15 өдөр хийгдсэн сервис гэрээ', NOW(), NOW()),

(2, 1, 2, 2, 2, 1, 'inspection', 'Өдөр тутмын үзлэг, шалгалт', '2024-01-20 10:00:00', '2024-01-20 10:10:00', '2024-01-20 11:45:00', 'in_progress', 0, 3, 1, 2, '2025-04-15 өдөр хийгдсэн сервис гэрээ', NOW(), NOW()),

(3, 1, 3, 3, 3, 1, 'inspection', 'Өдөр тутмын үзлэг, шалгалт', '2024-02-10 14:00:00', '2024-02-10 14:05:00', '2024-02-10 15:15:00', 'in_progress', 0, 4, 1, 2, '2025-04-15 өдөр хийгдсэн сервис гэрээ', NOW(), NOW());


-- 13. Insert Inspection Answers (depends on inspections, users, doc_details)
INSERT INTO inspection_answers (id, inspection_id, answers, pdf_id, answered_by, answered_at, created_at, updated_at) VALUES
(1, 1, '{
"data":{
  "date": "2025-08-19",
  "inspector": "Ж. Болд",
  "location": "Гүүрийн зүүн гар талын гарц, А хэсэг",
  "scale_id_serial_no": "AS-12345 / SN-987654321",
  "model": "Sommer RQ-30",
  "exterior": {
    "platform": { "status": "Зүгээр", "comment": "Элдэв цууралтгүй, шулуун" },
    "sensor_base": { "status": "Зүгээр", "comment": "" },
    "beam": { "status": "Зүгээр", "comment": "" },
    "platform_plate": { "status": "Зүгээр", "comment": "Зэвгүй" },
    "beam_joint_plate": { "status": "Зүгээр", "comment": "" },
    "stop_bolt": { "status": "Зүгээр", "comment": "Тохируулга хэвийн" },
    "interplatform_bolts": { "status": "Зүгээр", "comment": "" }
  },
  "indicator": {
    "led_display": { "status": "Зүгээр", "comment": "Бүх сегмент асна" },
    "power_plug": { "status": "Зүгээр", "comment": "" },
    "seal_and_bolt": { "status": "Бүтэн", "comment": "Лац гэмтээгүй" },
    "buttons": { "status": "Зүгээр", "comment": "" },
    "junction_wiring": { "status": "Зүгээр", "comment": "Холболтууд чанга" },
    "serial_converter_plug": { "status": "Зүгээр", "comment": "" }
  },
  "jbox": {
    "box_integrity": { "status": "Зүгээр", "comment": "" },
    "collector_board": { "status": "Зүгээр", "comment": "" },
    "wire_tightener": { "status": "Зүгээр", "comment": "" },
    "resistor_element": { "status": "Зүгээр", "comment": "" },
    "protective_box": { "status": "Зүгээр", "comment": "" }
  },
  "sensor": {
    "signal_wire": { "status": "Зүгээр", "comment": "Гэмтэлгүй" },
    "ball": { "status": "Зүгээр", "comment": "" },
    "base": { "status": "Зүгээр", "comment": "" },
    "ball_cup_thin": { "status": "Зүгээр", "comment": "" },
    "plate": { "status": "Зүгээр", "comment": "" }
  },
  "foundation": {
    "cross_base": { "status": "Зүгээр", "comment": "" },
    "anchor_plate": { "status": "Зүгээр", "comment": "" },
    "ramp_angle": { "status": "Зүгээр", "comment": "" },
    "ramp_stopper": { "status": "Зүгээр", "comment": "" },
    "ramp": { "status": "Зүгээр", "comment": "Гулсалтгүй" },
    "slab_base": { "status": "Зүгээр", "comment": "" }
  },
  "cleanliness": {
    "under_platform": { "status": "Цэвэр", "comment": "" },
    "top_platform": { "status": "Цэвэр", "comment": "" },
    "gap_platform_ramp": { "status": "Саадгүй", "comment": "" },
    "both_sides_area": { "status": "Саадгүй", "comment": "" }
  },
  "remarks": "Бүх үзлэг хэвийн. Дараагийн урьдчилсан үйлчилгээ: 6 сарын дараа.",
  "signatures": {
    "inspector": "https://www.jsign.com/wp-content/uploads/2022/06/graphic-signature-angle.png"
  },
  "convertTo": "pdf"
}
}', 1, 2, '2025-01-15 10:30:00', NOW(), NOW());



-- 14. Insert Attachments (depends on inspections, devices, users)
INSERT INTO attachments (id, inspection_id, device_id, filename, original_name, mime_type, size, uploaded_by, created_at) VALUES
(1, 1, 1, 'insp_001_photo1_20240115.jpg', 'control_panel_a_photo.jpg', 'image/jpeg', 2457600, 2, '2024-01-15 10:25:00'),
(2, 1, 1, 'insp_001_photo2_20240115.jpg', 'cpu_module_close_up.jpg', 'image/jpeg', 1843200, 2, '2024-01-15 10:27:00');
