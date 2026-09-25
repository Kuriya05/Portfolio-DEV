/* ============================================================================
 *  COSMIC PORTFOLIO — ตั้งค่าการเชื่อมต่อ Supabase
 * ----------------------------------------------------------------------------
 *  แก้แค่ไฟล์นี้ไฟล์เดียว แล้วทั้งเว็บจะใช้ฐานข้อมูลจริงทันที
 *
 *  หา 2 ค่านี้ได้จาก: Supabase Dashboard > Project Settings > API Keys
 *    url      = Project URL  (เช่น https://abcdefgh.supabase.co)
 *    anonKey  = คีย์ฝั่งหน้าเว็บ ใช้ได้ทั้ง 2 แบบ แล้วแต่โปรเจกต์จะมีแบบไหน
 *                 แบบใหม่  sb_publishable_xxxxxxxx   <- โปรเจกต์ที่สร้างช่วงหลังจะเจอแบบนี้
 *                 แบบเก่า  eyJhbGciOiJIUzI1NiI...    <- อยู่ใต้หัวข้อ Legacy API keys
 *
 *  ⚠️  คีย์ 2 แบบนี้เปิดเผยได้ ไม่ใช่ความลับ — Supabase ออกแบบมาให้ฝังใน
 *      หน้าเว็บอยู่แล้ว สิ่งที่กันคนอื่นมาแก้ข้อมูลเราคือ RLS ใน
 *      supabase-setup.sql ไม่ใช่การซ่อน key
 *
 *  ❌  ห้ามใส่ sb_secret_... หรือ service_role key เด็ดขาด
 *      สองอันนั้นข้ามทุก RLS (โค้ดจะเช็คให้และปฏิเสธ แต่อย่าลองเลย)
 *
 * ========================================================================== */

window.COSMIC_SUPABASE_CONFIG = {
  url:     'https://naiuyuxvxffepnfptljk.supabase.co',
  anonKey: 'sb_publishable__W9mLZH7tTvDaTTV-YDo5Q_EsNJsYfR',
  bucket:  'portfolio-media'
};
