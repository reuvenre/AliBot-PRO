import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { Post } from './post.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { CredentialsService } from '../credentials/credentials.service';
import { RatesService } from '../rates/rates.service';
import { signAliexpress } from '../common/aliexpress-sign';
import { normalizeTelegramChatId } from '../common/crypto';

const ALI_API = 'https://api-sg.aliexpress.com/sync';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly repo: Repository<Post>,
    private readonly credentials: CredentialsService,
    private readonly rates: RatesService,
  ) {}

  // ── List ──────────────────────────────────────────────────────────────────

  async list(userId: string, page = 1, limit = 20, status?: string, campaignId?: string) {
    const qb = this.repo.createQueryBuilder('p')
      .leftJoin('p.campaign', 'c')
      .addSelect(['c.name'])
      .where('p.user_id = :userId', { userId })
      .orderBy('p.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) qb.andWhere('p.status = :status', { status });
    if (campaignId) qb.andWhere('p.campaign_id = :campaignId', { campaignId });

    const [raw, total] = await qb.getManyAndCount();
    const data = raw.map((p) => ({ ...p, campaign_name: p.campaign?.name ?? null }));
    return { data, total, page, limit };
  }

  // ── Preview ───────────────────────────────────────────────────────────────

  async preview(userId: string, productId: string, language = 'he', customProduct?: any, template?: string) {
    const creds = await this.credentials.getRaw(userId);
    const rate = await this.rates.getRate(creds?.currency_pair || 'USD_ILS');
    const product = customProduct || await this.searchProduct(productId, creds);

    const priceAlreadyConverted = product.currency && product.currency !== 'USD';
    const priceLocal = priceAlreadyConverted
      ? product.sale_price
      : +(product.sale_price * rate).toFixed(2);

    const text = await this.generateText(
      product, language, rate, creds,
      template || undefined,
      priceAlreadyConverted ? product.sale_price : undefined,
    );

    return {
      product,
      generated_text: text,
      price_ils: customProduct?.price_ils ?? priceLocal,
      exchange_rate: priceAlreadyConverted ? 1 : rate,
    };
  }

  // ── Quick post ────────────────────────────────────────────────────────────

  async quickPost(
    userId: string,
    productId: string,
    textOverride?: string,
    channelOverride?: string,
    productImageOverride?: string,   // image URL already known by frontend — avoids wrong re-fetch
    affiliateUrlOverride?: string,   // affiliate link already fetched by frontend
  ) {
    const creds = await this.credentials.getRaw(userId);
    const rate = await this.rates.getRate(creds?.currency_pair || 'USD_ILS');

    // Only fetch the product from AliExpress if we don't already have the image
    const product = productImageOverride
      ? null
      : await this.searchProduct(productId, creds);

    const affiliateUrl = affiliateUrlOverride
      || await this.getAffiliateLink(productId, creds);

    const text = textOverride || await this.generateText(
      product || { title: productId, sale_price: 0, original_price: 0, discount_percent: 0, orders_count: 0, rating: 0, currency: 'USD' },
      'he', rate, creds,
    );

    const post = this.repo.create({
      user_id: userId,
      product_id: productId,
      product_title: product?.title || '',
      product_image: productImageOverride || product?.image_url || '',
      affiliate_url: affiliateUrl,
      original_price_usd: product?.original_price || 0,
      sale_price_usd: product?.sale_price || 0,
      price_ils: product ? +(product.sale_price * rate).toFixed(2) : 0,
      generated_text: text,
      status: 'pending',
    });

    await this.repo.save(post);
    await this.sendToTelegram(post, creds, channelOverride);
    return post;
  }

  // ── Schedule post ─────────────────────────────────────────────────────────

  async schedulePost(
    userId: string,
    productId: string,
    scheduledAt: Date,
    textOverride?: string,
    channelOverride?: string,
    productImageOverride?: string,
    affiliateUrlOverride?: string,
  ) {
    const creds = await this.credentials.getRaw(userId);
    const rate = await this.rates.getRate(creds?.currency_pair || 'USD_ILS');

    const product = productImageOverride
      ? null
      : await this.searchProduct(productId, creds);

    const affiliateUrl = affiliateUrlOverride
      || await this.getAffiliateLink(productId, creds);

    const text = textOverride || await this.generateText(
      product || { title: productId, sale_price: 0, original_price: 0, discount_percent: 0, orders_count: 0, rating: 0, currency: 'USD' },
      'he', rate, creds,
    );

    const post = this.repo.create({
      user_id: userId,
      product_id: productId,
      product_title: product?.title || '',
      product_image: productImageOverride || product?.image_url || '',
      affiliate_url: affiliateUrl,
      original_price_usd: product?.original_price || 0,
      sale_price_usd: product?.sale_price || 0,
      price_ils: product ? +(product.sale_price * rate).toFixed(2) : 0,
      generated_text: text,
      status: 'scheduled',
      scheduled_at: scheduledAt,
    });

    await this.repo.save(post);
    return post;
  }

  // ── Due scheduled posts (called by cron) ──────────────────────────────────

  async findDueScheduledPosts(): Promise<Post[]> {
    return this.repo
      .createQueryBuilder('p')
      .where('p.status = :status', { status: 'scheduled' })
      .andWhere('p.scheduled_at <= :now', { now: new Date() })
      .getMany();
  }

  async sendScheduled(post: Post) {
    const creds = await this.credentials.getRaw(post.user_id);
    post.status = 'pending';
    await this.repo.save(post);
    await this.sendToTelegram(post, creds);
  }

  // ── Run campaign ──────────────────────────────────────────────────────────

  async runCampaign(campaign: Campaign, userId: string) {
    const creds = await this.credentials.getRaw(userId);
    if (!creds) return;

    const rate = await this.rates.getRate(creds.currency_pair || 'USD_ILS');
    const keyword = campaign.keywords[Math.floor(Math.random() * campaign.keywords.length)];

    const products = await this.searchProducts({
      keyword,
      category_id: campaign.category_id,
      min_price: campaign.min_price,
      max_price: campaign.max_price,
      min_discount: campaign.min_discount,
      limit: campaign.posts_per_run * 3,
    }, creds);

    const toPost = products.slice(0, campaign.posts_per_run);

    for (const product of toPost) {
      const affiliateUrl = await this.getAffiliateLink(product.product_id, creds);
      const text = await this.generateText(product, campaign.language, rate, creds, campaign.post_template);
      const priceIls = +(product.sale_price * rate).toFixed(2);

      const post = this.repo.create({
        user_id: userId,
        campaign_id: campaign.id,
        product_id: product.product_id,
        product_title: product.title,
        product_image: product.image_url,
        affiliate_url: affiliateUrl,
        original_price_usd: product.original_price,
        sale_price_usd: product.sale_price,
        price_ils: priceIls,
        generated_text: text,
        status: 'pending',
      });

      await this.repo.save(post);
      await this.sendToTelegram(post, creds);

      // Small delay between posts
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // ── Retry ─────────────────────────────────────────────────────────────────

  async retry(userId: string, postId: string) {
    const post = await this.repo.findOne({ where: { id: postId, user_id: userId } });
    if (!post) throw new NotFoundException('Post not found');
    const creds = await this.credentials.getRaw(userId);
    post.status = 'pending';
    post.error_message = null;
    await this.repo.save(post);
    await this.sendToTelegram(post, creds);
    return post;
  }

  // ── Telegram sender ───────────────────────────────────────────────────────

  private async sendToTelegram(post: Post, creds: any, channelOverride?: string) {
    try {
      const token = creds?.telegram_bot_token;
      const rawChannel = channelOverride || creds?.telegram_channel_id;
      const channel = normalizeTelegramChatId(rawChannel);
      if (!token || !channel) throw new Error('Missing Telegram credentials');

      // Only append the affiliate link if it's not already present in the text
      // (the frontend may have already included it in the generated_text)
      const linkAlreadyInText = post.affiliate_url &&
        post.generated_text.includes(post.affiliate_url);
      const caption = (post.affiliate_url && !linkAlreadyInText)
        ? `${post.generated_text}\n\n🔗 ${post.affiliate_url}`
        : post.generated_text;

      const res = await axios.post(
        `https://api.telegram.org/bot${token}/sendPhoto`,
        {
          chat_id: channel,
          photo: post.product_image,
          caption,
          parse_mode: 'HTML',
        },
        { timeout: 15000 },
      );

      post.telegram_message_id = res.data?.result?.message_id;
      post.status = 'sent';
      post.sent_at = new Date();
    } catch (err) {
      post.status = 'failed';
      post.error_message = err?.response?.data?.description || err.message;
    }
    await this.repo.save(post);
  }

  // ── AliExpress helpers ────────────────────────────────────────────────────

  private async searchProduct(productId: string, creds: any): Promise<any> {
    // Try to find a matching product via search, fall back to mock data
    try {
      const results = await this.searchProducts({ keyword: productId, limit: 1 }, creds);
      if (results.length > 0) return results[0];
    } catch {}

    // Mock product for dev / when API not configured
    return this.mockProduct(productId);
  }

  private async searchProducts(params: {
    keyword?: string;
    category_id?: string;
    min_price?: number;
    max_price?: number;
    min_discount?: number;
    limit?: number;
  }, creds: any): Promise<any[]> {
    if (!creds?.aliexpress_app_key) {
      return this.mockProducts(params.keyword || 'product', params.limit || 5);
    }

    try {
      // Campaign prices are stored in the user's display currency — convert to USD cents for AliExpress API
      const rate = await this.rates.getRate(creds.currency_pair || 'USD_ILS');
      const signed = signAliexpress({
        method: 'aliexpress.affiliate.product.query',
        app_key: creds.aliexpress_app_key,
        keywords: params.keyword,
        category_ids: params.category_id,
        min_sale_price: params.min_price ? Math.round(params.min_price / rate * 100) : undefined,
        max_sale_price: params.max_price ? Math.round(params.max_price / rate * 100) : undefined,
        fields: 'product_id,product_title,original_price,sale_price,discount,product_main_image_url,product_detail_url,evaluate_rate,first_level_category_name,lastest_volume',
        page_size: params.limit || 10,
        tracking_id: creds.aliexpress_tracking_id,
      }, creds.aliexpress_app_secret);

      const res = await axios.get(ALI_API, { params: signed, timeout: 10000 });

      const items = res.data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product || [];
      return items.map((p: any) => {
        const rawEval = String(p.evaluate_rate || '').replace('%', '').trim();
        const evalPct = parseFloat(rawEval) || 0;
        const rating  = evalPct > 5 ? +(evalPct / 20).toFixed(1) : +evalPct.toFixed(1);
        return {
          product_id: String(p.product_id),
          title: p.product_title,
          original_price: parseFloat(p.original_price),
          sale_price: parseFloat(p.sale_price),
          discount_percent: parseInt(p.discount),
          image_url: p.product_main_image_url,
          product_url: p.product_detail_url,
          category: p.first_level_category_name,
          orders_count: parseInt(String(p.lastest_volume || '0').replace(/,/g, ''), 10) || 0,
          rating,
          currency: 'USD',
        };
      });
    } catch {
      return this.mockProducts(params.keyword || 'product', params.limit || 5);
    }
  }

  private async getAffiliateLink(productId: string, creds: any): Promise<string> {
    if (!creds?.aliexpress_app_key) {
      return `https://www.aliexpress.com/item/${productId}.html`;
    }
    try {
      const signed = signAliexpress({
        method: 'aliexpress.affiliate.link.generate',
        app_key: creds.aliexpress_app_key,
        source_values: `https://www.aliexpress.com/item/${productId}.html`,
        promotion_link_type: '0',
        tracking_id: creds.aliexpress_tracking_id,
      }, creds.aliexpress_app_secret);

      const res = await axios.get(ALI_API, { params: signed, timeout: 10000 });
      const links = res.data?.aliexpress_affiliate_link_generate_response?.resp_result?.result?.promotion_links?.promotion_link;
      return links?.[0]?.promotion_link || `https://www.aliexpress.com/item/${productId}.html`;
    } catch {
      return `https://www.aliexpress.com/item/${productId}.html`;
    }
  }

  // ── OpenAI text generation ────────────────────────────────────────────────

  private async generateText(product: any, language: string, rate: number, creds: any, template?: string, priceLocalOverride?: number): Promise<string> {
    // Use direct local price if already converted, otherwise multiply by rate
    const priceLocal = priceLocalOverride !== undefined
      ? priceLocalOverride.toFixed(0)
      : (product.sale_price * rate).toFixed(0);
    const originalLocal = priceLocalOverride !== undefined
      ? (product.original_price * rate).toFixed(0)
      : (product.original_price * rate).toFixed(0);
    const currencyPair = creds?.currency_pair || 'USD_ILS';
    const symbol = currencyPair.includes('ILS') ? '₪' : currencyPair.includes('EUR') ? '€' : currencyPair.includes('GBP') ? '£' : '$';
    const discount = product.discount_percent || Math.round((1 - product.sale_price / product.original_price) * 100);

    if (!creds?.openai_api_key) {
      return this.defaultText(product, priceLocal, originalLocal, discount, language, symbol);
    }

    const systemPrompt = template
      ? this.templateSystemPrompt(language, template)
      : this.defaultSystemPrompt(language);

    const userPrompt = this.buildUserPrompt(language, product, symbol, priceLocal, originalLocal, discount);

    try {
      const res = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: creds.openai_model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 400,
          temperature: 0.85,
        },
        {
          headers: { Authorization: `Bearer ${creds.openai_api_key}` },
          timeout: 20000,
        },
      );
      return res.data.choices[0].message.content.trim();
    } catch (err) {
      console.error('[OpenAI] generation failed:', err?.response?.data || err.message);
      return this.defaultText(product, priceLocal, originalLocal, discount, language, symbol);
    }
  }

  private defaultSystemPrompt(language: string): string {
    if (language === 'he') {
      return `אתה קופירייטר מקצועי ומומחה שיווק שותפים לערוצי Telegram בעברית.
תפקידך: לכתוב פוסטים שמוכרים — לא רק מציגים מוצר.

חוקים קריטיים:
• כתוב בעברית בלבד, ללא שום מילה באנגלית (שמות מוצרים מותר להשאיר כפי שהם)
• אל תכלול קישור — הוא יצורף אוטומטית בסוף
• מבנה הפוסט: פתיחה מושכת → תיאור ערך המוצר → מחיר ממוחק + מחיר נוכחי → פרטי ביצועים → קריאה לפעולה
• השתמש ב-HTML tags בלבד לעיצוב: <b>...</b> לכותרות/מחירים חשובים, <i>...</i> לניואנסים
• אורך: 80–130 מילים — מספיק כדי לשכנע, קצר כדי לא לאבד תשומת לב
• סגנון: נרגש אבל אמין, לא spam — כמו חבר שממליץ על דיל אמיתי
• כלול FOMO עדין: מלאי מוגבל / מחיר לא יישאר ככה / בלעדי לחברי הערוץ
• הדגש את ה-ROI: "שלמת פחות, קיבלת יותר"`;
    }
    if (language === 'ar') {
      return `أنت كاتب إعلانات محترف ومتخصص في التسويق بالعمولة لقنوات Telegram باللغة العربية.
مهمتك: كتابة منشورات تبيع — ليس مجرد عرض منتج.

قواعد حرجة:
• اكتب باللغة العربية فقط، بدون أي كلمة إنجليزية (أسماء المنتجات يمكن إبقاؤها)
• لا تضمّن رابطاً — سيُضاف تلقائياً في النهاية
• هيكل المنشور: فتح جذاب → قيمة المنتج → السعر الأصلي مشطوباً + السعر الحالي → الأداء → دعوة للعمل
• استخدم HTML tags فقط للتنسيق: <b>...</b> للعناوين والأسعار المهمة
• الطول: 80–130 كلمة
• الأسلوب: متحمس لكن موثوق، مثل صديق يوصي بصفقة حقيقية`;
    }
    return `You are a professional Telegram affiliate marketing copywriter specializing in high-conversion posts.
Your job: write posts that SELL — not just describe a product.

Critical rules:
• Write in English only (product names can stay as-is)
• Do NOT include a link — it will be appended automatically
• Post structure: Attention-grabbing hook → product value → crossed-out original price + current price → social proof → strong CTA
• Use HTML tags only for formatting: <b>...</b> for key prices/headlines, <i>...</i> for subtle emphasis
• Length: 80–130 words — enough to convince, short enough to hold attention
• Style: excited but credible — like a friend recommending a real deal
• Include subtle FOMO: limited stock / price won't stay this low / exclusive for channel members`;
  }

  private templateSystemPrompt(language: string, template: string): string {
    const base = this.defaultSystemPrompt(language);
    if (language === 'he') {
      return `${base}

בנוסף, השתמש בתבנית הבאה כבסיס לפוסט (אדפט אותה למוצר הספציפי):
${template}`;
    }
    if (language === 'ar') {
      return `${base}

بالإضافة إلى ذلك، استخدم القالب التالي كأساس للمنشور (اعدّله للمنتج المحدد):
${template}`;
    }
    return `${base}

Additionally, use the following template as a base for the post (adapt it to the specific product):
${template}`;
  }

  private buildUserPrompt(language: string, product: any, symbol: string, priceLocal: string, originalLocal: string, discount: number): string {
    const ordersFormatted = (product.orders_count || 0) >= 1000
      ? `${((product.orders_count || 0) / 1000).toFixed(1)}K+`
      : `${product.orders_count || 0}`;
    const stars = Math.round(product.rating || 0);
    const starStr = '⭐'.repeat(Math.min(stars, 5));

    if (language === 'he') {
      return `צור פוסט שיווקי מקצועי לערוץ Telegram עבור המוצר הבא. כתוב בעברית בלבד.

📦 פרטי המוצר:
שם: ${product.title}
מחיר מקורי: ${symbol}${originalLocal}
מחיר מבצע: ${symbol}${priceLocal}
הנחה: ${discount}%
הזמנות: ${ordersFormatted} לקוחות קנו
דירוג: ${product.rating?.toFixed(1) || 'N/A'}/5 ${starStr}
קטגוריה: ${product.category || 'כללי'}

הנחיות:
- התחל עם hook מנצח (שורה אחת שמושכת תשומת לב מיידית)
- הצג את הערך האמיתי של המוצר, לא רק את המחיר
- השתמש ב-<b>${symbol}${priceLocal}</b> למחיר המבצע
- ציין "במקום ${symbol}${originalLocal}" להדגשת החיסכון
- הוסף FOMO עדין (מלאי / זמן מוגבל)
- סיים עם קריאה לפעולה חזקה
- אל תכלול קישור`;
    }
    if (language === 'ar') {
      return `أنشئ منشوراً تسويقياً احترافياً لقناة Telegram للمنتج التالي. اكتب باللغة العربية فقط.

📦 تفاصيل المنتج:
الاسم: ${product.title}
السعر الأصلي: ${symbol}${originalLocal}
سعر العرض: ${symbol}${priceLocal}
الخصم: ${discount}%
الطلبات: ${ordersFormatted} عميل اشترى
التقييم: ${product.rating?.toFixed(1) || 'N/A'}/5 ${starStr}
الفئة: ${product.category || 'عام'}

تعليمات:
- ابدأ بسطر جذاب يلفت الانتباه فوراً
- أبرز قيمة المنتج، ليس فقط السعر
- استخدم <b>${symbol}${priceLocal}</b> لسعر العرض
- اذكر "بدلاً من ${symbol}${originalLocal}" لإبراز التوفير
- أضف FOMO خفيف (مخزون / وقت محدود)
- اختم بدعوة عمل قوية
- لا تضمّن رابطاً`;
    }
    return `Create a professional Telegram marketing post for the product below. Write in English only.

📦 Product details:
Name: ${product.title}
Original price: ${symbol}${originalLocal}
Sale price: ${symbol}${priceLocal}
Discount: ${discount}%
Orders: ${ordersFormatted} customers bought this
Rating: ${product.rating?.toFixed(1) || 'N/A'}/5 ${starStr}
Category: ${product.category || 'General'}

Instructions:
- Start with a powerful hook (one line that grabs attention immediately)
- Highlight the product's real value, not just the price
- Use <b>${symbol}${priceLocal}</b> for the sale price
- Mention "instead of ${symbol}${originalLocal}" to emphasize savings
- Add subtle FOMO (limited stock / time-sensitive price)
- End with a strong call to action
- Do NOT include a link`;
  }

  private defaultText(product: any, priceLocal: string, originalLocal: string, discount: number, language: string, symbol = '₪'): string {
    if (language === 'he') {
      return `🔥 <b>דיל לוהט — אל תפספסו!</b>\n\n${product.title}\n\n💸 <b>רק ${symbol}${priceLocal}</b> במקום ~~${symbol}${originalLocal}~~ (חיסכון של ${discount}%!)\n\n⭐ דירוג: ${product.rating?.toFixed(1) || 'N/A'}/5 | 🛒 ${(product.orders_count || 0).toLocaleString()} לקוחות שמחים\n\n⚡ המחיר הזה לא יישאר ככה — הזדרזו!\n👇 לחצו על הקישור לרכישה`;
    }
    if (language === 'ar') {
      return `🔥 <b>عرض حصري — لا تفوّتوه!</b>\n\n${product.title}\n\n💸 <b>فقط ${symbol}${priceLocal}</b> بدلاً من ~~${symbol}${originalLocal}~~ (توفير ${discount}%!)\n\n⭐ التقييم: ${product.rating?.toFixed(1) || 'N/A'}/5 | 🛒 ${(product.orders_count || 0).toLocaleString()} عميل راضٍ\n\n⚡ هذا السعر لن يبقى — تصرفوا الآن!\n👇 اضغطوا على الرابط للشراء`;
    }
    return `🔥 <b>Hot Deal — Don't Miss Out!</b>\n\n${product.title}\n\n💸 <b>Only ${symbol}${priceLocal}</b> instead of ${symbol}${originalLocal} (save ${discount}%!)\n\n⭐ Rating: ${product.rating?.toFixed(1) || 'N/A'}/5 | 🛒 ${(product.orders_count || 0).toLocaleString()} happy customers\n\n⚡ This price won't last — act now!\n👇 Tap the link to buy`;
  }

  // ── Mock data for dev ─────────────────────────────────────────────────────

  private mockProduct(productId: string) {
    return {
      product_id: productId,
      title: `Demo Product ${productId}`,
      original_price: 29.99,
      sale_price: 14.99,
      discount_percent: 50,
      image_url: 'https://ae01.alicdn.com/kf/placeholder.jpg',
      product_url: `https://www.aliexpress.com/item/${productId}.html`,
      category: 'Electronics',
      orders_count: 1200,
      rating: 4.7,
      currency: 'USD',
    };
  }

  private mockProducts(keyword: string, limit: number) {
    return Array.from({ length: limit }, (_, i) => ({
      product_id: `mock-${Date.now()}-${i}`,
      title: `${keyword} Product ${i + 1}`,
      original_price: 19.99 + i * 5,
      sale_price: 9.99 + i * 3,
      discount_percent: 45,
      image_url: 'https://ae01.alicdn.com/kf/placeholder.jpg',
      product_url: `https://www.aliexpress.com/item/mock${i}.html`,
      category: 'General',
      orders_count: 500 + i * 100,
      rating: 4.5,
      currency: 'USD',
    }));
  }
}
