'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { subscriptionApi } from '@/lib/api-client';
import type { PlanId } from '@/types';

/**
 * The living user guide. One source of truth for "what did I get and how does it work" —
 * every section carries the minimum plan that includes it, so each subscriber sees their
 * OWN product: included sections open fully, higher-tier ones render as a locked teaser
 * that doubles as an upgrade prompt. Update a section here and every subscriber sees the
 * current truth (unlike a PDF that ages the moment it's sent).
 */

const PLAN_ORDER: Record<PlanId, number> = { starter: 0, growth: 1, autopilot: 2, scale: 3 };
const PLAN_NAME: Record<PlanId, string> = { starter: 'Starter', growth: 'Growth', autopilot: 'Autopilot', scale: 'Scale' };

interface GuideSection {
  id: string;
  emoji: string;
  title: string;
  minPlan: PlanId;
  body: React.ReactNode;
}

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-white/60 leading-relaxed mb-3">{children}</p>
);
const H = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm font-semibold text-white/85 mt-4 mb-1.5">{children}</p>
);
const LI = ({ children }: { children: React.ReactNode }) => (
  <li className="text-sm text-white/60 leading-relaxed">{children}</li>
);
const B = ({ children }: { children: React.ReactNode }) => <b className="text-white/85">{children}</b>;

const SECTIONS: GuideSection[] = [
  {
    id: 'quickstart', emoji: '🚀', title: 'התחלה מהירה — 5 צעדים ראשונים', minPlan: 'starter',
    body: (
      <>
        <P>ככה מגיעים מפוסט ראשון לפרסום אוטומטי מלא:</P>
        <ol className="list-decimal pr-5 space-y-1.5">
          <LI><B>חבר את AliExpress</B> — הגדרות ← שווקים: App Key, App Secret ו-Tracking ID מחשבון האפילייט שלך (portals.aliexpress.com).</LI>
          <LI><B>חבר מנוע AI</B> — הגדרות ← AI: מפתח של Claude / Gemini / OpenAI (או להשתמש במפתח המשותף של המערכת אם זמין בתוכנית).</LI>
          <LI><B>חבר ערוץ טלגרם</B> — צור בוט ב-@BotFather, הוסף אותו כאדמין לערוץ, והזן את הטוקן ואת מזהה הערוץ בהגדרות ← אינטגרציות. כפתור &quot;בדוק חיבור&quot; יאשר שהכול תקין.</LI>
          <LI><B>שלח פוסט ראשון</B> — מסך &quot;פוסט מהיר&quot;: חפש מוצר, המערכת תכתוב את הטקסט, ושלח. ככה מוודאים שהצינור עובד מקצה לקצה.</LI>
          <LI><B>הקם טייס אוטומטי</B> — מסך &quot;הטייס האוטומטי&quot; ← חדש: מילות מפתח, תדירות, וזהו — המערכת מפרסמת לבד.</LI>
        </ol>
      </>
    ),
  },
  {
    id: 'credits', emoji: '💳', title: 'קרדיטים — מה עולה כמה', minPlan: 'starter',
    body: (
      <>
        <P>כל תוכנית מתחדשת מדי חודש עם מכסת קרדיטים. שתי פעולות צורכות קרדיטים:</P>
        <ul className="list-disc pr-5 space-y-1.5">
          <LI><B>כתיבת טקסט ב-AI</B> — 5 קרדיטים לפוסט.</LI>
          <LI><B>פרסום פוסט</B> — 10 קרדיטים, לא משנה לכמה פלטפורמות וקבוצות הוא יוצא בו-זמנית.</LI>
        </ul>
        <P>היתרה מוצגת בדשבורד ובהגדרות ← מנוי. נגמרו הקרדיטים? הפרסום נעצר עם הודעה ברורה (שום דבר לא נשלח &quot;על חשבוןך&quot; בלי כיסוי) ומתחדש בתחילת החודש או בשדרוג.</P>
      </>
    ),
  },
  {
    id: 'autopilot', emoji: '✈️', title: 'הטייס האוטומטי — לב המערכת', minPlan: 'starter',
    body: (
      <>
        <P>טייס = קמפיין שרץ לבד: מחפש מוצרים, כותב פוסטים ומפרסם — לפי ההגדרות שלך.</P>
        <H>מילות מפתח</H>
        <P>המערכת מסובבת את המילים בסבב הוגן, ו<B>כל פוסט בהרצה מקבל מילת מפתח אחרת</B> — הרצה של 3 פוסטים מכסה 3 נישות שונות. אפשר לכתוב בעברית; החיפוש מול AliExpress מתורגם לאנגלית אוטומטית. מומלץ 4–6 מילים ממוקדות.</P>
        <H>פילטרים</H>
        <P>טווח מחירים, הנחה מינימלית ודירוג מינימלי (4.5+ ⭐ מומלץ) — רק מוצרים שעומדים בכולם מתפרסמים. המערכת גם מדלגת אוטומטית על מוצרים שהקמפיין כבר פרסם.</P>
        <H>תדירות ופוסטים בהרצה</H>
        <P>&quot;כל 3 שעות&quot; עם 2–3 פוסטים בהרצה זו נקודת פתיחה טובה. ההרצות מייצרות פוסטים מתוזמנים שמתפרסמים בתוך חלון השליחה (ראה סעיף תזמון).</P>
        <H>מקורות מוצרים</H>
        <P>AliExpress (חיפוש לפי מילות מפתח) · FLYLINK (סבב על קטלוג ספקים מקושר) · Amazon (בתוכניות המתאימות).</P>
      </>
    ),
  },
  {
    id: 'scheduling', emoji: '🕐', title: 'תזמון וחלון שליחה', minPlan: 'starter',
    body: (
      <>
        <P>בהגדרות ← תזמון קובעים את <B>חלון השליחה</B> (ברירת מחדל 9:00–22:00 שעון ישראל) ואת <B>הקצב</B> — כמה זמן מינימום בין פוסט לפוסט בכל קבוצה. פוסטים שנוצרים בלילה מחכים לפתיחת החלון; שתי קמפיינים לאותה קבוצה לעולם לא יתנגשו — המערכת מרווחת אותם אוטומטית.</P>
        <P>לכל ערוץ/קבוצה אפשר לקבוע חלון וקצב משלו במסך &quot;ערוצים&quot;.</P>
      </>
    ),
  },
  {
    id: 'links', emoji: '🔗', title: 'לינקים חכמים ומעקב קליקים', minPlan: 'starter',
    body: (
      <>
        <P>כל פוסט יוצא עם לינק מעקב קצר על הדומיין של המערכת. גולש שלוחץ מגיע ללינק האפילייט שלך כרגיל (העמלה לא מושפעת) — אבל בדרך <B>הקליק נספר</B>. בטלגרם הלינק בכלל מוסתר מאחורי טקסט לחיץ נקי: &quot;🛒 לרכישה — לחצו כאן 🛒&quot;.</P>
        <P>את הקליקים רואים על כל פוסט במסך הפוסטים (🔗) — כך יודעים תוך שעות מה עובד, במקום לחכות שבועות לדוח עמלות.</P>
      </>
    ),
  },
  {
    id: 'templates', emoji: '📝', title: 'תבניות, פוטרים וקופונים', minPlan: 'starter',
    body: (
      <>
        <P><B>תבניות</B> — במסך התבניות מגדירים סגנון כתיבה קבוע (גוף/פוטר). תבנית ברירת מחדל חלה על כל הפוסטים; לכל קבוצה אפשר סגנון משלה. <B>קופונים</B> — קודי הנחה של AliExpress שמוזנים במסך הקופונים מצורפים אוטומטית לפוסטים כשהמוצר עומד בתנאי הקוד, ומוסרים כשהקוד פג.</P>
      </>
    ),
  },
  {
    id: 'smart-intake', emoji: '🪄', title: 'קליטה חכמה מקישור', minPlan: 'starter',
    body: (
      <>
        <P>ראיתם מוצר שווה ב-AliExpress? מעתיקים את הקישור (גם קישור מקוצר של s.click) ומדביקים בכפתור <B>&quot;קליטה מקישור&quot;</B> במסך הפוסטים. המערכת מזהה את המוצר, יוצרת מילת מפתח באנגלית, <B>משייכת אוטומטית לטייס עם הקהל המתאים</B> — ומתזמנת פוסט דרך ההגדרות שלו (קבוצות, שפה, מטבע, קצב).</P>
        <P>המילה החדשה מצטרפת לרוטציה של הטייס, כך שהוא ימצא עוד מוצרים דומים בהמשך. הדבקתם כמה קישורים ברצף? הם נפרסים אוטומטית לפי קצב הקבוצה — לא נערמים על אותה שעה.</P>
        <P>וכשהמערכת <B>לא בטוחה</B> לאיזה טייס המוצר שייך — היא לא מנחשת: מוצגת רשימת הטייסים שלכם ואתם בוחרים (או שולחים לתור ברירת המחדל).</P>
      </>
    ),
  },
  {
    id: 'post-editing', emoji: '🖼️', title: 'עריכת פוסט מתקדמת ופרסום מחדש', minPlan: 'starter',
    body: (
      <>
        <P>לחיצה על עריכה בכל פוסט פותחת עורך מלא: שם, מחיר, קישורים, תמונה וטקסט.</P>
        <H>תמונה מהמכשיר</H>
        <P>כפתור <B>&quot;העלה&quot;</B> ליד שדה התמונה פותח את הגלריה בטלפון (או בחירת קובץ במחשב). התמונה מאוחסנת אצלנו, מותאמת אוטומטית לכל הפלטפורמות — ומחליפה את התמונה הישנה גם באלבום שמתפרסם. לחיצה על התמונה הממוזערת מגדילה אותה לבדיקה.</P>
        <H>צור מחדש עם AI — עם עיניים</H>
        <P>הכפתור שולח ל-AI את <B>התמונות האמיתיות של הפוסט</B> יחד עם הכותרת שהקלדתם — כך שאם החלפתם תמונה או שם, הטקסט החדש ייכתב על המוצר הנכון, כולל פרטים ויזואליים (צבע, חומר, סגנון).</P>
        <H>פרסום מחדש ממוקד</H>
        <P>בדיאלוג &quot;פרסום מחדש&quot; בוחרים <B>לאילו קבוצות ולאילו פלטפורמות</B> בדיוק לצאת הפעם — הבחירה נשמרת על הפוסט וגוברת על הגדרות הטייס. ופוסט שפורסם חלקית? כפתור הניסיון-החוזר שולח רק את הפלטפורמה שנכשלה.</P>
      </>
    ),
  },
  {
    id: 'facebook', emoji: '📘', title: 'פייסבוק ואינסטגרם', minPlan: 'growth',
    body: (
      <>
        <H>חיבור</H>
        <P>הגדרות ← אינטגרציות ← פייסבוק: מזינים Page ID ו-Page Access Token (מ-Graph API Explorer, אחרי Extend ל-60 יום). אינסטגרם עסקי רוכב על אותו טוקן — מזינים רק את ה-Instagram Business ID, וכפתור &quot;בדוק חיבור&quot; אפילו מאתר אותו אוטומטית אם טעיתם.</P>
        <H>התראות תפוגת טוקן</H>
        <P>טוקן של מטא פג כל ~60 יום. המערכת עוקבת: ספירה לאחור בהגדרות, באנר בדשבורד מ-14 יום לפני, ומייל התראה מ-7 ימים לפני — כדי שהפרסום לא ייעצר בהפתעה.</P>
        <H>ייחודיות אינסטגרם</H>
        <P>לינקים בפוסט אינסטגרם אינם לחיצים — לכן המערכת מסירה אותם ומסיימת ב&quot;הלינק בביו&quot;. שימו בביו את דף הנחיתה שלכם. פייסבוק כולל האטה חכמה (מרווח מינימלי בין פוסטים לדף) נגד חסימות ספאם.</P>
      </>
    ),
  },
  {
    id: 'whatsapp', emoji: '💬', title: 'וואטסאפ', minPlan: 'growth',
    body: (
      <>
        <P>חיבור דרך Green API (תומך פרסום לקבוצות): נרשמים ב-green-api.com, מחברים מספר, ומזינים Instance ID + Token + מזהה קבוצת היעד בהגדרות ← אינטגרציות. מרגע ההפעלה כל פוסט יוצא גם לקבוצת הוואטסאפ.</P>
      </>
    ),
  },
  {
    id: 'attribution', emoji: '💰', title: 'דוח "מה מכניס כסף" — אטריבושן', minPlan: 'growth',
    body: (
      <>
        <P>המערכת מחברת אוטומטית כל עמלה מ-AliExpress לפוסט שהביא אותה (לפי המוצר, מועד הפרסום והקליקים) — וממנו למילת המפתח ולקמפיין. במסך הדוחות מקבלים טבלה: <B>מילת מפתח × עמלות × הזמנות × קליקים</B>.</P>
        <P>ככה מגלים גם את המנצחות וגם את מילות המפתח ש&quot;שורפות&quot; קליקים בלי להכניס שקל — ומחליפים אותן. החלטות על עובדות, לא תחושות.</P>
      </>
    ),
  },
  {
    id: 'discovery', emoji: '🔎', title: 'גילוי מוצרים AI וסוכני ניהול', minPlan: 'autopilot',
    body: (
      <>
        <P><B>גילוי מוצרים</B> — מסך Discover סורק טרנדים ומציע מוצרים מנצחים לפני שהם רוויים. <B>סוכני ה-AI</B> — צוות סוכנים שרץ על הקמפיינים: מאתר מוצרים, משפר קופי על סמך פוסטים שעבדו, מזהה קמפיין חולה (כשלים חוזרים / מילים מתות) ומטפל בו. מפעילים לקמפיין עם ★ &quot;נהל באמצעות סוכנים&quot;.</P>
      </>
    ),
  },
  {
    id: 'recycling', emoji: '🏆', title: 'מיחזור מנצחים אוטומטי', minPlan: 'autopilot',
    body: (
      <>
        <P>פוסט שהוכיח את עצמו (צבר קליקים מעל הסף שקבעתם, או עמלה בפועל) לא מת אחרי פרסום אחד: המערכת מפרסמת אותו מחדש עם <B>טקסט חדש לגמרי</B> — מקסימום אחד ביום, צינון שבועיים למוצר, ורק אחרי בדיקה שהמחיר לא עלה בינתיים.</P>
        <P>מפעילים בהגדרות ← תזמון ← &quot;🏆 מיחזור מנצחים&quot;. פוסטים ממוחזרים מסומנים 🏆 במסך הפוסטים.</P>
      </>
    ),
  },
  {
    id: 'seasonal', emoji: '🗓️', title: 'עונתיות אוטומטית — לוח שנה מסחרי', minPlan: 'autopilot',
    body: (
      <>
        <P>המערכת מכירה את התקופות החמות — חגי תשרי, חנוכה, פסח, 11.11, Black Friday, קריסמס והאלווין לקהל אמריקאי ועוד. כשחלון אירוע נפתח: <B>מילות מפתח עונתיות מצטרפות לבד</B> לטייסים המתאימים, והכתיבה מתחברת לאווירת התקופה (בלי להמציא הנחות). כשהאירוע נגמר — הכול חוזר לשגרה לבד.</P>
        <P>העונות הפעילות כרגע מוצגות בראש הדשבורד. פועל כברירת מחדל; כיבוי בהגדרות ← תזמון.</P>
      </>
    ),
  },
  {
    id: 'amazon', emoji: '🛒', title: 'אינטגרציית אמזון', minPlan: 'autopilot',
    body: (
      <>
        <P>טייס שמחפש מוצרים באמזון (PA-API) ומפרסם עם לינק השותפים שלכם. דורש חשבון Amazon Associates מאושר — מזינים Access Key, Secret ו-Partner Tag בהגדרות ← אינטגרציות.</P>
      </>
    ),
  },
  {
    id: 'pinterest', emoji: '📌', title: 'פינטרסט — פינים מעוצבים אוטומטית', minPlan: 'growth',
    body: (
      <>
        <P>פינטרסט הוא מנוע חיפוש ויזואלי: פין חי חודשים וכולל <B>לינק אפילייט לחיץ אמיתי</B>. החיבור פשוט: הגדרות ← אינטגרציות ← <B>&quot;התחבר עם פינטרסט&quot;</B> — כניסה לחשבון, אישור, וזהו (לפרסום ציבורי נדרש אישור Standard access מפינטרסט לאפליקציה — חד-פעמי).</P>
        <H>עיצוב פין אוטומטי</H>
        <P>כל פין יוצא על <B>קנבס אנכי 2:3</B> — הפורמט שהאלגוריתם מקדם — עם תמונת המוצר, פס כותרת ותג מחיר אדום בסגנון פינטרסט. בלי לגעת בפוטושופ. ביצועי הפינים (חשיפות/קליקים/שמירות) מוצגים במסך הדוחות, והקליקים נספרים גם בלמידת מילות המפתח.</P>
        <H>קמפיין אמריקאי מלא (מ-Scale)</H>
        <P>טייס ייעודי לקהל ארה&quot;ב: שפה English ← פלטפורמה Pinterest בלבד ← מטבע $ ← חלון שליחה בשעון ניו-יורק (16:00–23:00 = שעות השיא). המערכת כותבת כותרות ותיאורים בסגנון SEO שפינטרסט מתגמלת.</P>
      </>
    ),
  },
  {
    id: 'incentives', emoji: '🎁', title: 'קמפייני בונוס של אלי אקספרס', minPlan: 'autopilot',
    body: (
      <>
        <P>בתוכנית השותפים של AliExpress נפתחים מדי חודש <B>פולים לפי קטגוריה</B> (Home &amp; Living, Mom &amp; Baby, Beauty ועוד) שמשלמים <B>בונוס מעבר לעמלה הרגילה</B>. ההרשמה חינם — אבל בונוס נצבר רק על הזמנות שנעשו <B>אחרי</B> שנרשמת, והפולים מתאפסים כל חודש.</P>
        <H>איך המערכת עוזרת</H>
        <P>במסך <B>&quot;קמפייני בונוס&quot;</B> רושמים את הפולים שנרשמת אליהם בפורטל: שם, מילות חיפוש באנגלית של הקטגוריה, טווח תאריכים, ולאילו טייסים זה רלוונטי. כל עוד הפול פעיל — הטייסים שבחרת מכניסים את המילים לרוטציה, כלומר <B>מושכים מוצרים מהקטגוריה שמזכה בבונוס</B> אל הערוצים הנכונים. בתום התאריך ההטיה נעלמת לבד.</P>
        <P>בחירה לפי טייס (ולא לפי קבוצה) שומרת על המותג: בונוס Home &amp; Living לא יזרים מוצרי מטבח לערוץ טקטי, והוא כן יכול להזין קמפיין פינטרסט שאין לו קבוצת טלגרם.</P>
        <H>תזכורת חודשית — בכל תוכנית</H>
        <P>ב-1 לכל חודש נשלחת תזכורת (מייל + טלגרם) להיכנס לפורטל ולהירשם לפולים החדשים, עם רשימת מה שרשום אצלך. התזכורת פתוחה בכל התוכניות; ההטיה האוטומטית של הטייס נכללת מ-Autopilot.</P>
      </>
    ),
  },
  {
    id: 'optimizer', emoji: '🧠', title: 'המוח הלומד — אופטימיזציה לילית ודוח בוקר', minPlan: 'autopilot',
    body: (
      <>
        <P>כל לילה המערכת לומדת מהנתונים של אתמול ומכוונת את עצמה:</P>
        <ul className="list-disc pr-5 space-y-1.5">
          <LI><B>מילות מפתח</B> — מילים שמייצרות קליקים ועמלות (כולל קליקים מפינטרסט) מקבלות יותר זמן אוויר; מילים מתות מושהות ובסוף פורשות — עם רשת ביטחון שמונעת פרישה בגלל שבוע שקט.</LI>
          <LI><B>שעות זהב</B> — המערכת מזהה מתי הקהל של כל קבוצה באמת מקליק. הפעלת &quot;תזמון חכם&quot; על קבוצה (מסך ערוצים) מרכזת את הפוסטים בשעות האלה.</LI>
          <LI><B>סגנון כתיבה</B> — נבחנות כמה זוויות פתיחה במקביל, והמנצחת מקבלת יותר פוסטים.</LI>
        </ul>
        <P>כל בוקר מגיע <B>דוח מנהל</B> לטלגרם/מייל: מה קרה אתמול, שעות הזהב שלך (עם מספרי הקליקים מאחוריהן), פרופיל הקנייה, ומה המערכת כיוונה בלילה. שעת המסירה נקבעת בהגדרות ← התראות.</P>
      </>
    ),
  },
  {
    id: 'campaign-platforms', emoji: '📡', title: 'פלטפורמות, מטבע וחלון לכל טייס', minPlan: 'scale',
    body: (
      <>
        <P>לכל טייס אפשר לקבוע: <B>לאן בדיוק הוא מפרסם</B> (רק פינטרסט? טלגרם+אינסטגרם?), <B>באיזה מטבע</B> המחירים (₪/$/€/£), ו<B>חלון שליחה באזור זמן משלו</B> — למשל ערב אמריקאי לקמפיין לקהל בארה&quot;ב, בזמן שהקמפיינים הישראליים ממשיכים בשעון ישראל. בלי בחירה — הכול לפי ההגדרות הכלליות.</P>
      </>
    ),
  },
  {
    id: 'faq', emoji: '❓', title: 'שאלות נפוצות ותקלות', minPlan: 'starter',
    body: (
      <>
        <H>&quot;פורסם חלקית&quot; על פוסט</H>
        <P>הפוסט יצא לחלק מהפלטפורמות ואחת נכשלה. געו בתג הכתום לראות את השגיאה המדויקת. הנפוצה ביותר: טוקן פייסבוק שפג (&quot;Session has expired&quot;) — מחדשים טוקן בהגדרות, ואז כפתור הניסיון-החוזר שולח <B>רק</B> את הפלטפורמה שנכשלה, בלי חיוב נוסף.</P>
        <H>פוסט תקוע על &quot;ממתין&quot;</H>
        <P>&quot;ממתין&quot; = בשליחה ממש עכשיו (שליחה לאינסטגרם יכולה לקחת עד 2–3 דקות). נתקע מעל חצי שעה? המערכת תסמן אותו &quot;נכשל&quot; אוטומטית ואפשר לשלוח שוב.</P>
        <H>הטייס רץ אבל לא פרסם</H>
        <P>בדקו: ההרצה בתוך חלון השליחה? יש קרדיטים? תוצאת ההרצה האחרונה (במסך הטייס) אומרת בדיוק מה קרה — כולל אילו מילות מפתח לא החזירו מוצרים.</P>
        <H>המחירים בפוסט לא מסתדרים</H>
        <P>שער ההמרה מתעדכן אוטומטית כל שעה. מארק-אפ אישי מוגדר פר-טייס; עיגול מחירים בהגדרות ← תמחור.</P>
      </>
    ),
  },
];

function Section({ s, userLevel, defaultOpen }: { s: GuideSection; userLevel: number; defaultOpen: boolean }) {
  const included = userLevel >= PLAN_ORDER[s.minPlan];
  const [open, setOpen] = useState(defaultOpen && included);

  if (!included) {
    return (
      <div className="bg-surface-secondary border border-edge rounded-xl p-5 opacity-70">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/60 flex items-center gap-2">
            <span className="text-lg grayscale">{s.emoji}</span> {s.title}
          </h2>
          <Link href="/settings?tab=subscription"
            className="flex items-center gap-1.5 text-xs bg-violet-500/10 border border-violet-500/25 text-violet-300 rounded-full px-3 py-1 hover:bg-violet-500/20 transition-colors shrink-0">
            <Lock size={11} /> זמין מ-{PLAN_NAME[s.minPlan]} ⬆️
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-secondary border border-edge rounded-xl">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between p-5 text-right">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="text-lg">{s.emoji}</span> {s.title}
        </h2>
        {open ? <ChevronUp size={15} className="text-white/30 shrink-0" /> : <ChevronDown size={15} className="text-white/30 shrink-0" />}
      </button>
      {open && <div className="px-5 pb-5 -mt-1">{s.body}</div>}
    </div>
  );
}

export default function GuidePage() {
  const [plan, setPlan] = useState<PlanId>('starter');
  const [planName, setPlanName] = useState('Starter');

  useEffect(() => {
    subscriptionApi.status()
      .then((s) => { setPlan(s.plan); setPlanName(s.plan_name); })
      .catch(() => {});
  }, []);

  const userLevel = PLAN_ORDER[plan] ?? 0;
  const includedCount = SECTIONS.filter((s) => userLevel >= PLAN_ORDER[s.minPlan]).length;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-white/30 text-xs mb-1">
        <BookOpen size={12} />
        <span>מדריך למשתמש</span>
      </div>
      <h1 className="text-2xl font-bold text-white">המדריך המלא ל-Nexlify</h1>
      <p className="text-sm text-white/40 mt-1 mb-8">
        התוכנית שלך: <b className="text-white/70">{planName}</b> · {includedCount} מתוך {SECTIONS.length} הפרקים כלולים אצלך.
        פרקים נעולים 🔒 נפתחים בשדרוג.
      </p>

      <div className="space-y-3">
        {SECTIONS.map((s, i) => (
          <Section key={s.id} s={s} userLevel={userLevel} defaultOpen={i === 0} />
        ))}
      </div>

      <p className="text-2xs text-white/25 mt-8 text-center">
        המדריך מתעדכן אוטומטית עם כל פיצ&#39;ר חדש — זו תמיד הגרסה העדכנית.
      </p>
    </div>
  );
}
