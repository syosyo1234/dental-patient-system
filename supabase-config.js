/* =========================================================
   Supabase の接続先 - supabase-config.js

   ここには「公開しても問題ない情報」だけを書く。
   ※ secret key・service_role key・端末パスワードは、絶対にここに書かない。
   ========================================================= */

'use strict';

// プロジェクトの URL
const SUPABASE_URL = 'https://wxjukovndpswyguepfgi.supabase.co';

// 問診票を受け付ける Edge Function の URL
const QUESTIONNAIRE_SUBMIT_URL = SUPABASE_URL + '/functions/v1/submit-questionnaire';
