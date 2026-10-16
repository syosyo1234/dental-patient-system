/* =========================================================
   患者管理システム - app.js

   このファイルの構成：
     1. 定数・アプリの状態
     2. データの読み込み・保存（localStorage）
     3. 便利な関数（日付・文字列・金額など）
     4. データの操作（検索・ID採番・集計）
     5. 画面の切り替え・メッセージ表示
     6. フォーム共通（エラー表示）
     7. 画面1：患者一覧
     8. 画面2：患者登録・編集フォーム
     9. 画面3：患者詳細（基本情報・来院履歴・費用集計）
    10. 画面4：来院記録の追加・編集フォーム
    11. 来院記録の削除
    12. 画面5・6：問診票受付（Supabase から取得・確認・患者登録）
    13. スタッフログイン（Supabase Authentication）
    14. デモデータに戻す
    15. 初期化（ページを開いたときに最初に実行）
   ========================================================= */

'use strict';

/* ---------------------------------------------------------
   1. 定数・アプリの状態
   --------------------------------------------------------- */

// localStorage に保存するときの「名前（キー）」
const STORAGE_KEY_PATIENTS = 'dentalClinic_patients';
const STORAGE_KEY_VISITS = 'dentalClinic_visits';
const STORAGE_KEY_COUNTERS = 'dentalClinic_counters';

// 費用の上限（入力ミスで桁を間違えたときに気付けるように）
const MAX_FEE = 9999999;

let patients = [];           // 患者基本情報の配列
let visits = [];             // 来院記録の配列（patientId で患者と紐付く）
// これまでに発行したIDの最大番号。来院記録を削除しても、そのIDを別の記録に再利用しないために使う
let lastIssued = { P: 0, V: 0 };
let storageError = false;    // true のときは保存しない（既存データを守るため）
let currentPatientId = null; // 詳細画面で表示中の患者ID
let editingPatientId = null; // 患者フォームで編集中の患者ID（null なら新規登録）
let editingVisitId = null;   // 来院記録フォームで編集中の記録ID（null なら新規追加）
let currentQuestionnaireId = null; // 問診票の確認画面で表示中の受付ID


/* ---------------------------------------------------------
   2. データの読み込み・保存（localStorage）
   --------------------------------------------------------- */

/**
 * localStorage からデータを読み込む。
 * - 初めて開いたとき（データが無いとき）はデモデータを使う。
 * - 読み込みに失敗したときは、既存データを上書きしないよう保存を停止する。
 */
function loadData() {
  let patientsText;
  let visitsText;
  let countersText;

  // ① localStorage そのものにアクセスできるか
  try {
    patientsText = localStorage.getItem(STORAGE_KEY_PATIENTS);
    visitsText = localStorage.getItem(STORAGE_KEY_VISITS);
    countersText = localStorage.getItem(STORAGE_KEY_COUNTERS);
  } catch (e) {
    storageError = true;
    showSystemMessage('ブラウザの保存領域（localStorage）にアクセスできません。ブラウザの設定を確認してください。現在、データは保存されません。');
    return;
  }

  // ② 初回起動：どちらのデータも存在しない → デモデータを使用
  if (patientsText === null && visitsText === null) {
    patients = copyData(DEMO_PATIENTS);
    visits = copyData(DEMO_VISITS);
    saveData();
    return;
  }

  // ③ 保存済みデータを JSON 文字列から配列に戻す
  try {
    const loadedPatients = patientsText ? JSON.parse(patientsText) : [];
    const loadedVisits = visitsText ? JSON.parse(visitsText) : [];
    // 以前のバージョンで保存したデータには counters が無いので、その場合は 0 から
    const loadedCounters = countersText ? JSON.parse(countersText) : { P: 0, V: 0 };

    if (!Array.isArray(loadedPatients) || !Array.isArray(loadedVisits) ||
        typeof loadedCounters !== 'object' || loadedCounters === null) {
      throw new Error('データの形式が正しくありません');
    }

    patients = loadedPatients;
    visits = loadedVisits;
    lastIssued = { P: Number(loadedCounters.P) || 0, V: Number(loadedCounters.V) || 0 };
  } catch (e) {
    // 壊れたデータでも勝手に消したり上書きしたりしない
    storageError = true;
    patients = [];
    visits = [];
    showSystemMessage('保存データの読み込みに失敗しました。既存のデータを保護するため、保存機能を停止しています。（詳細：' + e.message + '）');
  }
}

/**
 * 現在のデータを localStorage に保存する。
 * 成功したら true、失敗したら false を返す。
 */
function saveData() {
  if (storageError) {
    alert('保存データの読み込みに失敗しているため、保存できません。\n既存のデータを上書きしないよう、保存を停止しています。');
    return false;
  }

  try {
    // localStorage には文字列しか保存できないので JSON 文字列に変換する
    localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(patients));
    localStorage.setItem(STORAGE_KEY_VISITS, JSON.stringify(visits));
    localStorage.setItem(STORAGE_KEY_COUNTERS, JSON.stringify(lastIssued));
    return true;
  } catch (e) {
    alert('データの保存に失敗しました。ブラウザの保存容量や設定を確認してください。');
    return false;
  }
}

/** 配列・オブジェクトを丸ごとコピーする（デモデータの原本を変更しないため） */
function copyData(data) {
  return JSON.parse(JSON.stringify(data));
}


/* ---------------------------------------------------------
   3. 便利な関数
   --------------------------------------------------------- */

/**
 * HTML として特別な意味を持つ文字を変換する。
 * 入力された文字をそのまま innerHTML に入れると表示が崩れたり、
 * 不正なスクリプトが動いたりするのを防ぐ。
 */
function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 今日の日付を "YYYY-MM-DD" 形式で返す（日本時間＝パソコンの時刻で計算） */
function todayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

/** "2026-10-01" → "2026/10/01"。空のときは "—" */
function formatDate(dateStr) {
  if (!dateStr) {
    return '—';
  }
  return dateStr.replace(/-/g, '/');
}

/** 3500 → "¥3,500"（3桁ごとにカンマ） */
function formatYen(amount) {
  return '¥' + Number(amount || 0).toLocaleString('ja-JP');
}

/** "YYYY-MM-DD" 形式で、実在する日付かどうかを調べる（例：2026-02-30 は false） */
function isValidDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const parts = dateStr.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** 生年月日から今日時点の年齢を計算する */
function calcAge(birthDate) {
  if (!isValidDate(birthDate)) {
    return null;
  }
  const today = todayString();
  let age = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
  // 今年の誕生日がまだ来ていなければ 1 引く（"MM-DD" の文字列比較）
  if (today.slice(5) < birthDate.slice(5)) {
    age--;
  }
  return age;
}

/** 検索用に文字列を整える：空白（半角・全角）を除き、英字を小文字にする */
function normalizeForSearch(text) {
  return String(text || '').replace(/[\s　]/g, '').toLowerCase();
}

/** 全角の数字を半角に変換する（例："３５００" → "3500"） */
function toHalfWidthDigits(text) {
  return text.replace(/[０-９]/g, function (ch) {
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  });
}

/** 電話番号用：全角数字・全角ハイフンを半角に変換する */
function toHalfWidthPhone(text) {
  return toHalfWidthDigits(text).replace(/[－ー−‐]/g, '-');
}

/** 費用用：全角を半角にし、「¥」「円」「,」を取り除く（例："￥3,500円" → "3500"） */
function cleanFeeText(text) {
  return toHalfWidthDigits(text)
    .replace(/[－ー−‐]/g, '-')
    .replace(/[¥￥円,，\s]/g, '');
}


/* ---------------------------------------------------------
   4. データの操作
   --------------------------------------------------------- */

/** 患者IDから患者を探す。見つからなければ undefined */
function findPatient(patientId) {
  return patients.find(function (p) {
    return p.id === patientId;
  });
}

/** 記録IDから来院記録を探す。見つからなければ undefined */
function findVisit(visitId) {
  return visits.find(function (v) {
    return v.id === visitId;
  });
}

/**
 * 新しいIDを作る。
 *   generateId('P', patients) → 'P0009'
 *   generateId('V', visits)   → 'V0029'
 * 「既存IDの最大番号」と「これまでに発行した最大番号」の大きい方 + 1 にする。
 * こうすると、削除した患者のIDが別の患者に再利用されることはない。
 */
function generateId(prefix, list) {
  let maxNumber = lastIssued[prefix] || 0;
  list.forEach(function (item) {
    const num = parseInt(String(item.id).slice(prefix.length), 10);
    if (!isNaN(num) && num > maxNumber) {
      maxNumber = num;
    }
  });

  let newNumber = maxNumber + 1;
  let newId = prefix + String(newNumber).padStart(4, '0');
  while (list.some(function (item) { return item.id === newId; })) {
    newNumber++;
    newId = prefix + String(newNumber).padStart(4, '0');
  }
  return newId;
}

/** IDを発行したことを記録する（例：'P0009' → lastIssued.P = 9） */
function markIdIssued(id) {
  const prefix = id.charAt(0);
  const num = parseInt(id.slice(1), 10);
  if (num > (lastIssued[prefix] || 0)) {
    lastIssued[prefix] = num;
  }
}

/**
 * 指定した患者の来院記録だけを取り出し、来院日の新しい順に並べて返す。
 * （同じ日の記録は、後から登録したものを上にする）
 */
function getPatientVisits(patientId) {
  const list = visits.filter(function (v) {
    return v.patientId === patientId;
  });
  list.sort(function (a, b) {
    if (a.date !== b.date) {
      return a.date < b.date ? 1 : -1;
    }
    return a.id < b.id ? 1 : -1;
  });
  return list;
}

/**
 * 患者の最終来院日を、来院記録から計算する。
 * 記録が無い場合は空文字を返す。
 * （"YYYY-MM-DD" 形式なので、文字列のまま大小比較できる）
 */
function getLastVisitDate(patientId) {
  let last = '';
  visits.forEach(function (v) {
    if (v.patientId === patientId && v.date > last) {
      last = v.date;
    }
  });
  return last;
}

/**
 * 患者の来院回数・累計診療費・最終来院日を計算する。
 * 毎回すべての来院記録から計算し直すので、記録を追加・修正すると自動で正しい値になる。
 */
function getVisitStats(patientId) {
  const list = getPatientVisits(patientId);
  // reduce：配列の値を1つずつ足し合わせて合計を出す
  const totalFee = list.reduce(function (sum, v) {
    return sum + (Number(v.fee) || 0);
  }, 0);
  return {
    count: list.length,
    totalFee: totalFee,
    lastVisitDate: list.length > 0 ? list[0].date : '' // 新しい順に並んでいるので先頭が最終来院日
  };
}

/** これまでに入力された担当医名の一覧（重複なし） */
function getDoctorNames() {
  const names = [];
  visits.forEach(function (v) {
    if (v.doctor && names.indexOf(v.doctor) === -1) {
      names.push(v.doctor);
    }
  });
  return names.sort(function (a, b) {
    return a.localeCompare(b, 'ja');
  });
}


/* ---------------------------------------------------------
   5. 画面の切り替え・メッセージ表示
   --------------------------------------------------------- */

const VIEW_NAMES = ['login', 'list', 'patient-form', 'detail', 'visit-form', 'questionnaires', 'questionnaire-detail'];

/** 指定した画面だけを表示する */
function showView(viewName) {
  VIEW_NAMES.forEach(function (name) {
    document.getElementById('view-' + name).hidden = (name !== viewName);
  });
  hideFlash();
  window.scrollTo(0, 0);
}

/** 画面上部に操作結果を表示する（type: 'success' または 'error'） */
function showFlash(message, type) {
  const box = document.getElementById('flashMessage');
  box.textContent = message;
  box.className = 'alert alert-' + (type || 'success');
  box.hidden = false;
}

function hideFlash() {
  document.getElementById('flashMessage').hidden = true;
}

/** データ読み込みエラーなど、重要なお知らせを表示する（消えない） */
function showSystemMessage(message) {
  const box = document.getElementById('systemMessage');
  box.textContent = message;
  box.hidden = false;
}

function hideSystemMessage() {
  document.getElementById('systemMessage').hidden = true;
}

/** ヘッダーに今日の日付を表示する（例：2026年10月8日（木）） */
function renderHeaderDate() {
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const now = new Date();
  document.getElementById('headerDate').textContent =
    now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日（' + weekdays[now.getDay()] + '）';
}


/* ---------------------------------------------------------
   6. フォーム共通（エラー表示）
   患者フォームと来院記録フォームの両方で使う。
   form: { formId, summaryId, fields: { 項目名: 入力欄のid } }
   --------------------------------------------------------- */

/** エラーメッセージを各入力欄の下に表示する */
function showFormErrors(form, errors) {
  clearFormErrors(form);
  const formEl = document.getElementById(form.formId);
  const keys = Object.keys(errors);

  keys.forEach(function (key) {
    const errorBox = formEl.querySelector('[data-error-for="' + key + '"]');
    if (errorBox) {
      errorBox.textContent = errors[key];
    }
    const input = document.getElementById(form.fields[key]);
    if (input) {
      input.classList.add('is-invalid');
    }
  });

  const summary = document.getElementById(form.summaryId);
  summary.textContent = '入力内容に誤りがあります（' + keys.length + '件）。赤く表示された項目を確認してください。';
  summary.hidden = false;

  // 最初のエラー項目にカーソルを移動
  const firstInput = document.getElementById(form.fields[keys[0]]);
  if (firstInput) {
    firstInput.focus();
  }
}

function clearFormErrors(form) {
  const formEl = document.getElementById(form.formId);
  formEl.querySelectorAll('.field-error').forEach(function (box) {
    box.textContent = '';
  });
  formEl.querySelectorAll('.is-invalid').forEach(function (input) {
    input.classList.remove('is-invalid');
  });
  document.getElementById(form.summaryId).hidden = true;
}

/** 入力欄に値を入れる（無い項目は空にする） */
function fillFormFields(form, data) {
  clearFormErrors(form);
  Object.keys(form.fields).forEach(function (key) {
    const value = data[key];
    document.getElementById(form.fields[key]).value = (value === undefined || value === null) ? '' : value;
  });
}

/** 入力欄から値を取り出す（前後の空白は取り除く） */
function readFormFields(form) {
  const data = {};
  Object.keys(form.fields).forEach(function (key) {
    data[key] = document.getElementById(form.fields[key]).value.trim();
  });
  return data;
}

/**
 * 日付欄に途中までしか入力されていない場合、value は空になるため
 * validity.badInput で「形式が正しくない入力」かどうかを調べる。
 */
function hasBadDateInput(inputId) {
  return document.getElementById(inputId).validity.badInput;
}


/* ---------------------------------------------------------
   7. 画面1：患者一覧
   --------------------------------------------------------- */

function showListView() {
  showView('list');
  renderPatientList();
  updateQuestionnaireBadge();
}

/** 検索キーワードに合う患者を、最終来院日の新しい順で表に表示する */
function renderPatientList() {
  const keyword = normalizeForSearch(document.getElementById('searchInput').value);

  // ① 表示用データを作る（患者 + 最終来院日）
  let rows = patients.map(function (p) {
    return { patient: p, lastVisitDate: getLastVisitDate(p.id) };
  });

  // ② 検索（氏名・フリガナ・患者IDのどれかに含まれていれば表示）
  if (keyword !== '') {
    rows = rows.filter(function (row) {
      const p = row.patient;
      return normalizeForSearch(p.name).includes(keyword) ||
             normalizeForSearch(p.kana).includes(keyword) ||
             normalizeForSearch(p.id).includes(keyword);
    });
  }

  // ③ 並べ替え：最終来院日の新しい順。同じ日（または来院なし）は患者ID順
  rows.sort(function (a, b) {
    if (a.lastVisitDate !== b.lastVisitDate) {
      return a.lastVisitDate < b.lastVisitDate ? 1 : -1;
    }
    return a.patient.id < b.patient.id ? -1 : 1;
  });

  // ④ 表の HTML を作る
  const tbody = document.getElementById('patientTableBody');
  if (rows.length === 0) {
    const message = keyword !== '' ? '該当する患者が見つかりません。' : '登録されている患者はいません。';
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">' + message + '</td></tr>';
  } else {
    tbody.innerHTML = rows.map(function (row) {
      const p = row.patient;
      return '<tr>' +
        '<td class="cell-nowrap">' + escapeHtml(p.id) + '</td>' +
        '<td>' +
          '<a href="#" class="patient-link" data-id="' + escapeHtml(p.id) + '">' + escapeHtml(p.name) + '</a>' +
          (p.kana ? '<span class="kana">' + escapeHtml(p.kana) + '</span>' : '') +
        '</td>' +
        '<td class="cell-nowrap">' + formatDate(p.birthDate) + '</td>' +
        '<td class="cell-nowrap">' + (p.phone ? escapeHtml(p.phone) : '—') + '</td>' +
        '<td class="cell-nowrap">' + formatDate(p.firstVisitDate) + '</td>' +
        '<td class="cell-nowrap">' + formatDate(row.lastVisitDate) + '</td>' +
      '</tr>';
    }).join('');
  }

  // ⑤ 人数表示
  const countBox = document.getElementById('patientCount');
  if (keyword !== '') {
    countBox.innerHTML = '検索結果 <strong>' + rows.length + '</strong> 名 ／ 登録患者数 ' + patients.length + ' 名';
  } else {
    countBox.innerHTML = '登録患者数 <strong>' + patients.length + '</strong> 名';
  }
}


/* ---------------------------------------------------------
   8. 画面2：患者登録・編集フォーム
   --------------------------------------------------------- */

const PATIENT_FORM = {
  formId: 'patientForm',
  summaryId: 'patientFormErrorSummary',
  // 項目名と、入力欄の id の対応表
  fields: {
    name: 'f-name',
    kana: 'f-kana',
    birthDate: 'f-birthDate',
    phone: 'f-phone',
    address: 'f-address',
    firstVisitDate: 'f-firstVisitDate',
    note: 'f-note'
  }
};

/** 新規登録フォームを開く */
function openNewPatientForm() {
  editingPatientId = null;
  document.getElementById('formTitle').textContent = '新規患者登録';
  document.getElementById('btnSubmitForm').textContent = '登録';
  document.getElementById('f-idDisplay').textContent = generateId('P', patients) + '（登録時に自動採番）';
  fillPatientForm({ firstVisitDate: todayString() }); // 初診日は今日をあらかじめ入れておく
  showView('patient-form');
  document.getElementById('f-name').focus();
}

/** 編集フォームを開く（今の情報を入力欄に入れておく） */
function openEditPatientForm(patientId) {
  const patient = findPatient(patientId);
  if (!patient) {
    showListView();
    showFlash('患者が見つかりません。', 'error');
    return;
  }
  editingPatientId = patientId;
  document.getElementById('formTitle').textContent = '患者基本情報の編集';
  document.getElementById('btnSubmitForm').textContent = '更新';
  document.getElementById('f-idDisplay').textContent = patient.id;
  fillPatientForm(patient);
  showView('patient-form');
  document.getElementById('f-name').focus();
}

/** 患者フォームに値を入れる（性別はラジオボタンなので別に設定） */
function fillPatientForm(data) {
  fillFormFields(PATIENT_FORM, data);
  const gender = data.gender || '';
  document.querySelectorAll('input[name="gender"]').forEach(function (radio) {
    radio.checked = (radio.value === gender);
  });
}

/** 患者フォームから値を取り出す */
function readPatientForm() {
  const data = readFormFields(PATIENT_FORM);
  data.phone = toHalfWidthPhone(data.phone);
  const checked = document.querySelector('input[name="gender"]:checked');
  data.gender = checked ? checked.value : '';
  return data;
}

/**
 * 患者フォームの入力内容をチェックする。
 * エラーがあれば { 項目名: 'メッセージ' } の形で返す。エラーが無ければ空のオブジェクト。
 */
function validatePatientForm(data) {
  const errors = {};
  const today = todayString();

  // 氏名（必須）
  // 外国籍の患者も来院するため、使える文字の種類（漢字・カタカナ・英字など）は制限しない
  if (data.name === '') {
    errors.name = '氏名を入力してください。';
  }

  // 生年月日（任意）
  if (hasBadDateInput('f-birthDate') || (data.birthDate !== '' && !isValidDate(data.birthDate))) {
    errors.birthDate = '生年月日の日付の形式が正しくありません。';
  } else if (data.birthDate > today) {
    errors.birthDate = '生年月日に未来の日付は入力できません。';
  }

  // 電話番号（任意・数字とハイフン）
  if (data.phone !== '' && !/^[0-9-]+$/.test(data.phone)) {
    errors.phone = '電話番号は数字とハイフン（-）で入力してください。';
  }

  // 初診日（必須）
  if (hasBadDateInput('f-firstVisitDate') || (data.firstVisitDate !== '' && !isValidDate(data.firstVisitDate))) {
    errors.firstVisitDate = '初診日の日付の形式が正しくありません。';
  } else if (data.firstVisitDate === '') {
    errors.firstVisitDate = '初診日を入力してください。';
  } else if (data.birthDate !== '' && !errors.birthDate && data.firstVisitDate < data.birthDate) {
    errors.firstVisitDate = '初診日が生年月日より前の日付になっています。';
  }

  return errors;
}

/** 「登録」「更新」ボタンが押されたときの処理 */
function handlePatientFormSubmit(event) {
  event.preventDefault(); // フォーム送信によるページ再読み込みを止める

  const data = readPatientForm();
  const errors = validatePatientForm(data);
  if (Object.keys(errors).length > 0) {
    showFormErrors(PATIENT_FORM, errors);
    return;
  }

  if (editingPatientId === null) {
    registerPatient(data);
  } else {
    updatePatient(editingPatientId, data);
  }
}

/** 新しい患者を登録する */
function registerPatient(data) {
  const now = new Date().toISOString();
  const newPatient = {
    id: generateId('P', patients),
    name: data.name,
    kana: data.kana,
    birthDate: data.birthDate,
    gender: data.gender,
    phone: data.phone,
    address: data.address,
    firstVisitDate: data.firstVisitDate,
    note: data.note,
    createdAt: now,
    updatedAt: now
  };

  const issuedBackup = copyData(lastIssued);
  patients.push(newPatient);
  markIdIssued(newPatient.id);
  if (!saveData()) {
    patients.pop(); // 保存できなかったら追加を取り消す
    lastIssued = issuedBackup;
    return;
  }

  document.getElementById('searchInput').value = '';
  showListView();
  showFlash('患者「' + newPatient.name + '」を登録しました。（患者ID：' + newPatient.id + '）', 'success');
}

/** 既存の患者情報を更新する（患者IDは変更しない） */
function updatePatient(patientId, data) {
  const patient = findPatient(patientId);
  if (!patient) {
    showListView();
    showFlash('患者が見つかりません。', 'error');
    return;
  }

  const backup = copyData(patient); // 保存失敗時に元に戻すための控え

  patient.name = data.name;
  patient.kana = data.kana;
  patient.birthDate = data.birthDate;
  patient.gender = data.gender;
  patient.phone = data.phone;
  patient.address = data.address;
  patient.firstVisitDate = data.firstVisitDate;
  patient.note = data.note;
  patient.updatedAt = new Date().toISOString();

  if (!saveData()) {
    Object.assign(patient, backup);
    return;
  }

  openPatientDetail(patientId);
  showFlash('患者基本情報を更新しました。', 'success');
}

/** 「キャンセル」：編集中なら詳細画面へ、新規なら一覧へ戻る */
function cancelPatientForm() {
  if (editingPatientId !== null) {
    openPatientDetail(editingPatientId);
  } else {
    showListView();
  }
}


/* ---------------------------------------------------------
   9. 画面3：患者詳細（基本情報・来院履歴・費用集計）
   --------------------------------------------------------- */

function openPatientDetail(patientId) {
  currentPatientId = patientId;
  showView('detail');
  renderPatientDetail();
}

function renderPatientDetail() {
  const p = findPatient(currentPatientId);
  if (!p) {
    showListView();
    showFlash('患者が見つかりません。', 'error');
    return;
  }

  document.getElementById('detailTitle').textContent = '患者詳細：' + p.name;
  renderPatientInfo(p);
  renderVisitStats(p.id);
  renderVisitHistory(p.id);
  renderPatientQuestionnaires(p.id);
}

/** 患者基本情報 */
function renderPatientInfo(p) {
  const age = calcAge(p.birthDate);
  const birthText = p.birthDate ? formatDate(p.birthDate) + (age !== null ? '（' + age + '歳）' : '') : '';

  // 表示する項目の一覧（wide: 横幅いっぱい / multiline: 改行をそのまま表示）
  const items = [
    { label: '患者ID', value: p.id },
    { label: '氏名', value: p.name },
    { label: 'フリガナ', value: p.kana },
    { label: '生年月日', value: birthText },
    { label: '性別', value: p.gender },
    { label: '電話番号', value: p.phone },
    { label: '初診日', value: p.firstVisitDate ? formatDate(p.firstVisitDate) : '' },
    { label: '', value: null }, // 2列表示のレイアウト調整用の空欄
    { label: '住所', value: p.address, wide: true },
    { label: '備考', value: p.note, wide: true, multiline: true }
  ];

  document.getElementById('patientInfo').innerHTML = items.map(function (item) {
    if (item.value === null) {
      return '<div class="info-item info-spacer"><dt></dt><dd></dd></div>';
    }
    const valueHtml = item.value ? escapeHtml(item.value) : '<span class="text-muted">—</span>';
    return '<div class="info-item' + (item.wide ? ' wide' : '') + '">' +
      '<dt>' + item.label + '</dt>' +
      '<dd' + (item.multiline ? ' class="multiline"' : '') + '>' + valueHtml + '</dd>' +
    '</div>';
  }).join('');
}

/** 来院回数・累計診療費・最終来院日 */
function renderVisitStats(patientId) {
  const stats = getVisitStats(patientId);
  document.getElementById('visitStats').innerHTML =
    '<div class="stat-item"><dt>来院回数</dt><dd>' + stats.count + '<span class="stat-unit">回</span></dd></div>' +
    '<div class="stat-item"><dt>累計診療費</dt><dd>' + formatYen(stats.totalFee) + '</dd></div>' +
    '<div class="stat-item"><dt>最終来院日</dt><dd>' + formatDate(stats.lastVisitDate) + '</dd></div>';
}

/** 来院履歴の表（新しい順） */
function renderVisitHistory(patientId) {
  const list = getPatientVisits(patientId);
  const tbody = document.getElementById('visitTableBody');

  if (list.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">来院記録はまだありません。「＋ 来院記録を追加」から登録してください。</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(function (v) {
    return '<tr>' +
      '<td class="cell-nowrap">' + formatDate(v.date) + '</td>' +
      '<td class="cell-multiline">' + (v.complaint ? escapeHtml(v.complaint) : '—') + '</td>' +
      '<td class="cell-multiline">' + (v.treatment ? escapeHtml(v.treatment) : '—') + '</td>' +
      '<td class="cell-nowrap">' + (v.doctor ? escapeHtml(v.doctor) : '—') + '</td>' +
      '<td class="cell-fee">' + formatYen(v.fee) + '</td>' +
      '<td class="cell-multiline">' + (v.note ? escapeHtml(v.note) : '') + '</td>' +
      '<td class="cell-action">' +
        // data-visit-id：どの記録の「編集」ボタンかを、記録IDで区別する
        '<button type="button" class="btn btn-sm btn-secondary btn-edit-visit" data-visit-id="' + escapeHtml(v.id) + '">編集</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}


/* ---------------------------------------------------------
   10. 画面4：来院記録の追加・編集フォーム
   --------------------------------------------------------- */

const VISIT_FORM = {
  formId: 'visitForm',
  summaryId: 'visitFormErrorSummary',
  fields: {
    date: 'v-date',
    complaint: 'v-complaint',
    treatment: 'v-treatment',
    doctor: 'v-doctor',
    fee: 'v-fee',
    note: 'v-note'
  }
};

/** フォーム上部に「どの患者の記録か」を表示し、担当医の候補を準備する */
function prepareVisitForm(patient) {
  document.getElementById('v-patientDisplay').textContent = patient.name + '（' + patient.id + '）';
  document.getElementById('doctorList').innerHTML = getDoctorNames().map(function (name) {
    return '<option value="' + escapeHtml(name) + '"></option>';
  }).join('');
}

/** 「＋ 来院記録を追加」 */
function openNewVisitForm() {
  const patient = findPatient(currentPatientId);
  if (!patient) {
    showListView();
    showFlash('患者が見つかりません。', 'error');
    return;
  }
  editingVisitId = null;
  document.getElementById('visitFormTitle').textContent = '来院記録の追加';
  document.getElementById('deleteVisitArea').hidden = true; // 新規追加では削除ボタンを出さない
  document.getElementById('v-idDisplay').textContent = generateId('V', visits) + '（保存時に自動採番）';
  prepareVisitForm(patient);
  fillFormFields(VISIT_FORM, { date: todayString() }); // 来院日は今日をあらかじめ入れておく
  showView('visit-form');
  document.getElementById('v-complaint').focus();
}

/** 来院履歴の「編集」 */
function openEditVisitForm(visitId) {
  const visit = findVisit(visitId);
  const patient = findPatient(currentPatientId);
  // 表示中の患者の記録であることを必ず確認する（別の患者の記録を書き換えないため）
  if (!visit || !patient || visit.patientId !== patient.id) {
    showFlash('来院記録が見つかりません。', 'error');
    return;
  }
  editingVisitId = visitId;
  document.getElementById('visitFormTitle').textContent = '来院記録の編集';
  document.getElementById('deleteVisitArea').hidden = false; // 編集時のみ削除ボタンを表示
  document.getElementById('v-idDisplay').textContent = visit.id;
  prepareVisitForm(patient);
  fillFormFields(VISIT_FORM, {
    date: visit.date,
    complaint: visit.complaint,
    treatment: visit.treatment,
    doctor: visit.doctor,
    fee: String(visit.fee),
    note: visit.note
  });
  showView('visit-form');
  document.getElementById('v-date').focus();
}

/**
 * 来院記録フォームの入力内容をチェックする。
 * 問題が無ければ data.fee を数値（整数）に変換しておく。
 */
function validateVisitForm(data) {
  const errors = {};
  const patient = findPatient(currentPatientId);

  // 来院日（必須・正しい日付・未来日不可・生年月日より後）
  if (hasBadDateInput('v-date') || (data.date !== '' && !isValidDate(data.date))) {
    errors.date = '来院日の日付の形式が正しくありません。';
  } else if (data.date === '') {
    errors.date = '来院日を入力してください。';
  } else if (data.date > todayString()) {
    errors.date = '来院日に未来の日付は入力できません。';
  } else if (patient && patient.birthDate && data.date < patient.birthDate) {
    errors.date = '来院日が患者の生年月日より前の日付になっています。';
  }

  // 費用（必須・0以上の整数）
  const feeText = cleanFeeText(data.fee);
  if (feeText === '') {
    errors.fee = '費用を入力してください。（費用が発生しない場合は 0 を入力）';
  } else if (feeText.charAt(0) === '-') {
    errors.fee = '費用にマイナスの金額は入力できません。';
  } else if (!/^\d+$/.test(feeText)) {
    errors.fee = '費用は0以上の整数（数字のみ）で入力してください。';
  } else if (Number(feeText) > MAX_FEE) {
    errors.fee = '費用が大きすぎます。金額を確認してください。';
  } else {
    data.fee = Number(feeText); // 例："3,500" → 3500
  }

  return errors;
}

/** 「保存」ボタンが押されたときの処理 */
function handleVisitFormSubmit(event) {
  event.preventDefault();

  const data = readFormFields(VISIT_FORM);
  const errors = validateVisitForm(data);
  if (Object.keys(errors).length > 0) {
    showFormErrors(VISIT_FORM, errors);
    return;
  }

  if (editingVisitId === null) {
    addVisit(data);
  } else {
    updateVisit(editingVisitId, data);
  }
}

/** 来院記録を追加する（表示中の患者IDと自動で紐付ける） */
function addVisit(data) {
  const now = new Date().toISOString();
  const newVisit = {
    id: generateId('V', visits),
    patientId: currentPatientId,
    date: data.date,
    complaint: data.complaint,
    treatment: data.treatment,
    doctor: data.doctor,
    fee: data.fee,
    note: data.note,
    createdAt: now,
    updatedAt: now
  };

  const issuedBackup = copyData(lastIssued);
  visits.push(newVisit);
  markIdIssued(newVisit.id);
  if (!saveData()) {
    visits.pop(); // 保存できなかったら追加を取り消す
    lastIssued = issuedBackup;
    return;
  }

  openPatientDetail(currentPatientId);
  showFlash('来院記録を追加しました。（来院日：' + formatDate(newVisit.date) + '）', 'success');
}

/** 来院記録を更新する（記録ID・患者IDは変更しない） */
function updateVisit(visitId, data) {
  const visit = findVisit(visitId);
  if (!visit || visit.patientId !== currentPatientId) {
    openPatientDetail(currentPatientId);
    showFlash('来院記録が見つかりません。', 'error');
    return;
  }

  const backup = copyData(visit);

  visit.date = data.date;
  visit.complaint = data.complaint;
  visit.treatment = data.treatment;
  visit.doctor = data.doctor;
  visit.fee = data.fee;
  visit.note = data.note;
  visit.updatedAt = new Date().toISOString();

  if (!saveData()) {
    Object.assign(visit, backup);
    return;
  }

  openPatientDetail(currentPatientId);
  showFlash('来院記録を更新しました。（来院日：' + formatDate(visit.date) + '）', 'success');
}


/* ---------------------------------------------------------
   11. 来院記録の削除（「来院記録の編集」画面から実行）
   --------------------------------------------------------- */

/** 来院記録を1件だけ削除する（記録IDで対象を特定する） */
function deleteVisit() {
  const visit = findVisit(editingVisitId);
  // 表示中の患者の記録であることを必ず確認する（別の患者の記録を消さないため）
  if (!visit || visit.patientId !== currentPatientId) {
    openPatientDetail(currentPatientId);
    showFlash('来院記録が見つかりません。', 'error');
    return;
  }

  const ok = confirm(
    '次の来院記録を削除します。\n\n' +
    '　来院日：' + formatDate(visit.date) + '\n' +
    '　診療内容：' + (visit.treatment || '（未入力）') + '\n' +
    '　費用：' + formatYen(visit.fee) + '\n\n' +
    '削除した記録は元に戻せません。よろしいですか？'
  );
  if (!ok) {
    return;
  }

  const visitsBackup = visits;
  visits = visits.filter(function (v) {
    return v.id !== visit.id;
  });

  if (!saveData()) {
    visits = visitsBackup;
    return;
  }

  editingVisitId = null;
  // 詳細画面に戻ると、来院回数・累計診療費・最終来院日は自動で再計算される
  openPatientDetail(currentPatientId);
  showFlash('来院記録（来院日：' + formatDate(visit.date) + '）を削除しました。', 'success');
}


/* ---------------------------------------------------------
   12. 画面5・6：問診票受付（Supabase から取得・確認・患者登録）

   問診票は Supabase の questionnaires テーブルにある。
   ログインしたスタッフ（clinic_staff に登録された人）だけが読み書きできる（Supabase の RLS で制限）。
   新しい問診票は「最新の情報に更新」ボタンで取得する。

   画面で使う問診票 1 件のデータ：
     { id, submittedAt, status, patientId, answers }
     status：'unconfirmed'（未確認）→ 'confirmed'（確認済み）→ 'registered'（患者登録済み）
     patientId：患者として登録・紐付けしたときの患者ID（患者データはこのパソコンの localStorage）
   --------------------------------------------------------- */

let questionnaires = [];   // Supabase から取得した問診票（新しい順）

const QUESTIONNAIRE_COLUMNS = 'id, submitted_at, status, answers, patient_id';

/** データベースの 1 行を、画面で使う形に変換する */
function toQuestionnaire(row) {
  return {
    id: row.id,
    submittedAt: row.submitted_at,
    status: row.status,
    patientId: row.patient_id,
    answers: row.answers || {}
  };
}

/** Supabase から問診票の一覧を取得する。成功したら true */
async function fetchQuestionnaires() {
  const errorBox = document.getElementById('questionnaireError');
  const { data, error } = await supabaseClient
    .from('questionnaires')
    .select(QUESTIONNAIRE_COLUMNS)
    .order('submitted_at', { ascending: false });

  if (error) {
    errorBox.textContent = '問診票を取得できませんでした。通信状態を確認して、「最新の情報に更新」を押してください。（' + error.message + '）';
    errorBox.hidden = false;
    return false;
  }
  errorBox.hidden = true;
  questionnaires = data.map(toQuestionnaire);
  updateQuestionnaireBadge();
  return true;
}

/** 1 件だけ最新の状態を取得する（登録の直前に、すでに登録済みになっていないか確認するため） */
async function fetchQuestionnaire(questionnaireId) {
  const { data, error } = await supabaseClient
    .from('questionnaires')
    .select(QUESTIONNAIRE_COLUMNS)
    .eq('id', questionnaireId)
    .maybeSingle();
  return (error || !data) ? null : toQuestionnaire(data);
}

/** 問診票の受付状況などを Supabase で更新する。成功したら true */
async function updateQuestionnaire(questionnaireId, fields) {
  const { data, error } = await supabaseClient
    .from('questionnaires')
    .update(fields)
    .eq('id', questionnaireId)
    .select('id');
  // 権限がない場合は、エラーにならずに「0 件更新」になることがあるため、件数も確認する
  if (error || !data || data.length !== 1) {
    alert('問診票を更新できませんでした。通信状態とログイン状態を確認してください。');
    return false;
  }
  return true;
}

function findQuestionnaire(questionnaireId) {
  return questionnaires.find(function (q) {
    return q.id === questionnaireId;
  });
}

/** 取得し直した問診票で、手元の一覧の該当行を置き換える */
function replaceQuestionnaire(q) {
  const index = questionnaires.findIndex(function (item) {
    return item.id === q.id;
  });
  if (index === -1) {
    questionnaires.unshift(q);
  } else {
    questionnaires[index] = q;
  }
  updateQuestionnaireBadge();
}

/** "2026-10-09T05:05:00.000Z" → "2026/10/09 14:05"（パソコンの時刻で表示） */
function formatDateTime(isoString) {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) {
    return '—';
  }
  const pad = function (n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + ' ' +
    pad(d.getHours()) + ':' + pad(d.getMinutes());
}

/** 受付日時から、その日の日付 "YYYY-MM-DD" を作る（初診日に使う） */
function dateFromIso(isoString) {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) {
    return todayString();
  }
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** 受付状況の表示（色付きのラベル） */
function statusBadgeHtml(status) {
  return '<span class="status-badge status-' + escapeHtml(status) + '">' +
    escapeHtml(QUESTIONNAIRE_STATUS[status] || status) + '</span>';
}

/** 患者一覧の「問診票受付」ボタンに、未確認の件数を表示する（最後に取得した内容から数える） */
function updateQuestionnaireBadge() {
  const count = questionnaires.filter(function (q) {
    return q.status === 'unconfirmed';
  }).length;
  const badge = document.getElementById('questionnaireBadge');
  badge.textContent = '未確認 ' + count;
  badge.hidden = (count === 0);
}

/* ----- 画面5：問診票の一覧 ----- */

async function showQuestionnaireList() {
  showView('questionnaires');
  renderQuestionnaireList();          // まず手元の内容を表示し、
  await refreshQuestionnaireList();   // 最新の内容を取得して表示し直す
}

/** 「最新の情報に更新」 */
async function refreshQuestionnaireList() {
  const button = document.getElementById('btnRefreshQuestionnaires');
  button.disabled = true;
  button.textContent = '更新中…';
  await fetchQuestionnaires();
  button.disabled = false;
  button.textContent = '最新の情報に更新';
  renderQuestionnaireList();
}

function renderQuestionnaireList() {
  const tbody = document.getElementById('questionnaireTableBody');
  if (questionnaires.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">受信した問診票はまだありません。</td></tr>';
    return;
  }

  tbody.innerHTML = questionnaires.map(function (q) {
    const a = q.answers;
    const registeredText = (q.status === 'registered' && q.patientId)
      ? '<span class="status-patient">' + escapeHtml(q.patientId) + '</span>'
      : '';
    return '<tr class="' + (q.status === 'unconfirmed' ? 'is-unconfirmed' : '') + '">' +
      '<td class="cell-nowrap">' + formatDateTime(q.submittedAt) + '</td>' +
      '<td><a href="#" class="patient-link" data-qid="' + escapeHtml(q.id) + '">' + escapeHtml(a.name) + '</a>' +
        (a.kana ? '<span class="kana">' + escapeHtml(a.kana) + '</span>' : '') + '</td>' +
      '<td>' + escapeHtml(joinWithOther(a.purposes, a.purposeOther)) + '</td>' +
      '<td class="cell-nowrap">' + statusBadgeHtml(q.status) + registeredText + '</td>' +
      '<td class="cell-action"><button type="button" class="btn btn-sm btn-secondary" data-qid="' + escapeHtml(q.id) + '">確認</button></td>' +
    '</tr>';
  }).join('');
}

/* ----- 画面6：問診票の内容確認・患者登録 ----- */

/** 問診票を開く。未確認のものは、開いた時点で「確認済み」にする */
async function openQuestionnaireDetail(questionnaireId) {
  const q = findQuestionnaire(questionnaireId);
  if (!q) {
    showQuestionnaireList();
    showFlash('問診票が見つかりません。', 'error');
    return;
  }

  currentQuestionnaireId = questionnaireId;
  showView('questionnaire-detail');
  renderQuestionnaireDetail(q);

  if (q.status === 'unconfirmed') {
    const ok = await updateQuestionnaire(q.id, { status: 'confirmed', confirmed_at: new Date().toISOString() });
    if (ok) {
      q.status = 'confirmed';
      updateQuestionnaireBadge();
      if (currentQuestionnaireId === q.id) {
        renderQuestionnaireDetail(q);
      }
    }
  }
}

/**
 * 重複の可能性がある患者を探す。
 * 氏名（空白・大文字小文字を無視）が同じで、生年月日が同じ（またはどちらかが未入力）の患者。
 */
function findDuplicatePatients(answers) {
  const name = normalizeForSearch(answers.name);
  const birth = answers.birthDate || '';
  return patients.filter(function (p) {
    const sameName = normalizeForSearch(p.name) === name;
    const sameBirth = !birth || !p.birthDate || p.birthDate === birth;
    return sameName && sameBirth;
  });
}

function renderQuestionnaireDetail(q) {
  const a = q.answers;
  document.getElementById('questionnaireDetailTitle').textContent = '問診票の内容：' + (a.name || '');

  // --- 上部：受付情報と操作 ---
  let html =
    '<dl class="q-meta">' +
      '<div><dt>受付日時</dt><dd>' + formatDateTime(q.submittedAt) + '</dd></div>' +
      '<div><dt>受付状況</dt><dd>' + statusBadgeHtml(q.status) + '</dd></div>' +
    '</dl>';

  if (q.status === 'registered') {
    const patient = findPatient(q.patientId);
    html += patient
      ? '<div class="alert alert-success q-action-box">この問診票は、患者「' + escapeHtml(patient.name) + '」（' + escapeHtml(patient.id) + '）に登録済みです。' +
          '<button type="button" class="btn btn-sm btn-secondary" data-open-patient="' + escapeHtml(patient.id) + '">患者詳細を表示</button></div>'
      : '<div class="alert alert-error">登録先の患者（' + escapeHtml(q.patientId) + '）が、このパソコンの患者データに見つかりません。</div>';
  } else {
    const duplicates = findDuplicatePatients(a);
    if (duplicates.length > 0) {
      html += '<div class="alert alert-warning">' +
        '<strong>重複登録の可能性があります。</strong>同じ氏名・生年月日の患者が既に登録されています。' +
        '同じ方の場合は、新しく登録せずに既存の患者に紐付けてください。' +
        '<ul class="duplicate-list">' +
        duplicates.map(function (p) {
          return '<li><span>' + escapeHtml(p.id) + '　' + escapeHtml(p.name) + '（生年月日：' + formatDate(p.birthDate) + '）</span>' +
            '<button type="button" class="btn btn-sm btn-secondary" data-link-patient="' + escapeHtml(p.id) + '">この患者に紐付ける</button></li>';
        }).join('') +
        '</ul></div>';
    }
    html += '<div class="q-register">' +
      '<p class="q-register-text">「患者として登録」を押すと、問診票の基本情報（氏名・フリガナ・生年月日・性別・電話番号・住所）から新しい患者を作成し、患者IDを自動で発行します。' +
      '初診日は問診票の受付日、備考にはアレルギー・服用中のお薬・持病が入ります。</p>' +
      '<button type="button" class="btn btn-primary" id="btnRegisterFromQuestionnaire">患者として登録</button>' +
    '</div>';
  }
  document.getElementById('questionnaireActions').innerHTML = html;

  // --- 下部：回答内容（患者側の確認画面と同じ項目） ---
  document.getElementById('questionnaireAnswers').innerHTML = QUESTIONNAIRE_SECTIONS.map(function (section) {
    const items = section.rows.map(function (row) {
      const text = row.value(a);
      return '<div class="info-item wide"><dt>' + row.label + '</dt>' +
        '<dd class="multiline">' + (text ? escapeHtml(text) : '<span class="text-muted">未回答</span>') + '</dd></div>';
    }).join('');
    return '<div class="panel"><div class="panel-header"><h3 class="panel-title">' + section.title + '</h3></div>' +
      '<dl class="info-grid">' + items + '</dl></div>';
  }).join('');
}

/** 患者の備考に入れる、問診票の要点（アレルギーなど治療で注意が必要な情報） */
function buildNoteFromQuestionnaire(q) {
  const a = q.answers;
  const lines = ['【初診問診票（' + formatDateTime(q.submittedAt) + ' 受付）より】'];
  const health = [
    ['アレルギー', formatHealth(a.allergy, a.allergyItems, a.allergyDetail)],
    ['服用中のお薬', formatHealth(a.medication, null, a.medicationDetail)],
    ['持病', formatHealth(a.disease, a.diseaseItems, a.diseaseDetail)],
    ['配慮', joinWithOther(a.considerations, a.considerationDetail)]
  ];
  health.forEach(function (item) {
    if (item[1]) {
      lines.push(item[0] + '：' + item[1].replace(/\n/g, ' ／ '));
    }
  });
  return lines.join('\n');
}

/** 登録・紐付けの直前に、最新の状態を取得する（すでに登録済みなら null） */
async function getLatestUnregistered(questionnaireId) {
  const latest = await fetchQuestionnaire(questionnaireId);
  if (!latest) {
    alert('問診票を取得できませんでした。通信状態を確認して、もう一度お試しください。');
    return null;
  }
  replaceQuestionnaire(latest);
  if (latest.status === 'registered') {
    renderQuestionnaireDetail(latest);
    showFlash('この問診票は既に患者登録済みです。', 'error');
    return null;
  }
  return latest;
}

/** 「患者として登録」：問診票の基本情報から新しい患者を作り、問診票と紐付ける */
async function registerPatientFromQuestionnaire() {
  const q = await getLatestUnregistered(currentQuestionnaireId);
  if (!q) {
    return;
  }

  const a = q.answers;
  const duplicates = findDuplicatePatients(a);
  const message = duplicates.length > 0
    ? '同じ氏名・生年月日の患者が既に登録されています（' + duplicates.map(function (p) { return p.id; }).join('、') + '）。\n\nそれでも新しい患者として登録しますか？'
    : '問診票の内容から、新しい患者「' + a.name + '」を登録します。よろしいですか？';
  if (!confirm(message)) {
    return;
  }

  const now = new Date().toISOString();
  const newPatient = {
    id: generateId('P', patients),
    name: a.name,
    kana: a.kana || '',
    birthDate: a.birthDate || '',
    // 患者管理システムの性別は「男性・女性・その他・未選択」なので、「回答しない」は未選択にする
    gender: (a.gender === '回答しない') ? '' : (a.gender || ''),
    phone: a.phone || '',
    address: a.address || '',
    firstVisitDate: dateFromIso(q.submittedAt),
    note: buildNoteFromQuestionnaire(q),
    createdAt: now,
    updatedAt: now
  };

  // ① 患者を保存（このパソコンの localStorage）
  const issuedBackup = copyData(lastIssued);
  patients.push(newPatient);
  markIdIssued(newPatient.id);
  if (!saveData()) {
    patients.pop();
    lastIssued = issuedBackup;
    return;
  }

  // ② Supabase の問診票に患者IDを記録（失敗したら①も取り消して、元の状態に戻す）
  const ok = await updateQuestionnaire(q.id, { status: 'registered', patient_id: newPatient.id, registered_at: now });
  if (!ok) {
    patients.pop();
    lastIssued = issuedBackup;
    saveData();
    return;
  }
  q.status = 'registered';
  q.patientId = newPatient.id;
  updateQuestionnaireBadge();

  openPatientDetail(newPatient.id);
  showFlash('問診票の内容から患者「' + newPatient.name + '」を登録しました。（患者ID：' + newPatient.id + '）', 'success');
}

/** 「この患者に紐付ける」：既存の患者に問診票を紐付ける（患者の基本情報は変更しない） */
async function linkQuestionnaireToPatient(patientId) {
  const patient = findPatient(patientId);
  if (!patient) {
    return;
  }
  const q = await getLatestUnregistered(currentQuestionnaireId);
  if (!q) {
    return;
  }

  const ok = confirm('この問診票を、既存の患者「' + patient.name + '」（' + patient.id + '）に紐付けます。\n患者の基本情報は変更しません。よろしいですか？');
  if (!ok) {
    return;
  }

  const updated = await updateQuestionnaire(q.id, { status: 'registered', patient_id: patient.id, registered_at: new Date().toISOString() });
  if (!updated) {
    return;
  }
  q.status = 'registered';
  q.patientId = patient.id;
  updateQuestionnaireBadge();

  openPatientDetail(patient.id);
  showFlash('問診票を患者「' + patient.name + '」（' + patient.id + '）に紐付けました。', 'success');
}

/* ----- 患者詳細の「初診問診票」欄（最後に取得した問診票から表示） ----- */

function renderPatientQuestionnaires(patientId) {
  const box = document.getElementById('patientQuestionnaires');
  const linked = questionnaires.filter(function (q) {
    return q.patientId === patientId;
  });

  if (linked.length === 0) {
    box.innerHTML = '<p class="empty-note">この患者に紐付いた問診票はありません。</p>';
    return;
  }

  box.innerHTML = '<div class="table-wrap"><table class="data-table">' +
    '<thead><tr><th class="col-datetime">受付日時</th><th>来院目的</th><th class="col-action">操作</th></tr></thead>' +
    '<tbody>' + linked.map(function (q) {
      return '<tr>' +
        '<td class="cell-nowrap">' + formatDateTime(q.submittedAt) + '</td>' +
        '<td>' + escapeHtml(joinWithOther(q.answers.purposes, q.answers.purposeOther)) + '</td>' +
        '<td class="cell-action"><button type="button" class="btn btn-sm btn-secondary" data-qid="' + escapeHtml(q.id) + '">内容を見る</button></td>' +
      '</tr>';
    }).join('') + '</tbody></table></div>';
}


/* ---------------------------------------------------------
   13. スタッフログイン（Supabase Authentication）
   ・メールアドレスとパスワードでログインする
   ・ログイン後、clinic_staff に登録されているか確認し、登録されていなければ使えない
   ・ログインするまで、患者一覧などの画面は表示しない
   --------------------------------------------------------- */

let supabaseClient = null;   // Supabase と通信するための道具（ログイン状態もここで管理される）

/** ログイン画面を表示する（message があればエラーとして表示） */
function showLoginView(message) {
  showView('login');
  document.getElementById('headerUser').hidden = true;
  document.getElementById('btnLogout').hidden = true;
  const box = document.getElementById('loginError');
  box.textContent = message || '';
  box.hidden = !message;
}

/** ログイン中のユーザーが clinic_staff に登録されているか（自分の行だけ読める設定になっている） */
async function isClinicStaff(user) {
  const { data, error } = await supabaseClient
    .from('clinic_staff')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  return !error && !!data;
}

/** ログイン済みのユーザーで、システムを開始する */
async function startForUser(user) {
  if (!(await isClinicStaff(user))) {
    await supabaseClient.auth.signOut();
    showLoginView('このアカウントには、患者管理システムを利用する権限がありません。');
    return;
  }

  document.getElementById('headerUser').textContent = user.email;
  document.getElementById('headerUser').hidden = false;
  document.getElementById('btnLogout').hidden = false;

  loadData();          // 患者・来院記録（このパソコンの localStorage）
  showListView();
  fetchQuestionnaires(); // 問診票の未確認件数をボタンに表示する（取得を待たずに画面を表示）
}

/** 「ログイン」ボタン */
async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (email === '' || password === '') {
    showLoginView('メールアドレスとパスワードを入力してください。');
    return;
  }

  const button = document.getElementById('btnLogin');
  button.disabled = true;
  button.textContent = 'ログイン中…';
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
  button.disabled = false;
  button.textContent = 'ログイン';

  if (error) {
    showLoginView('ログインできませんでした。メールアドレス・パスワード、または通信状態を確認してください。');
    return;
  }
  document.getElementById('loginPassword').value = '';
  await startForUser(data.user);
}

/** 「ログアウト」ボタン */
async function handleLogout() {
  await supabaseClient.auth.signOut();
  questionnaires = [];   // 取得した問診票を画面から消す
  currentPatientId = null;
  currentQuestionnaireId = null;
  showLoginView('');
}

/** ページを開いたとき：ログイン済みならそのまま開始、そうでなければログイン画面 */
async function startAuth() {
  if (!window.supabase || !SUPABASE_PUBLISHABLE_KEY) {
    showLoginView('Supabase に接続できません。インターネット接続と、supabase-config.js の設定（publishable key）を確認してください。');
    document.getElementById('btnLogin').disabled = true;
    return;
  }
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    await startForUser(data.session.user);
  } else {
    showLoginView('');
  }
}


/* ---------------------------------------------------------
   14. デモデータに戻す
   --------------------------------------------------------- */

function resetToDemoData() {
  const ok = confirm(
    'このパソコンの患者情報・来院記録を削除し、デモデータ（初期状態）に戻します。\n' +
    '（Supabase に保存された問診票は削除されません）\n' +
    '登録・編集した内容は元に戻せません。\n\nよろしいですか？'
  );
  if (!ok) {
    return;
  }

  patients = copyData(DEMO_PATIENTS);
  visits = copyData(DEMO_VISITS);
  // IDの番号は戻さない（Supabase の問診票に記録された患者ID（P0009 など）を、別の患者に再利用しないため）
  // 利用者が明示的に初期化を選んだので、読み込みエラーで止めていた保存を再開する
  storageError = false;

  if (!saveData()) {
    return;
  }

  hideSystemMessage();
  document.getElementById('searchInput').value = '';
  showListView();
  showFlash('デモデータに戻しました。', 'success');
}


/* ---------------------------------------------------------
   15. 初期化（ページを開いたときに最初に実行）
   --------------------------------------------------------- */

function init() {
  renderHeaderDate();

  // --- ログイン ---
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('btnLogout').addEventListener('click', handleLogout);

  // --- 患者一覧 ---
  document.getElementById('btnNewPatient').addEventListener('click', openNewPatientForm);
  document.getElementById('btnResetDemo').addEventListener('click', resetToDemoData);

  // 文字を入力するたびに一覧を絞り込む
  document.getElementById('searchInput').addEventListener('input', renderPatientList);

  document.getElementById('btnClearSearch').addEventListener('click', function () {
    const input = document.getElementById('searchInput');
    input.value = '';
    renderPatientList();
    input.focus();
  });

  // 氏名リンクのクリック（表の行は後から作られるので、tbody にまとめて設定する）
  document.getElementById('patientTableBody').addEventListener('click', function (event) {
    const link = event.target.closest('.patient-link');
    if (!link) {
      return;
    }
    event.preventDefault();
    openPatientDetail(link.dataset.id);
  });

  // --- 患者フォーム ---
  document.getElementById('patientForm').addEventListener('submit', handlePatientFormSubmit);
  document.getElementById('btnCancelForm').addEventListener('click', cancelPatientForm);

  // --- 患者詳細 ---
  document.getElementById('btnBackToList').addEventListener('click', showListView);
  document.getElementById('btnEditPatient').addEventListener('click', function () {
    openEditPatientForm(currentPatientId);
  });
  document.getElementById('btnAddVisit').addEventListener('click', openNewVisitForm);

  // 来院履歴の「編集」ボタン（これも後から作られるので tbody にまとめて設定）
  document.getElementById('visitTableBody').addEventListener('click', function (event) {
    const button = event.target.closest('.btn-edit-visit');
    if (!button) {
      return;
    }
    openEditVisitForm(button.dataset.visitId);
  });

  // --- 来院記録フォーム ---
  document.getElementById('visitForm').addEventListener('submit', handleVisitFormSubmit);
  document.getElementById('btnCancelVisitForm').addEventListener('click', function () {
    openPatientDetail(currentPatientId);
  });
  document.getElementById('btnDeleteVisit').addEventListener('click', deleteVisit);

  // --- 問診票受付 ---
  document.getElementById('btnQuestionnaires').addEventListener('click', showQuestionnaireList);
  document.querySelector('.js-back-to-list').addEventListener('click', showListView);
  document.getElementById('btnBackToQuestionnaires').addEventListener('click', showQuestionnaireList);
  document.getElementById('btnRefreshQuestionnaires').addEventListener('click', refreshQuestionnaireList);

  // 一覧の氏名・「確認」ボタン（data-qid を持つもの）
  document.getElementById('questionnaireTableBody').addEventListener('click', function (event) {
    const target = event.target.closest('[data-qid]');
    if (!target) {
      return;
    }
    event.preventDefault();
    openQuestionnaireDetail(target.dataset.qid);
  });

  // 確認画面の「患者として登録」「この患者に紐付ける」「患者詳細を表示」
  document.getElementById('questionnaireActions').addEventListener('click', function (event) {
    if (event.target.closest('#btnRegisterFromQuestionnaire')) {
      registerPatientFromQuestionnaire();
      return;
    }
    const linkButton = event.target.closest('[data-link-patient]');
    if (linkButton) {
      linkQuestionnaireToPatient(linkButton.dataset.linkPatient);
      return;
    }
    const openButton = event.target.closest('[data-open-patient]');
    if (openButton) {
      openPatientDetail(openButton.dataset.openPatient);
    }
  });

  // 患者詳細の「初診問診票」欄の「内容を見る」
  document.getElementById('patientQuestionnaires').addEventListener('click', function (event) {
    const button = event.target.closest('[data-qid]');
    if (button) {
      openQuestionnaireDetail(button.dataset.qid);
    }
  });

  // ログイン状態を確認してから、画面を表示する
  startAuth();
}

// HTML の読み込みが終わったら init() を実行する
document.addEventListener('DOMContentLoaded', init);
