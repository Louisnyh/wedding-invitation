// Synthetic records only. Never copied into dist/.
export const TOKEN_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
export const TOKEN_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
export function fixtures() {
  return {
    Guests: [
      ['guest_id','token','guest_name','invitation_status','pax_limit','table_id','revoked','expires_at','guest_type','group_name','personal_message','invite_url'],
      ['guest-0001',TOKEN_A,'测试宾客 A','active',3,'SECRET_TABLE_A','','','QA','Synthetic','PERSONAL_SECRET_A',`https://louisnyh.github.io/wedding-invitation/?token=${TOKEN_A}`],
      ['guest-0002',TOKEN_B,'测试宾客 B','active',2,'SECRET_TABLE_B','','','QA','Synthetic','PERSONAL_SECRET_B',`https://louisnyh.github.io/wedding-invitation/?token=${TOKEN_B}`]
    ],
    RSVP: [['response_id','request_id','revision','timestamp','guest_id','rsvp_status','pax_count','under_5_child_count','dietary_notes','private_note']],
    Settings: [
      ['key','value'],['wedding_date_display','2026年12月5日 · 星期六'],['wedding_start_time','晚上 6:00 开始'],
      ['venue_name','億家主题宴会厅 · Hall E 露天草坪'],['venue_address',"8, Jln Adda 2, Taman Adda, 81100 Johor Bahru, Johor Darul Ta’zim, Malaysia"],
      ['dress_code','Smart Formal / 正式得体即可'],['google_maps_url','https://www.google.com/maps'],['waze_url','https://www.waze.com/ul'],
      ['table_release_date','2026-11-28'],['table_check_mode','scheduled'],['organizer_password','SETTINGS_SECRET']
    ],
    Tables: [['table_id','table_name','organizer_notes'],['SECRET_TABLE_A','测试桌位 A','TABLE_SECRET'],['SECRET_TABLE_B','测试桌位 B','TABLE_SECRET_B']],
    Messages: [['message','token','table_id'],['FORBIDDEN_MESSAGE',TOKEN_B,'SECRET_TABLE_B']],
    Menu: [['course_name'],['FORBIDDEN_MENU']]
  };
}
