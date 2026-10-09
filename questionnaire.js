/* =========================================================
   初診問診票 - questionnaire.js

   患者さんが問診票を入力する画面の処理です。
   管理画面の app.js は読み込まず、問診票に必要な処理だけをここに書いています。
   保存先や回答の表示方法は、管理画面と共通の questionnaire-common.js にあります。

   このファイルの構成：
     1. 定数・状態
     2. 便利な関数
     3. 選択に応じた表示切り替え（「その他」欄・「特になし」・生年月日のプルダウン）
     4. 入力内容の読み取り
     5. 入力チェック
     6. 確認画面
     7. 送信
     8. 画面の切り替え
     9. テスト用の架空データ
    10. 初期化
   ========================================================= */

'use strict';

/* ---------------------------------------------------------
   1. 定数・状態
   --------------------------------------------------------- */

let currentAnswers = null; // 確認画面に表示中の回答（「送信する」で送る内容）


/* ---------------------------------------------------------
   2. 便利な関数
   （管理画面の app.js と同じ処理。この画面では app.js を読み込まないため、必要な分だけ用意）
   --------------------------------------------------------- */

/** HTML として特別な意味を持つ文字を変換する（入力内容で画面が崩れるのを防ぐ） */
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

/** 今日の日付を "YYYY-MM-DD" 形式で返す */
function todayString() {
  const now = new Date();
  return now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');
}

/** "YYYY-MM-DD" 形式で、実在する日付かどうか */
function isValidDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const parts = dateStr.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.getFullYear() === parts[0] && date.getMonth() === parts[1] - 1 && date.getDate() === parts[2];
}

/** 全角の数字・ハイフンを半角に変換する（電話番号用） */
function toHalfWidthPhone(text) {
  return text
    .replace(/[０-９]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
    })
    .replace(/[－ー−‐]/g, '-');
}

/** 要素が画面に表示されているか（hidden の中に入っていないか） */
function isShown(element) {
  return !element.closest('[hidden]');
}


/* ---------------------------------------------------------
   3. 選択に応じた表示切り替え
   --------------------------------------------------------- */

/**
 * data-show-when="名前=値" が付いた欄を、選択に合わせて表示・非表示にする。
 * 例：data-show-when="purposes=その他" → 来院目的の「その他」にチェックがあるときだけ表示
 */
function updateConditionalFields() {
  document.querySelectorAll('[data-show-when]').forEach(function (area) {
    const parts = area.dataset.showWhen.split('=');
    const name = parts[0];
    const value = parts[1];
    const checked = document.querySelector('input[name="' + name + '"][value="' + value + '"]:checked');
    area.hidden = !checked;
  });
}

/**
 * 「特に症状はない」「特に希望なし」のような選択肢（data-exclusive）の処理。
 *   - それを選んだら、同じ質問の他のチェックを外す
 *   - 他の選択肢を選んだら、それのチェックを外す
 */
function handleExclusiveOption(checkbox) {
  if (checkbox.type !== 'checkbox' || !checkbox.checked) {
    return;
  }
  const sameGroup = document.querySelectorAll('input[name="' + checkbox.name + '"]');
  sameGroup.forEach(function (other) {
    if (other === checkbox) {
      return;
    }
    if (checkbox.hasAttribute('data-exclusive') || other.hasAttribute('data-exclusive')) {
      other.checked = false;
    }
  });
}


/* ----- 生年月日のプルダウン ----- */

// 生年月日で選べる最も古い年
const BIRTH_YEAR_MIN = 1920;

/** 年・月の選択肢を作る（ページを開いたときに1回だけ実行）。年は新しい順 */
function setupBirthDateSelects() {
  let yearHtml = '<option value="">年</option>';
  for (let y = new Date().getFullYear(); y >= BIRTH_YEAR_MIN; y--) {
    yearHtml += '<option value="' + y + '">' + y + '年</option>';
  }
  document.getElementById('q-birthYear').innerHTML = yearHtml;

  let monthHtml = '<option value="">月</option>';
  for (let m = 1; m <= 12; m++) {
    monthHtml += '<option value="' + m + '">' + m + '月</option>';
  }
  document.getElementById('q-birthMonth').innerHTML = monthHtml;

  updateBirthDayOptions();
}

/**
 * 日の選択肢を、選ばれている年・月に合わせて作り直す（例：2月は 28日 または 29日まで）。
 * 選んでいた日がその月に無くなった場合は、未選択に戻す。
 */
function updateBirthDayOptions() {
  const year = Number(document.getElementById('q-birthYear').value) || 2000; // 年が未選択なら閏年として扱う
  const month = Number(document.getElementById('q-birthMonth').value);
  const daySelect = document.getElementById('q-birthDay');
  const selected = Number(daySelect.value);
  // new Date(年, 月, 0) は「その月の最後の日」になる
  const maxDay = month ? new Date(year, month, 0).getDate() : 31;

  let dayHtml = '<option value="">日</option>';
  for (let d = 1; d <= maxDay; d++) {
    dayHtml += '<option value="' + d + '">' + d + '日</option>';
  }
  daySelect.innerHTML = dayHtml;
  daySelect.value = (selected && selected <= maxDay) ? String(selected) : '';
}

/**
 * プルダウンから生年月日を読み取る。
 *   すべて選択   → "1992-04-18"
 *   すべて未選択 → ""（未回答）
 *   一部だけ選択 → "partial"（入力チェックでエラーにする）
 */
function getBirthDate() {
  const y = document.getElementById('q-birthYear').value;
  const m = document.getElementById('q-birthMonth').value;
  const d = document.getElementById('q-birthDay').value;
  if (y === '' && m === '' && d === '') {
    return '';
  }
  if (y === '' || m === '' || d === '') {
    return 'partial';
  }
  return y + '-' + m.padStart(2, '0') + '-' + d.padStart(2, '0');
}

/** "1992-04-18" をプルダウンに反映する（テスト用データの入力で使う） */
function setBirthDate(dateStr) {
  const parts = dateStr.split('-');
  document.getElementById('q-birthYear').value = String(Number(parts[0]));
  document.getElementById('q-birthMonth').value = String(Number(parts[1]));
  updateBirthDayOptions();
  document.getElementById('q-birthDay').value = String(Number(parts[2]));
}


/* ---------------------------------------------------------
   4. 入力内容の読み取り
   --------------------------------------------------------- */

/** 文字の入力欄の値（前後の空白を除く）。非表示の欄は空として扱う */
function getText(id) {
  const input = document.getElementById(id);
  return isShown(input) ? input.value.trim() : '';
}

/** チェックボックスで選ばれた値の配列（例：["虫歯治療", "定期検診"]）。非表示の欄は空 */
function getChecked(name) {
  const values = [];
  document.querySelectorAll('input[name="' + name + '"]:checked').forEach(function (input) {
    if (isShown(input)) {
      values.push(input.value);
    }
  });
  return values;
}

/** ラジオボタンで選ばれた値（未選択なら空文字） */
function getRadio(name) {
  const checked = document.querySelector('input[name="' + name + '"]:checked');
  return checked ? checked.value : '';
}

/** 問診票の回答をまとめて 1 つのオブジェクトにする（これがそのまま送信するデータになる） */
function readAnswers() {
  return {
    // 基本情報
    name: getText('q-name'),
    kana: getText('q-kana'),
    birthDate: getBirthDate(),
    gender: getRadio('gender'),
    phone: toHalfWidthPhone(getText('q-phone')),
    address: getText('q-address'),
    // 来院目的・症状
    purposes: getChecked('purposes'),
    purposeOther: getText('q-purposeOther'),
    symptoms: getChecked('symptoms'),
    symptomOther: getText('q-symptomOther'),
    // 希望
    services: getChecked('services'),
    preferredTimes: getChecked('preferredTimes'),
    costPreference: getRadio('costPreference'),
    // きっかけ
    referral: getRadio('referral'),
    referralOther: getText('q-referralOther'),
    // 健康状態
    allergy: getRadio('allergy'),
    allergyItems: getChecked('allergyItems'),
    allergyDetail: getText('q-allergyDetail'),
    medication: getRadio('medication'),
    medicationDetail: getText('q-medicationDetail'),
    disease: getRadio('disease'),
    diseaseItems: getChecked('diseaseItems'),
    diseaseDetail: getText('q-diseaseDetail'),
    considerations: getChecked('considerations'),
    considerationDetail: getText('q-considerationDetail'),
    // その他
    freeText: getText('q-freeText')
  };
}


/* ---------------------------------------------------------
   5. 入力チェック
   --------------------------------------------------------- */

/**
 * 回答をチェックし、問題があれば { 項目名: 'メッセージ' } を返す。
 * 項目名は HTML の data-field="..." と同じ名前にしている（エラーを表示する場所を探すため）。
 */
function validateAnswers(a) {
  const errors = {};

  // 氏名（必須）
  if (a.name === '') {
    errors.name = '氏名をご入力ください。';
  }

  // 生年月日（任意。選ぶ場合は年・月・日すべて）
  if (a.birthDate === 'partial') {
    errors.birthDate = '生年月日は「年」「月」「日」をすべてお選びください。';
  } else if (a.birthDate !== '' && !isValidDate(a.birthDate)) {
    errors.birthDate = '生年月日を正しい日付でお選びください。';
  } else if (a.birthDate > todayString()) {
    errors.birthDate = '生年月日に未来の日付は入力できません。';
  }

  // 電話番号（任意。数字とハイフンのみ）
  if (a.phone !== '' && !/^[0-9-]+$/.test(a.phone)) {
    errors.phone = '電話番号は数字とハイフン（-）でご入力ください。';
  }

  // 来院目的（必須・1つ以上）
  if (a.purposes.length === 0) {
    errors.purposes = '来院目的を1つ以上お選びください。';
  }

  // 健康状態（必須。「あり」の場合は内容も必要）
  if (a.allergy === '') {
    errors.allergy = 'アレルギーの有無をお選びください。';
  } else if (a.allergy === 'あり' && a.allergyItems.length === 0 && a.allergyDetail === '') {
    errors.allergy = 'アレルギーの内容を選択するか、ご記入ください。';
  }

  if (a.medication === '') {
    errors.medication = '服用中のお薬の有無をお選びください。';
  } else if (a.medication === 'あり' && a.medicationDetail === '') {
    errors.medication = 'お薬の名前をご記入ください（分からない場合は「不明」とご記入ください）。';
  }

  if (a.disease === '') {
    errors.disease = '持病の有無をお選びください。';
  } else if (a.disease === 'あり' && a.diseaseItems.length === 0 && a.diseaseDetail === '') {
    errors.disease = '該当する病気を選択するか、ご記入ください。';
  }

  return errors;
}

/** エラーを表示する（上部にまとめて表示し、各質問の下にも表示） */
function showErrors(errors) {
  clearErrors();
  const keys = Object.keys(errors);

  keys.forEach(function (key) {
    const item = document.querySelector('[data-field="' + key + '"]');
    if (item) {
      item.classList.add('has-error');
    }
    const box = document.querySelector('[data-error-for="' + key + '"]');
    if (box) {
      box.textContent = errors[key];
    }
  });

  const summary = document.getElementById('errorSummary');
  summary.innerHTML = '<strong>入力内容をご確認ください（' + keys.length + '件）</strong>' +
    '<ul class="q-error-list">' +
    keys.map(function (key) { return '<li>' + escapeHtml(errors[key]) + '</li>'; }).join('') +
    '</ul>';
  summary.hidden = false;

  // 最初のエラーの質問までスクロールする
  const firstItem = document.querySelector('[data-field="' + keys[0] + '"]');
  if (firstItem) {
    firstItem.scrollIntoView({ block: 'center' });
    const input = firstItem.querySelector('input[type="text"], input[type="tel"], select');
    if (input && isShown(input)) {
      input.focus({ preventScroll: true });
    }
  }
}

function clearErrors() {
  document.querySelectorAll('.has-error').forEach(function (item) {
    item.classList.remove('has-error');
  });
  document.querySelectorAll('[data-error-for]').forEach(function (box) {
    box.textContent = '';
  });
  document.getElementById('errorSummary').hidden = true;
}

/** 回答し直した質問は、その場でエラー表示を消す */
function clearErrorOf(element) {
  const item = element.closest('.q-item.has-error');
  if (!item) {
    return;
  }
  item.classList.remove('has-error');
  const box = item.querySelector('[data-error-for]');
  if (box) {
    box.textContent = '';
  }
}


/* ---------------------------------------------------------
   6. 確認画面
   --------------------------------------------------------- */

/** 確認画面の HTML を作る */
function renderConfirm(answers) {
  document.getElementById('confirmContent').innerHTML = QUESTIONNAIRE_SECTIONS.map(function (section) {
    const rowsHtml = section.rows.map(function (row) {
      const text = row.value(answers);
      const valueHtml = text ? escapeHtml(text) : '<span class="q-empty">未回答</span>';
      return '<div class="q-confirm-row"><dt>' + row.label + '</dt><dd>' + valueHtml + '</dd></div>';
    }).join('');
    return '<section class="q-confirm-section">' +
      '<h2 class="q-section-title">' + section.title + '</h2>' +
      '<dl class="q-confirm-list">' + rowsHtml + '</dl>' +
    '</section>';
  }).join('');
}

/** 「入力内容を確認する」が押されたとき */
function handleFormSubmit(event) {
  event.preventDefault(); // フォーム送信によるページ再読み込みを止める

  const answers = readAnswers();
  const errors = validateAnswers(answers);
  if (Object.keys(errors).length > 0) {
    showErrors(errors);
    return;
  }

  clearErrors();
  currentAnswers = answers;
  renderConfirm(answers);
  showStep('confirm');
}


/* ---------------------------------------------------------
   7. 送信
   このブラウザの localStorage に保存し、同じブラウザで開いた管理画面の「問診票受付」に表示する。
   （患者さん自身のスマートフォンから送る場合は、共有データベースへの送信に置き換える必要がある）
   --------------------------------------------------------- */

function sendQuestionnaire() {
  if (!currentAnswers) {
    showStep('input');
    return;
  }

  const sendButton = document.getElementById('btnSend');
  const sendError = document.getElementById('sendError');
  sendButton.disabled = true;   // 二重送信の防止
  sendError.hidden = true;

  // 送信するデータ（受付日時と受付状況を付ける）
  const record = {
    id: 'Q' + Date.now(),                    // 受付ID（送信した時刻から作る）
    submittedAt: new Date().toISOString(),   // 受付日時
    status: 'unconfirmed',                   // 受付状況：未確認
    patientId: null,                         // 患者として登録したときに、患者IDが入る
    answers: currentAnswers
  };

  try {
    const list = readQuestionnaireList();    // questionnaire-common.js
    list.push(record);
    writeQuestionnaireList(list);
  } catch (e) {
    // 既存のデータは上書きせず、送信できなかったことだけを伝える
    sendError.textContent = '送信できませんでした。お手数ですが、受付スタッフにお声がけください。';
    sendError.hidden = false;
    sendButton.disabled = false;
    return;
  }

  // 送信後は入力内容を画面から消す（次の人が同じ端末を使っても見えないように）
  document.getElementById('questionnaireForm').reset();
  updateConditionalFields();
  updateBirthDayOptions();
  document.getElementById('confirmContent').innerHTML = '';
  currentAnswers = null;
  sendButton.disabled = false;

  showStep('complete');
}


/* ---------------------------------------------------------
   8. 画面の切り替え（'input' → 'confirm' → 'complete'）
   --------------------------------------------------------- */

const STEP_ORDER = ['input', 'confirm', 'complete'];

function showStep(stepName) {
  STEP_ORDER.forEach(function (name) {
    document.getElementById('step-' + name).hidden = (name !== stepName);
  });

  // 上部の「1 入力 → 2 確認 → 3 完了」の表示を更新
  const currentIndex = STEP_ORDER.indexOf(stepName);
  document.querySelectorAll('.q-step').forEach(function (step) {
    const index = STEP_ORDER.indexOf(step.dataset.step);
    step.classList.toggle('is-current', index === currentIndex);
    step.classList.toggle('is-done', index < currentIndex);
  });

  window.scrollTo(0, 0);
}


/* ---------------------------------------------------------
   9. テスト用の架空データ
   URL の最後に ?demo=1 を付けて開いたときだけボタンを表示する。
   （すべて架空の情報です）
   --------------------------------------------------------- */

function fillDemoData() {
  document.getElementById('q-name').value = '問診 花子';
  document.getElementById('q-kana').value = 'モンシン ハナコ';
  setBirthDate('1992-04-18');
  document.getElementById('q-phone').value = '090-0000-1234';
  document.getElementById('q-address').value = '東京都杉並区高円寺南1-2-3';
  document.getElementById('q-allergyDetail').value = 'ペニシリン系の抗生物質';
  document.getElementById('q-freeText').value = '前の歯科医院で治療途中の歯があります。';

  const checks = {
    gender: ['女性'],
    purposes: ['虫歯治療', '歯のクリーニング'],
    symptoms: ['冷たいものがしみる', '歯ぐきから出血する'],
    services: ['保険診療を希望する', '予防歯科に関心がある'],
    preferredTimes: ['平日夜', '土曜日'],
    costPreference: ['相談して決めたい'],
    referral: ['Google検索'],
    allergy: ['あり'],
    allergyItems: ['薬（抗生物質・痛み止めなど）'],
    medication: ['なし'],
    disease: ['なし'],
    considerations: ['痛みに弱い']
  };
  Object.keys(checks).forEach(function (name) {
    document.querySelectorAll('input[name="' + name + '"]').forEach(function (input) {
      input.checked = checks[name].indexOf(input.value) !== -1;
    });
  });

  updateConditionalFields();
  clearErrors();
}


/* ---------------------------------------------------------
   10. 初期化（ページを開いたときに最初に実行）
   --------------------------------------------------------- */

function init() {
  const form = document.getElementById('questionnaireForm');
  setupBirthDateSelects();

  // チェック・選択が変わったとき
  form.addEventListener('change', function (event) {
    // 年・月を変えたら、日の選択肢（28〜31日）を作り直す
    if (event.target.id === 'q-birthYear' || event.target.id === 'q-birthMonth') {
      updateBirthDayOptions();
    }
    handleExclusiveOption(event.target);
    updateConditionalFields();
    clearErrorOf(event.target);
  });

  // 文字を入力したとき
  form.addEventListener('input', function (event) {
    clearErrorOf(event.target);
  });

  form.addEventListener('submit', handleFormSubmit);
  document.getElementById('btnBackToInput').addEventListener('click', function () {
    showStep('input');
  });
  document.getElementById('btnSend').addEventListener('click', sendQuestionnaire);

  // ?demo=1 のときだけテスト用ボタンを表示
  if (new URLSearchParams(window.location.search).get('demo') === '1') {
    document.getElementById('demoArea').hidden = false;
    document.getElementById('btnFillDemo').addEventListener('click', fillDemoData);
  }

  updateConditionalFields();
  showStep('input');
}

// HTML の読み込みが終わったら init() を実行する
document.addEventListener('DOMContentLoaded', init);
