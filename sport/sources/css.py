CSS = r"""
@page{size:148mm 210mm;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff}
:root{--ink:#191741;--mute:#5b5d86;--hair:#e2e5f4;--yellow:#ffc531;--coral:#ff5a4e;
 --blue:#2b50e8;--orange:#ff8a1f;--green:#0b7d51;--violet:#2a1b6b;--pink:#d92d57;--teal:#0a7f8a}
body{font-family:"DM Sans",sans-serif;font-size:9.6pt;line-height:1.36;color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}
p{margin:0}b,strong{font-weight:800}a{color:inherit}
.page{width:148mm;height:210mm;position:relative;overflow:hidden;break-after:page;page-break-after:always;background:#fff;display:flex;flex-direction:column}
.an{font-family:"Anton",sans-serif;font-weight:400;text-transform:uppercase}
.ch-night{--c:#191741;--on:#fff;--tint:#eceefb;--deep:#191741;--title:#ffc531;--stripe:#ffc531}
.ch-train{--c:#2b50e8;--on:#fff;--tint:#e6ecff;--deep:#1c2f9c;--title:#fff;--stripe:#191741;
 --frame:#e6ecff;--ground:#cdd8fb;--fig:#191741;--far:#8f96c9;--eq:#2b50e8;--eq2:#b3c2f8;--arrow:#ff8a1f}
.ch-cardio{--c:#ff8a1f;--on:#191741;--tint:#fff0dd;--deep:#a34a00;--title:#191741;--stripe:#191741;
 --frame:#fff0dd;--ground:#ffdcae;--fig:#191741;--far:#b79f8a;--eq:#e8650a;--eq2:#ffc68c;--arrow:#2b50e8}
.ch-food .lede{max-width:98mm}.ch-food{--c:#0b7d51;--on:#fff;--tint:#dff5e9;--deep:#0b6b47;--title:#fff;--stripe:#191741}
.ch-ramadan{--c:#2a1b6b;--on:#fff;--tint:#ece6fb;--deep:#2a1b6b;--title:#f5b93a;--stripe:#f5b93a}
.ch-mind{--c:#d92d57;--on:#fff;--tint:#ffe4ea;--deep:#a31440;--title:#fff;--stripe:#191741}
.ch-track{--c:#0a7f8a;--on:#fff;--tint:#dcf3f5;--deep:#0a6670;--title:#fff;--stripe:#191741}
.clap{height:4.2mm;flex:none;background:repeating-linear-gradient(-58deg,var(--stripe) 0 4.4mm,#fff 4.4mm 8.8mm)}
.ch-night .clap,.ch-ramadan .clap{background:repeating-linear-gradient(-58deg,var(--stripe) 0 4.4mm,var(--c) 4.4mm 8.8mm)}
.hd{background:var(--c);color:var(--on);padding:6mm 10mm 5.6mm;flex:none;position:relative;overflow:hidden}
.hd .deco{position:absolute;right:7mm;top:50%;transform:translateY(-50%);font-family:Anton;font-size:112pt;line-height:1;opacity:.15;color:var(--on)}
.hd .deco .ic{width:38mm;height:38mm;display:block}
.kick{display:flex;gap:1.6mm;align-items:center;font-weight:700;font-size:8.8pt;margin-bottom:1.8mm;position:relative}
.tag{display:inline-block;border:1.1pt solid currentColor;border-radius:99px;padding:.2mm 2.6mm;font-weight:700;font-size:8pt;line-height:1.55}
h1{font-family:Anton;font-weight:400;font-size:40pt;line-height:1;margin:0;text-transform:uppercase;color:var(--title);position:relative}
h1.s{font-size:32pt}
.lede{font-size:10.4pt;line-height:1.32;margin-top:2.6mm;max-width:106mm;font-weight:500;position:relative}
.by{display:flex;align-items:center;gap:1.4mm;margin-top:3mm;font-size:8pt;position:relative;opacity:.96}
.av{width:5.6mm;height:5.6mm;border-radius:50%;display:inline-grid;place-items:center;font-family:Anton;font-size:8pt;color:#fff;background:var(--avc,#191741);border:1pt solid rgba(255,255,255,.75);margin-right:-.6mm}
main{padding:5mm 10mm 0;flex:1;display:flex;flex-direction:column;gap:3.4mm;min-height:0}
footer{flex:none;height:9mm;padding:0 10mm;display:flex;justify-content:space-between;align-items:center;font-size:7.4pt;color:var(--mute)}
footer .ft{font-family:Anton;letter-spacing:.7pt;text-transform:uppercase;font-size:7.4pt}
footer .pn{font-weight:800;color:var(--ink)}
.ic{width:1em;height:1em;fill:currentColor;flex:none;display:inline-block;vertical-align:-.14em}
.card{background:var(--tint);border-radius:3.4mm;padding:3.6mm 4.2mm}
.h2{font-family:Anton;font-weight:400;font-size:15pt;line-height:1.06;text-transform:uppercase;margin:0}
.h3{font-family:Anton;font-weight:400;font-size:12pt;line-height:1.1;text-transform:uppercase;margin:0}
.small{font-size:8.5pt;line-height:1.32}.mute{color:var(--mute)}
.grow{flex:1}.row{display:flex;gap:3.4mm}.col{display:flex;flex-direction:column;gap:3.4mm}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:3.4mm}.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:2.4mm}

/* couverture */
.cover{background:#191741;color:#fff}
.cover .clap{background:repeating-linear-gradient(-58deg,#ffc531 0 4.4mm,#191741 4.4mm 8.8mm);height:5mm}
.cv-top{display:flex;justify-content:space-between;padding:5mm 10mm 0;font-size:8.4pt;font-weight:600;color:#c9c8ef}
.cv-title{padding:5mm 10mm 0;position:relative}
.op{font-size:44pt;line-height:1;color:#ffc531}
.n87{font-size:232pt;line-height:.9;color:#fff;margin-left:-2mm;letter-spacing:-2pt;position:relative;display:inline-block}
.n87 .kg{position:absolute;left:100%;bottom:9mm;font-size:38pt;color:#ff5a4e;letter-spacing:0;margin-left:3.5mm;line-height:1}
.n87 .from{position:absolute;left:100%;top:13mm;margin-left:3.5mm;font-family:"DM Sans";font-size:9pt;font-weight:700;letter-spacing:0;line-height:1.3;text-transform:none;color:#c9c8ef;white-space:nowrap}
.n87 .from b{display:block;font-family:Anton;font-weight:400;font-size:22pt;color:#fff;line-height:1.05}
.strip{position:relative;background:#0d0c28;padding:5.4mm 3mm;display:grid;grid-template-columns:repeat(5,1fr);gap:2.2mm;margin-top:1mm}
.strip:before,.strip:after{content:"";position:absolute;left:0;right:0;height:2.1mm;background:repeating-linear-gradient(90deg,transparent 0 1.7mm,#e9e8ff 1.7mm 3.7mm,transparent 3.7mm 5.4mm);opacity:.8}
.strip:before{top:1.6mm}.strip:after{bottom:1.6mm}
.strip .pic{border-radius:4px}
.ch-film{--frame:#262363;--ground:#33308a;--fig:#fff;--far:#8a88c9;--eq:#ffc531;--eq2:#55529f;--arrow:#ff5a4e}
.cv-name{font-size:27pt;padding:6.5mm 10mm 0;line-height:1}
.cv-role{padding:1.6mm 10mm 0;font-size:11pt;color:#ffc531;font-weight:600;font-style:italic}
.cv-stats{display:grid;grid-template-columns:1fr 1fr 1.45fr;padding:5mm 10mm 0}
.cv-stats div{border-left:1.1pt solid rgba(255,255,255,.28);padding:0 3.4mm}
.cv-stats div:first-child{border-left:0;padding-left:0}
.cv-stats b{font-family:Anton;font-weight:400;font-size:17pt;display:block;line-height:1.08;white-space:nowrap}
.cv-stats span{font-size:8.2pt;color:#c9c8ef}
.billing{margin-top:auto;padding:3mm 9mm 4mm;font-family:Anton;font-size:9pt;line-height:1.6;letter-spacing:1.5pt;text-transform:uppercase;color:#a9a8dc;text-align:center}
.billing small{font-family:"DM Sans";font-size:6.6pt;letter-spacing:.3pt;text-transform:none;color:#8a88c9;margin:0 .5mm}

/* tuiles chiffres */
.tiles{display:grid;grid-template-columns:1fr 1fr;gap:3mm;flex:1}
.tile{border-radius:4mm;padding:4mm 4.4mm;background:var(--tc);color:var(--to,#fff);display:flex;flex-direction:column;justify-content:flex-end;position:relative;overflow:hidden;min-height:0}
.tile .ic{position:absolute;right:3.4mm;top:3.4mm;font-size:22pt;opacity:.9}
.tile b{font-family:Anton;font-weight:400;font-size:41pt;line-height:1;display:block;text-transform:uppercase}
.tile b small{font-size:20pt}
.tile span{font-size:9.6pt;font-weight:600;line-height:1.25;margin-top:1mm}
.banner{background:var(--ink);color:#fff;border-radius:3.4mm;padding:3.6mm 4.4mm;font-size:10pt;font-weight:600;display:flex;gap:3mm;align-items:center}
.banner b{color:var(--yellow)}.banner .ic{font-size:17pt;color:var(--yellow)}

/* scénario */
.chart{display:block;width:100%;height:auto}
.chart text{font-family:"DM Sans",sans-serif;fill:var(--mute);font-size:11px}
.chart .v{fill:var(--ink);font-weight:800;font-size:13px}
.cps{display:grid;grid-template-columns:repeat(4,1fr);gap:2.2mm}
.cp{border-radius:3mm;padding:2.6mm 3mm;background:var(--tint);border-top:2.4pt solid var(--cc,var(--ink))}
.cp small{font-size:7.8pt;font-weight:700;display:block}
.cp b{font-family:Anton;font-weight:400;font-size:21pt;line-height:1.05;display:block}
.cp span{font-size:7.9pt;line-height:1.2;display:block;color:#33355e}

/* casting */
.cast{display:grid;grid-template-columns:1fr 1fr;gap:2.6mm 4mm}
.mem{display:grid;grid-template-columns:12mm 1fr;gap:3mm;align-items:center}
.mem .A{width:12mm;height:12mm;border-radius:50%;background:var(--avc);color:var(--avo,#fff);display:grid;place-items:center;font-family:Anton;font-size:17pt}
.mem b{font-family:Anton;font-weight:400;font-size:13.5pt;text-transform:uppercase;line-height:1.05;display:block}
.mem i{font-style:normal;font-weight:700;font-size:8pt;color:var(--avt,var(--mute));display:block}
.mem span{font-size:8.3pt;line-height:1.25;display:block;color:#33355e}

/* semaine */
.wk{display:flex;flex-direction:column;gap:1.9mm}
.wkr{display:grid;grid-template-columns:24mm 1fr 15mm;gap:2mm;align-items:center}
.wkr .d{font-family:Anton;font-size:14.5pt;text-transform:uppercase;line-height:1}
.wkr .b{border-radius:2.8mm;padding:2.3mm 3.6mm;display:flex;align-items:center;gap:3.2mm;background:var(--bc);color:var(--bo,#fff);min-height:13.4mm}
.wkr .L{font-family:Anton;font-size:23pt;line-height:1;width:8mm;text-align:center;flex:none}
.wkr .L .ic{font-size:19pt}
.wkr .t b{font-family:Anton;font-weight:400;font-size:12.5pt;text-transform:uppercase;display:block;line-height:1.12}
.wkr .t span{font-size:8.3pt;line-height:1.2;display:block}
.wkr .m{text-align:right;font-weight:800;font-size:9pt;white-space:nowrap}
.acts{display:grid;grid-template-columns:repeat(4,1fr);gap:2.2mm}
.act{border-radius:2.8mm;padding:2.4mm 3mm;background:var(--tint)}
.act small{font-size:7.4pt;font-weight:700;display:block;color:var(--mute)}
.act b{font-family:Anton;font-weight:400;font-size:11.5pt;text-transform:uppercase;display:block;line-height:1.1}
.act span{font-size:7.6pt;line-height:1.22;display:block;margin-top:.6mm}

/* journée */
.tl{display:flex;flex-direction:column;position:relative;flex:1;justify-content:space-between}
.tl:before{content:"";position:absolute;left:28.7mm;top:8mm;bottom:8mm;width:1.4pt;background:#cfd3ea}
.tlr{display:grid;grid-template-columns:24mm 9.6mm 1fr;gap:0 3.4mm;align-items:center;position:relative}
.tlr .h{font-family:Anton;font-size:20pt;line-height:1;text-align:right;padding-right:1mm}
.tlr .h small{display:block;font-family:"DM Sans";font-size:7pt;font-weight:700;color:var(--mute);text-transform:none;line-height:1.2}
.tlr .dot{width:9.6mm;height:9.6mm;border-radius:50%;background:var(--dc);color:var(--do,#fff);display:grid;place-items:center;font-size:14pt;z-index:1}
.tlr .x b{font-size:10.8pt;display:block;line-height:1.2}
.tlr .x span{font-size:8.9pt;color:#33355e;display:block;line-height:1.28}

/* séances */
.sw{display:flex;gap:2.6mm;align-items:center;background:var(--tint);border-radius:3mm;padding:2.2mm 3.6mm;font-size:8.7pt;line-height:1.28}
.sw .ic{font-size:14pt;color:var(--c)}
.ex{display:grid;grid-template-columns:65mm 1fr;gap:4.4mm;align-items:center}
.ex .pics{display:grid;grid-template-columns:1fr 1fr;gap:1.6mm}
.ex .nm{display:flex;gap:2mm;align-items:baseline}
.ex .no{font-family:Anton;font-size:12.5pt;color:var(--c);flex:none}
.ex h3{font-family:Anton;font-weight:400;font-size:13.6pt;line-height:1.05;margin:0;text-transform:uppercase}
.ex .dose{font-family:Anton;font-size:23pt;line-height:1.04;color:var(--c);margin-top:1.3mm;white-space:nowrap}
.ex .rest{display:inline-flex;gap:1mm;align-items:center;font-weight:700;font-size:8pt;color:var(--mute);margin-top:.6mm}
.ex .cue{font-size:8.5pt;line-height:1.3;margin-top:1.1mm;color:#33355e}
.chrono{background:var(--frame);border-radius:9px;display:grid;place-items:center;text-align:center;font-family:Anton;color:var(--c);font-size:16pt;line-height:1.05}
.chrono .ic{font-size:22pt;display:block;margin:0 auto 1.4mm}
.fin{display:grid;grid-template-columns:31.7mm 1fr;gap:4.4mm;align-items:center;background:#fff0dd;border-radius:3.4mm;padding:2.6mm;
 --frame:#ffe2bd;--ground:#ffcf94;--fig:#191741;--far:#b79f8a;--eq:#e8650a;--eq2:#ffc68c;--arrow:#2b50e8}
.fin b{font-family:Anton;font-weight:400;font-size:15pt;text-transform:uppercase;line-height:1.05;display:block}
.fin b em{font-style:normal;color:#c2560a}
.fin span{font-size:8.5pt;line-height:1.3;display:block;margin-top:.8mm}
.prog{border:1.4pt solid var(--c);border-radius:3.4mm;padding:3mm 4mm;display:grid;grid-template-columns:auto 1fr;gap:3.2mm;align-items:center}
.prog .ic{font-size:22pt;color:var(--c)}
.prog b{font-family:Anton;font-weight:400;font-size:12pt;text-transform:uppercase;display:block;line-height:1.1}
.prog span{font-size:8.6pt;line-height:1.3;display:block;margin-top:.6mm}
/* circuit */
.loop{display:grid;grid-template-columns:repeat(5,1fr);gap:1.8mm;position:relative}
.st{text-align:center}.st b{font-family:Anton;font-weight:400;font-size:10.4pt;text-transform:uppercase;display:block;line-height:1.08;margin-top:1.4mm}
.st i{font-style:normal;font-family:Anton;font-size:15pt;color:var(--c);display:block;line-height:1.1}
.st .pic{border-radius:6px}
.x5{display:grid;grid-template-columns:auto 1fr;gap:4mm;align-items:center}
.x5 .big{font-family:Anton;font-size:60pt;line-height:.95;color:var(--c)}
/* tableaux simples */
.tb{width:100%;border-collapse:collapse;font-size:8.8pt}
.tb th{font-size:7.6pt;font-weight:700;color:var(--mute);text-align:left;padding:0 2mm 1.2mm 0;border-bottom:1.2pt solid var(--ink)}
.tb td{padding:1.7mm 2mm 1.7mm 0;border-bottom:.6pt solid var(--hair);vertical-align:middle}
.tb td b{font-family:Anton;font-weight:400;font-size:12pt}
.tb tr:last-child td{border-bottom:0}
/* échelle traction */
.lad{display:flex;flex-direction:column;gap:2mm}
.lv{display:grid;grid-template-columns:8mm 27mm 1fr;gap:3.2mm;align-items:center}
.lv .n{font-family:Anton;font-size:24pt;color:var(--c);line-height:1;text-align:center}
.lv b{font-family:Anton;font-weight:400;font-size:12.2pt;text-transform:uppercase;display:block;line-height:1.08}
.lv i{font-style:normal;font-family:Anton;font-size:12.5pt;color:var(--c)}
.lv span{font-size:8.4pt;line-height:1.26;display:block;color:#33355e}
.lv .pic{border-radius:6px}
/* cantine */
.meal{display:grid;grid-template-columns:33mm 1fr;gap:4.4mm;align-items:center;background:var(--tint);border-radius:4mm;padding:3.2mm 4.2mm 3.2mm 3.2mm}
.meal .il{width:33mm;height:33mm}
.meal .hh{display:flex;justify-content:space-between;align-items:baseline;gap:2mm}
.meal .hh b{font-family:Anton;font-weight:400;font-size:17pt;text-transform:uppercase;line-height:1.02}
.meal .hh i{font-style:normal;font-weight:800;font-size:8.4pt;color:var(--deep);white-space:nowrap}
.ing{display:flex;flex-wrap:wrap;gap:1.2mm 1.4mm;margin-top:1.8mm}
.ing span{background:#fff;border-radius:99px;padding:.5mm 2.4mm;font-size:8.5pt;line-height:1.5;white-space:nowrap}
.ing span b{font-family:Anton;font-weight:400;font-size:9.6pt;color:var(--deep)}
.meal .k{margin-top:1.8mm;font-size:8.4pt;font-weight:700;color:var(--deep)}
.meal .pp{font-size:8.2pt;line-height:1.28;margin-top:1mm;color:#33355e}
.tot{display:grid;grid-template-columns:repeat(5,1fr);background:var(--ink);color:#fff;border-radius:3.4mm;padding:3mm 2mm;text-align:center}
.tot b{font-family:Anton;font-weight:400;font-size:19pt;display:block;line-height:1.05;color:var(--yellow)}
.tot span{font-size:7.6pt;display:block}
.sw2{border-radius:3mm;background:var(--tint);padding:2.6mm 3.2mm}
.sw2 b{font-family:Anton;font-weight:400;font-size:17pt;display:block;line-height:1;color:var(--deep)}
.sw2 i{font-style:normal;font-weight:800;font-size:9pt;display:block;margin-top:.8mm}
.sw2 span{font-size:7.9pt;line-height:1.24;display:block;color:#33355e;margin-top:.4mm}
.chips{display:flex;flex-wrap:wrap;gap:1.4mm}
.chips span{border:1pt solid var(--c);color:var(--deep);border-radius:99px;padding:.3mm 2.6mm;font-size:8.4pt;font-weight:600;line-height:1.55}
.li{display:grid;grid-template-columns:7mm 1fr;gap:2.6mm;align-items:start;font-size:9.1pt;line-height:1.32}
.li .ic{font-size:14pt;color:var(--c);margin-top:.2mm}
.li.no .ic{color:#d92d57}.li b{font-weight:800}
.lis{display:flex;flex-direction:column;gap:2.2mm}
.shop{width:100%;border-collapse:collapse;font-size:8.9pt}
.shop td{padding:1.25mm 0;border-bottom:.6pt solid #bfe3cf}.shop tr:last-child td{border-bottom:0}
.shop td:last-child{text-align:right;font-family:Anton;font-size:10.6pt;color:var(--deep);white-space:nowrap}
.steps{display:flex;flex-direction:column;gap:2.4mm}
.stp{display:grid;grid-template-columns:8mm 1fr;gap:2.6mm;align-items:start}
.stp .n{width:8mm;height:8mm;border-radius:50%;background:var(--c);color:var(--on);display:grid;place-items:center;font-family:Anton;font-size:12pt}
.stp b{display:block;font-size:9.4pt;line-height:1.2}.stp span{font-size:8.5pt;line-height:1.28;color:#33355e;display:block}
/* mythes */
.myth{display:grid;grid-template-columns:1fr 1fr;border-radius:3.2mm;overflow:hidden}
.myth .m{background:#f1f2f9;padding:2.8mm 3.4mm;font-size:8.8pt;line-height:1.28;color:#4b4d76;display:flex;gap:2mm;align-items:center}
.myth .m s{text-decoration-color:#d92d57;text-decoration-thickness:1.2pt}
.myth .r{background:var(--tint);padding:2.8mm 3.4mm;font-size:8.8pt;line-height:1.28;font-weight:600;display:flex;gap:2mm;align-items:center}
.myth .ic{font-size:13pt;flex:none}.myth .m .ic{color:#d92d57}.myth .r .ic{color:var(--c)}
.colh{display:grid;grid-template-columns:1fr 1fr;font-size:7.8pt;font-weight:700;color:var(--mute);padding:0 3.4mm;margin-bottom:-1.6mm}
/* ramadan */
.ram{background:#1c1250;color:#fff}
.ram main{color:#fff}
.ram .card{background:#2d2170;color:#fff}
.ram footer{color:#a79fdc}.ram footer .pn{color:#fff}
.ram .moon{position:absolute;right:9mm;top:9mm;width:27mm;height:27mm}
.rt{display:grid;grid-template-columns:repeat(4,1fr);gap:2.2mm}
.rt div{background:#2d2170;border-radius:3mm;padding:2.8mm 3mm;border-top:2.4pt solid #f5b93a}
.rt small{font-size:7.6pt;font-weight:700;color:#f5b93a;display:block}
.rt b{font-family:Anton;font-weight:400;font-size:13pt;text-transform:uppercase;display:block;line-height:1.1;margin:.4mm 0 .8mm}
.rt span{font-size:8.1pt;line-height:1.26;display:block;color:#e4e0fb}
.ram .li .ic{color:#f5b93a}.ram .h2{color:#f5b93a}
/* divers */
.big3{display:grid;grid-template-columns:repeat(3,1fr);gap:2.6mm}
.big3 div{background:var(--tint);border-radius:3.2mm;padding:3mm 3.4mm}
.big3 b{font-family:Anton;font-weight:400;font-size:13pt;text-transform:uppercase;display:block;line-height:1.1}
.big3 span{font-size:8.4pt;line-height:1.28;display:block;margin-top:1mm;color:#33355e}
.big3 .ic{font-size:17pt;color:var(--c);display:block;margin-bottom:1.2mm}
.rule1{background:var(--c);color:var(--on);border-radius:4mm;padding:4.4mm 5mm}
.rule1 small{font-size:8.6pt;font-weight:700;display:block;opacity:.92}
.rule1 b{font-family:Anton;font-weight:400;font-size:27pt;text-transform:uppercase;line-height:1.02;display:block;margin-top:.6mm}
.dec{display:grid;grid-template-columns:40mm 6mm 1fr;align-items:center;gap:2mm;border-radius:3.2mm;background:var(--tint);padding:2.8mm 3.6mm}
.dec b{font-family:Anton;font-weight:400;font-size:13pt;line-height:1.08;text-transform:uppercase}
.dec small{display:block;font-family:"DM Sans";font-weight:600;font-size:7.8pt;text-transform:none;color:var(--mute);line-height:1.25;margin-top:.4mm}
.dec .ic{font-size:14pt;color:var(--c)}
.dec span{font-size:8.9pt;line-height:1.3;font-weight:600}
.trk{width:100%;border-collapse:collapse;font-size:8.2pt}
.trk th{font-size:7.2pt;font-weight:700;color:var(--mute);text-align:left;padding:0 1.6mm 1mm;border-bottom:1.2pt solid var(--ink)}
.trk td{padding:.95mm 1.6mm;border-bottom:.6pt solid var(--hair)}
.trk td:first-child{font-family:Anton;font-size:9.4pt}
.trk td.c{font-family:Anton;font-size:9.8pt;color:var(--deep)}
.trk td.w{width:21mm}.trk td.w i{display:block;height:4.4mm;border:.8pt solid #b9c0de;border-radius:1.2mm;background:#fff}
.trk tr.r td{background:#f3effc}.trk tr.k td{background:var(--tint)}
.qr{display:grid;grid-template-columns:26mm 1fr;gap:4mm;align-items:center;background:var(--ink);color:#fff;border-radius:3.6mm;padding:3mm 4mm 3mm 3mm}
.qr svg{width:26mm;height:26mm;background:#fff;border-radius:2mm;display:block}
.qr b{font-family:Anton;font-weight:400;font-size:14pt;text-transform:uppercase;color:var(--yellow);display:block;line-height:1.08}
.qr span{font-size:8.4pt;line-height:1.3;display:block;margin-top:.8mm}
.qr a{color:#fff;font-weight:700;word-break:break-all;font-size:7.4pt}
.src{font-size:8pt;line-height:1.3;display:grid;grid-template-columns:5mm 1fr;gap:1.2mm 2mm}
.src i{font-style:normal;font-family:Anton;color:var(--mute)}
.src a{color:var(--mute);text-decoration:none;font-size:7.2pt;word-break:break-all}
.warn{border:1.4pt solid #d92d57;border-radius:3.4mm;padding:3mm 4mm;font-size:8.8pt;line-height:1.32;display:grid;grid-template-columns:auto 1fr;gap:3mm;align-items:center}
.warn .ic{font-size:20pt;color:#d92d57}
"""
