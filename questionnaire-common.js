/* =========================================================
   問診票の共通処理 - questionnaire-common.js

   患者側（questionnaire.html）と管理側（index.html）の両方で読み込む。
     - 問診票の保存場所（localStorage のキー）と読み書き
     - 受付状況の表示名
     - 回答の表示方法（確認画面・管理画面で同じ表示にするため）

   ※ 問診票の保存先を将来データベースに変える場合は、
     readQuestionnaireList / writeQuestionnaireList を中心に書き換える。
   ========================================================= */

'use strict';

// 問診票を保存する localStorage のキー（患者データ dentalClinic_patients などとは別）
const STORAGE_KEY_QUESTIONNAIRES = 'dentalClinic_questionnaires';

// 受付状況（保存する値 → 画面に表示する名前）
const QUESTIONNAIRE_STATUS = {
  unconfirmed: '未確認',
  confirmed: '確認済み',
  registered: '患者登録済み'
};

/**
 * 保存されている問診票の一覧を読み込む。
 * 読み込めない・形式が正しくない場合はエラーを投げる（呼び出し側で try/catch する）。
 */
function readQuestionnaireList() {
  const text = localStorage.getItem(STORAGE_KEY_QUESTIONNAIRES);
  const list = text ? JSON.parse(text) : [];
  if (!Array.isArray(list)) {
    throw new Error('問診票データの形式が正しくありません');
  }
  return list;
}

/** 問診票の一覧を保存する（失敗した場合はエラーを投げる） */
function writeQuestionnaireList(list) {
  localStorage.setItem(STORAGE_KEY_QUESTIONNAIRES, JSON.stringify(list));
}


/* ---------- 回答の表示用 ---------- */

/** "1990-04-18" → "1990年4月18日" */
function formatDateJa(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  return m ? Number(m[1]) + '年' + Number(m[2]) + '月' + Number(m[3]) + '日' : '';
}

/** 配列を「、」でつなぐ。「その他」の内容が入力されていれば「その他（内容）」にする */
function joinWithOther(items, otherText) {
  return (items || []).map(function (item) {
    return (item === 'その他' && otherText) ? 'その他（' + otherText + '）' : item;
  }).join('、');
}

/** 健康状態の表示（例："あり\n内容：金属\n詳細：…"） */
function formatHealth(answer, items, detail) {
  if (answer !== 'あり') {
    return answer || '';
  }
  const lines = ['あり'];
  if (items && items.length > 0) {
    lines.push('内容：' + items.join('、'));
  }
  if (detail) {
    lines.push('詳細：' + detail);
  }
  return lines.join('\n');
}

/**
 * 回答を表示するときの項目の一覧（患者側の確認画面と、管理画面の両方で使う）。
 * value は「回答 a から表示する文字を作る関数」。
 */
const QUESTIONNAIRE_SECTIONS = [
  {
    title: '基本情報',
    rows: [
      { label: '氏名', value: function (a) { return a.name; } },
      { label: 'フリガナ', value: function (a) { return a.kana; } },
      { label: '生年月日', value: function (a) { return formatDateJa(a.birthDate); } },
      { label: '性別', value: function (a) { return a.gender; } },
      { label: '電話番号', value: function (a) { return a.phone; } },
      { label: '住所', value: function (a) { return a.address; } }
    ]
  },
  {
    title: '来院目的・症状',
    rows: [
      { label: '来院目的', value: function (a) { return joinWithOther(a.purposes, a.purposeOther); } },
      { label: '現在の症状', value: function (a) { return joinWithOther(a.symptoms, a.symptomOther); } }
    ]
  },
  {
    title: 'ご希望',
    rows: [
      { label: 'ご希望の診療・サービス', value: function (a) { return (a.services || []).join('、'); } },
      { label: 'ご希望の通院時間帯', value: function (a) { return (a.preferredTimes || []).join('、'); } },
      { label: '治療費について', value: function (a) { return a.costPreference; } },
      { label: '来院のきっかけ', value: function (a) { return joinWithOther(a.referral ? [a.referral] : [], a.referralOther); } }
    ]
  },
  {
    title: '健康状態',
    rows: [
      { label: 'アレルギー', value: function (a) { return formatHealth(a.allergy, a.allergyItems, a.allergyDetail); } },
      { label: '服用中のお薬', value: function (a) { return formatHealth(a.medication, null, a.medicationDetail); } },
      { label: '持病', value: function (a) { return formatHealth(a.disease, a.diseaseItems, a.diseaseDetail); } },
      { label: '治療時に配慮してほしいこと', value: function (a) { return joinWithOther(a.considerations, a.considerationDetail); } }
    ]
  },
  {
    title: 'その他',
    rows: [
      { label: 'ご希望・ご質問', value: function (a) { return a.freeText; } }
    ]
  }
];
