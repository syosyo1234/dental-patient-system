/* =========================================================
   Supabase の接続先 - supabase-config.js

   ここには「公開しても問題ない情報」だけを書く。
   ※ secret key・service_role key・端末パスワードは、絶対にここに書かない。
   ========================================================= */

'use strict';

// プロジェクトの URL
const SUPABASE_URL = 'https://wxjukovndpswyguepfgi.supabase.co';

// 公開用のキー（publishable key。管理画面のログイン・問診票の閲覧に使う）
// Supabase の「Project Settings」→「API Keys」にある sb_publishable_ で始まる値を、'' の中に貼り付ける。
// ※ これは公開してよいキー。アクセスの制限は Supabase の RLS が行う。
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_nXVSzlj3Nq1_JS66JY5pag_rmfWKXzo';

// 問診票を受け付ける Edge Function の URL
const QUESTIONNAIRE_SUBMIT_URL = SUPABASE_URL + '/functions/v1/submit-questionnaire';
