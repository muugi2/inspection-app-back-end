# Template дээр Field бүрийн зурагууд оруулах заавар

## Төлөвлөгөө

- Field бүрт зургууд байрлана (section биш, field)
- Зураг байхгүй field нуугдана
- Field бүрийн зургууд grid-ээр харагдана (1 2 3, 4 гэх мэт)
- Loop ашиглан хэдэн зураг байгааг автоматаар тооцоолно

## Template структура

### Жишээ: "Автожингийн тавцан" section

```
[Section гарчиг]
Автожингийн тавцан

[Хүснэгт]
...

[Field 1: Мэдрэгчийн суурь]
{{#d.hasImages.exterior.sensor_base}}

Мэдрэгчийн суурь:

{{#d.images.exterior.sensor_base}}
[Placeholder зураг - Alt Text: image]]
{{/d.images.exterior.sensor_base}}

{{/d.hasImages.exterior.sensor_base}}

[Field 2: Дам нуруу]
{{#d.hasImages.exterior.beam}}

Дам нуруу:

{{#d.images.exterior.beam}}
[Placeholder зураг - Alt Text: image]]
{{/d.images.exterior.beam}}

{{/d.hasImages.exterior.beam}}

[Field 3: Тавцангийн лист]
{{#d.hasImages.exterior.platform_plate}}

Тавцангийн лист:

{{#d.images.exterior.platform_plate}}
[Placeholder зураг - Alt Text: image]]
{{/d.images.exterior.platform_plate}}

{{/d.hasImages.exterior.platform_plate}}

... бусад field-үүд
```

## Word Template дээр оруулах алхамууд

### Жишээ: "Мэдрэгчийн суурь" field

#### 1. Field гарчиг (paragraph дээр):
```
Мэдрэгчийн суурь:
```

#### 2. Condition эхлэх (paragraph дээр):
```
{{#d.hasImages.exterior.sensor_base}}
```

#### 3. Loop эхлэх (paragraph дээр):
```
{{#d.images.exterior.sensor_base}}
```

#### 4. Placeholder зураг оруулах:
- Insert → Pictures → Placeholder зураг оруулах
- Зургийг сонгох
- Right-click → Format Picture → Alt Text
- Alt Text → Description дээр:
  ```
  image
  ```

#### 5. Loop дуусгах (paragraph дээр):
```
{{/d.images.exterior.sensor_base}}
```

#### 6. Condition дуусгах (paragraph дээр):
```
{{/d.hasImages.exterior.sensor_base}}
```

## Бүх Field-үүдийн placeholder

### exterior section:
- `{{#d.hasImages.exterior.sensor_base}}` ... `{{/d.hasImages.exterior.sensor_base}}`
- `{{#d.hasImages.exterior.beam}}` ... `{{/d.hasImages.exterior.beam}}`
- `{{#d.hasImages.exterior.platform_plate}}` ... `{{/d.hasImages.exterior.platform_plate}}`
- `{{#d.hasImages.exterior.beam_joint_plate}}` ... `{{/d.hasImages.exterior.beam_joint_plate}}`
- `{{#d.hasImages.exterior.stop_bolt}}` ... `{{/d.hasImages.exterior.stop_bolt}}`
- `{{#d.hasImages.exterior.interplatform_bolts}}` ... `{{/d.hasImages.exterior.interplatform_bolts}}`

### indicator section:
- `{{#d.hasImages.indicator.led_display}}` ... `{{/d.hasImages.indicator.led_display}}`
- `{{#d.hasImages.indicator.power_plug}}` ... `{{/d.hasImages.indicator.power_plug}}`
- `{{#d.hasImages.indicator.seal_and_bolt}}` ... `{{/d.hasImages.indicator.seal_and_bolt}}`
- `{{#d.hasImages.indicator.buttons}}` ... `{{/d.hasImages.indicator.buttons}}`
- `{{#d.hasImages.indicator.junction_wiring}}` ... `{{/d.hasImages.indicator.junction_wiring}}`
- `{{#d.hasImages.indicator.serial_converter_plug}}` ... `{{/d.hasImages.indicator.serial_converter_plug}}`

### jbox section:
- `{{#d.hasImages.jbox.box_integrity}}` ... `{{/d.hasImages.jbox.box_integrity}}`
- `{{#d.hasImages.jbox.collector_board}}` ... `{{/d.hasImages.jbox.collector_board}}`
- `{{#d.hasImages.jbox.wire_tightener}}` ... `{{/d.hasImages.jbox.wire_tightener}}`
- `{{#d.hasImages.jbox.resistor_element}}` ... `{{/d.hasImages.jbox.resistor_element}}`
- `{{#d.hasImages.jbox.protective_box}}` ... `{{/d.hasImages.jbox.protective_box}}`

### sensor section:
- `{{#d.hasImages.sensor.signal_wire}}` ... `{{/d.hasImages.sensor.signal_wire}}`
- `{{#d.hasImages.sensor.ball}}` ... `{{/d.hasImages.sensor.ball}}`
- `{{#d.hasImages.sensor.base}}` ... `{{/d.hasImages.sensor.base}}`
- `{{#d.hasImages.sensor.ball_cup_thin}}` ... `{{/d.hasImages.sensor.ball_cup_thin}}`
- `{{#d.hasImages.sensor.plate}}` ... `{{/d.hasImages.sensor.plate}}`

### foundation section:
- `{{#d.hasImages.foundation.cross_base}}` ... `{{/d.hasImages.foundation.cross_base}}`
- `{{#d.hasImages.foundation.anchor_plate}}` ... `{{/d.hasImages.foundation.anchor_plate}}`
- `{{#d.hasImages.foundation.ramp_angle}}` ... `{{/d.hasImages.foundation.ramp_angle}}`
- `{{#d.hasImages.foundation.ramp_stopper}}` ... `{{/d.hasImages.foundation.ramp_stopper}}`
- `{{#d.hasImages.foundation.ramp}}` ... `{{/d.hasImages.foundation.ramp}}`
- `{{#d.hasImages.foundation.slab_base}}` ... `{{/d.hasImages.foundation.slab_base}}`

### cleanliness section:
- `{{#d.hasImages.cleanliness.under_platform}}` ... `{{/d.hasImages.cleanliness.under_platform}}`
- `{{#d.hasImages.cleanliness.top_platform}}` ... `{{/d.hasImages.cleanliness.top_platform}}`
- `{{#d.hasImages.cleanliness.gap_platform_ramp}}` ... `{{/d.hasImages.cleanliness.gap_platform_ramp}}`
- `{{#d.hasImages.cleanliness.both_sides_area}}` ... `{{/d.hasImages.cleanliness.both_sides_area}}`

## Grid layout (3 багана)

Word template дээр зурагууд автоматаар grid-ээр байрлана гэдгийг анхаарна уу. `easy-template-x` нь зурагуудыг дараалан оруулдаг, grid layout нь Word-ийн formatting-аас хамаарна.

Хэрэв grid layout хийх шаардлагатай бол:
1. Placeholder зурагуудыг table дээр байрлуулах
2. Эсвэл text box ашиглах

## Тайлбар

- `{{#d.hasImages.exterior.sensor_base}}` - condition (зураг байвал харуулах)
- `{{#d.images.exterior.sensor_base}}` - loop (зураг бүрийн хувьд)
- `{{/d.images.exterior.sensor_base}}` - loop дуусгах
- `{{/d.hasImages.exterior.sensor_base}}` - condition дуусгах
- Placeholder зурагийн Alt Text = `image` (easy-template-x энэ placeholder-ийг зургаар орлуулна)

## Жишээ: "Мэдрэгчийн суурь" field

```
Мэдрэгчийн суурь:

{{#d.hasImages.exterior.sensor_base}}
{{#d.images.exterior.sensor_base}}
[Placeholder зураг - Alt Text: image]]
{{/d.images.exterior.sensor_base}}
{{/d.hasImages.exterior.sensor_base}}
```

Хэрэв 3 зураг байвал:
```
Мэдрэгчийн суурь:

[Зураг 1] [Зураг 2] [Зураг 3]
```

Хэрэв зураг байхгүй бол:
```
(энэ field нуугдана)
```











