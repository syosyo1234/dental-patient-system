/* =========================================================
   data.js - デモデータ
   ※ 氏名・住所・電話番号・診療内容などは、すべて架空の情報です。
     実在の人物・患者とは関係ありません。

   初めてシステムを開いたとき（localStorage にデータが無いとき）、
   このデータが初期データとして使われます。
   ========================================================= */

// ---------- 患者基本情報 ----------
// id は「P + 4桁の数字」。患者ごとに必ず一意（重複しない）。
const DEMO_PATIENTS = [
  {
    id: 'P0001',
    name: '山田 太郎',
    kana: 'ヤマダ タロウ',
    birthDate: '1978-05-14',
    gender: '男性',
    phone: '090-1234-5678',
    address: '東京都杉並区高円寺南2-15-8',
    firstVisitDate: '2025-04-10',
    note: '高血圧の既往あり。'
  },
  {
    id: 'P0002',
    name: '佐々木 花子',
    kana: 'ササキ ハナコ',
    birthDate: '1990-11-03',
    gender: '女性',
    phone: '080-2345-6789',
    address: '東京都中野区中野4-3-12 コーポ中野201',
    firstVisitDate: '2025-07-22',
    note: '金属アレルギーの申告あり。'
  },
  {
    id: 'P0003',
    name: '田中 一郎',
    kana: 'タナカ イチロウ',
    birthDate: '1952-02-28',
    gender: '男性',
    phone: '03-3456-7890',
    address: '東京都練馬区豊玉北1-7-20',
    firstVisitDate: '2024-11-05',
    note: '下顎部分入れ歯を使用。'
  },
  {
    id: 'P0004',
    name: '小林 美咲',
    kana: 'コバヤシ ミサキ',
    birthDate: '2012-08-19',
    gender: '女性',
    phone: '090-3456-7801',
    address: '東京都杉並区阿佐谷北3-2-5',
    firstVisitDate: '2026-03-14',
    note: '保護者（母）同伴で来院。連絡先は母の携帯。'
  },
  {
    id: 'P0005',
    name: '伊藤 健太',
    kana: 'イトウ ケンタ',
    birthDate: '1985-06-30',
    gender: '男性',
    phone: '070-4567-8912',
    address: '東京都世田谷区経堂5-11-3',
    firstVisitDate: '2026-01-20',
    note: '平日夜の予約を希望。'
  },
  {
    id: 'P0006',
    name: '渡辺 由美子',
    kana: 'ワタナベ ユミコ',
    birthDate: '1968-12-09',
    gender: '女性',
    phone: '03-5678-9012',
    address: '東京都杉並区荻窪1-22-6',
    firstVisitDate: '2025-02-18',
    note: '定期検診（3か月ごと）を希望。'
  },
  {
    id: 'P0007',
    name: '中村 翔',
    kana: 'ナカムラ ショウ',
    birthDate: '1998-03-25',
    gender: '男性',
    phone: '080-6789-0123',
    address: '東京都中野区野方6-1-14',
    firstVisitDate: '2026-08-04',
    note: ''
  },
  {
    id: 'P0008',
    name: '加藤 千代子',
    kana: 'カトウ チヨコ',
    birthDate: '1945-09-17',
    gender: '女性',
    phone: '03-7890-1234',
    address: '東京都練馬区桜台2-9-1',
    firstVisitDate: '2025-09-30',
    note: '抗凝固薬服用中。抜歯等の観血処置の際は要確認。'
  }
];

// ---------- 来院記録 ----------
// 1件ごとに独立した id（V + 4桁）を持ち、
// patientId で「どの患者の記録か」を表します（患者IDとの紐付け）。
// fee（費用）は 0 以上の整数（円）。
const DEMO_VISITS = [
  // P0001 山田 太郎（4回）
  { id: 'V0001', patientId: 'P0001', date: '2025-04-10', complaint: '右下の奥歯が冷たい物でしみる', treatment: '口腔内検査、レントゲン撮影、右下6番 CR充填', doctor: '佐藤', fee: 3500, note: '' },
  { id: 'V0002', patientId: 'P0001', date: '2025-04-24', complaint: '歯石除去を希望', treatment: 'スケーリング（全顎）、ブラッシング指導', doctor: '鈴木', fee: 2100, note: '' },
  { id: 'V0003', patientId: 'P0001', date: '2026-06-12', complaint: '左上の歯ぐきが腫れている', treatment: '歯周ポケット検査、洗浄、投薬', doctor: '佐藤', fee: 2800, note: '抗生剤3日分処方' },
  { id: 'V0004', patientId: 'P0001', date: '2026-10-01', complaint: '定期検診', treatment: '定期検診、スケーリング、PMTC', doctor: '鈴木', fee: 4400, note: '次回は3か月後' },

  // P0002 佐々木 花子（4回）
  { id: 'V0005', patientId: 'P0002', date: '2025-07-22', complaint: '前歯が少し欠けた', treatment: '右上1番 CR充填', doctor: '高橋', fee: 2600, note: '' },
  { id: 'V0006', patientId: 'P0002', date: '2025-08-05', complaint: '歯のクリーニング希望', treatment: 'スケーリング、PMTC', doctor: '鈴木', fee: 2300, note: '' },
  { id: 'V0007', patientId: 'P0002', date: '2026-02-17', complaint: '左下の奥歯がズキズキ痛む', treatment: '左下7番 抜髄処置、仮封', doctor: '佐藤', fee: 3800, note: '次回、根管治療を継続' },
  { id: 'V0008', patientId: 'P0002', date: '2026-03-03', complaint: '根管治療の続き', treatment: '左下7番 根管充填', doctor: '佐藤', fee: 3100, note: '金属アレルギーのため被せ物の材料は要相談' },

  // P0003 田中 一郎（5回）
  { id: 'V0009', patientId: 'P0003', date: '2024-11-05', complaint: '入れ歯が合わない', treatment: '下顎部分床義歯 調整', doctor: '佐藤', fee: 1800, note: '' },
  { id: 'V0010', patientId: 'P0003', date: '2024-12-10', complaint: '入れ歯が当たって痛い', treatment: '義歯調整', doctor: '佐藤', fee: 1200, note: '' },
  { id: 'V0011', patientId: 'P0003', date: '2025-06-18', complaint: '定期検診', treatment: '口腔内検査、スケーリング', doctor: '鈴木', fee: 2500, note: '' },
  { id: 'V0012', patientId: 'P0003', date: '2026-01-15', complaint: '右上の歯がぐらぐらする', treatment: '右上5番 抜歯', doctor: '佐藤', fee: 3600, note: '' },
  { id: 'V0013', patientId: 'P0003', date: '2026-01-22', complaint: '抜歯後の経過確認', treatment: '消毒、経過観察', doctor: '佐藤', fee: 800, note: '経過良好' },

  // P0004 小林 美咲（2回）
  { id: 'V0014', patientId: 'P0004', date: '2026-03-14', complaint: '学校検診で虫歯を指摘された', treatment: '口腔内検査、フッ素塗布', doctor: '高橋', fee: 1500, note: '保護者同伴' },
  { id: 'V0015', patientId: 'P0004', date: '2026-04-11', complaint: '虫歯の治療', treatment: '左下6番 CR充填', doctor: '高橋', fee: 1200, note: '保護者同伴' },

  // P0005 伊藤 健太（3回）
  { id: 'V0016', patientId: 'P0005', date: '2026-01-20', complaint: '右下の親知らずが痛い', treatment: 'レントゲン撮影、右下8番 消炎処置', doctor: '佐藤', fee: 2900, note: '' },
  { id: 'V0017', patientId: 'P0005', date: '2026-02-03', complaint: '親知らずの抜歯', treatment: '右下8番 抜歯', doctor: '佐藤', fee: 4200, note: '' },
  { id: 'V0018', patientId: 'P0005', date: '2026-02-10', complaint: '抜糸', treatment: '抜糸、消毒', doctor: '佐藤', fee: 900, note: '' },

  // P0006 渡辺 由美子（4回）
  { id: 'V0019', patientId: 'P0006', date: '2025-02-18', complaint: '定期検診', treatment: '口腔内検査、スケーリング', doctor: '鈴木', fee: 2400, note: '' },
  { id: 'V0020', patientId: 'P0006', date: '2025-05-20', complaint: '定期検診', treatment: '口腔内検査、スケーリング', doctor: '鈴木', fee: 2400, note: '' },
  { id: 'V0021', patientId: 'P0006', date: '2026-05-19', complaint: '詰め物が取れた', treatment: '右上6番 インレー再装着', doctor: '佐藤', fee: 2700, note: '' },
  { id: 'V0022', patientId: 'P0006', date: '2026-09-15', complaint: '定期検診', treatment: 'スケーリング、PMTC', doctor: '鈴木', fee: 2400, note: '' },

  // P0007 中村 翔（2回）
  { id: 'V0023', patientId: 'P0007', date: '2026-08-04', complaint: 'ホワイトニングの相談', treatment: '口腔内検査、カウンセリング', doctor: '高橋', fee: 3300, note: '自費診療の見積書をお渡し' },
  { id: 'V0024', patientId: 'P0007', date: '2026-09-29', complaint: '歯みがき時に歯ぐきから出血', treatment: '歯周検査、スケーリング', doctor: '鈴木', fee: 2600, note: '' },

  // P0008 加藤 千代子（4回）
  { id: 'V0025', patientId: 'P0008', date: '2025-09-30', complaint: '総入れ歯を作りたい', treatment: '上顎 印象採得', doctor: '佐藤', fee: 3200, note: '' },
  { id: 'V0026', patientId: 'P0008', date: '2025-10-21', complaint: '入れ歯の作製（2回目）', treatment: '咬合採得', doctor: '佐藤', fee: 1500, note: '' },
  { id: 'V0027', patientId: 'P0008', date: '2025-11-11', complaint: '入れ歯の装着', treatment: '上顎総義歯 装着', doctor: '佐藤', fee: 5800, note: '' },
  { id: 'V0028', patientId: 'P0008', date: '2026-07-08', complaint: '入れ歯が少し痛い', treatment: '義歯調整', doctor: '佐藤', fee: 1100, note: '' }
];
