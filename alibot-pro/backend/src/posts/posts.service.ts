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
      return items.map((p: any) => ({
        product_id: String(p.product_id),
        title: p.product_title,
        original_price: parseFloat(p.original_price),
        sale_price: parseFloat(p.sale_price),
        discount_percent: parseInt(p.discount),
        image_url: p.product_main_image_url,
        product_url: p.product_detail_url,
        category: p.first_level_category_name,
        orders_count: parseInt(p.lastest_volume) || 0,
        rating: parseFloat(p.evaluate_rate) || 0,
        currency: 'USD',
      }));
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
    const currency = product.currency || 'USD';
    const symbol = ({ ILS: '₪', EUR: '€', GBP: '£', USD: '$' }[currency] || currency);
    const discount = product.discount_percent || Math.round((1 - product.sale_price / product.original_price) * 100);

    if (!creds?.openai_api_key) {
      return this.defaultText(product, priceLocal, discount, language, symbol);
    }

    const systemPrompt = template
      ? this.templateSystemPrompt(language, template)
      : this.defaultSystemPrompt(language);

    const userPrompt = this.buildUserPrompt(language, product, symbol, priceLocal, discount);

    try {
      const res = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: creds.openai_model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 300,
          temperature: 0.7,
        },
        {
          headers: { Authorization: `Bearer ${creds.openai_api_key}` },
          timeout: 20000,
        },
      );
      return res.data.choices[0].message.content.trim();
    } catch (err) {
      console.error('[OpenAI] generation failed:', err?.response?.data || err.message);
      return this.defaultText(product, priceLocal, discount, language, symbol);
    }
  }

  private defaultSystemPrompt(language: string): string {
    if (language === 'he') {
      return `You are a professional Telegram affiliate marketing copywriter.
CRITICAL REQUIREMENT: You MUST write ONLY in Hebrew (עברית). Do not write a single word in English or any other language.
Use emojis. Maximum 150 words. Write a short, engaging post.
אתה חייב לכתוב בעברית בלבד - חל איסור מוחלט על שימוש באנגלית.`;
    }
    if (language === 'ar') {
      return `You are a professional Telegram affiliate marketing copywriter.
CRITICAL REQUIREMENT: You MUST write ONLY in Arabic (عربي). Do not write a single word in English.
Use emojis. Maximum 150 words.`;
    }
    return `You are a professional Telegram affiliate marketing copywriter.
Write a short, engaging product post in English only. Use emojis. Max 150 words.`;
  }

  private templateSystemPrompt(language: string, template: string): string {
    if (language === 'he') {
      return `You are a Telegram affiliate marketing copywriter.
CRITICAL REQUIREMENT: You MUST write ONLY in Hebrew (עברית). Do not write a single word in English.
Follow these instructions: ${template}
אתה חייב לכתוב בעברית בלבד.`;
    }
    if (language === 'ar') {
      return `You are a Telegram affiliate marketing copywriter.
CRITICAL REQUIREMENT: You MUST write ONLY in Arabic. Do not write a single word in English.
Follow these instructions: ${template}`;
    }
    return `You are a Telegram channel copywriter. Use this template: ${template}`;
  }

  private buildUserPrompt(language: string, product: any, symbol: string, priceLocal: string, discount: number): string {
    if (language === 'he') {
      return `Write a Telegram post for this product (RESPOND IN HEBREW ONLY - עברית בלבד):
Product: ${product.title}
Sale price: ${symbol}${priceLocal}
Discount: ${discount}%
Orders: ${product.orders_count?.toLocaleString()}
Rating: ${product.rating}/5
Do NOT include the link. Do NOT write in English.`;
    }
    if (language === 'ar') {
      return `Write a Telegram post for this product (RESPOND IN ARABIC ONLY):
Product: ${product.title}
Sale price: ${symbol}${priceLocal}
Discount: ${discount}%
Orders: ${product.orders_count?.toLocaleString()}
Rating: ${product.rating}/5
Do NOT include the link.`;
    }
    return `Write a Telegram post for this product:
Title: ${product.title}
Sale price: ${symbol}${priceLocal}
Discount: ${discount}%
Orders: ${product.orders_count?.toLocaleString()}
Rating: ${product.rating}/5
DO NOT include the affiliate link (it will be appended).`;
  }

  private defaultText(product: any, priceLocal: string, discount: number, language: string, symbol = '₪'): string {
    if (language === 'he') {
      return `🔥 מוצר מדהים!\n\n${product.title}\n\n💰 מחיר: ${symbol}${priceLocal}\n🏷️ הנחה: ${discount}%\n⭐ דירוג: ${product.rating}/5\n\n👆 לחץ על הקישור לרכישה!`;
    }
    if (language === 'ar') {
      return `🔥 عرض رائع!\n\n${product.title}\n\n💰 السعر: ${symbol}${priceLocal}\n🏷️ الخصم: ${discount}%\n⭐ التقييم: ${product.rating}/5`;
    }
    return `🔥 Amazing deal!\n\n${product.title}\n\n💰 Price: ${symbol}${priceLocal}\n🏷️ Discount: ${discount}%\n⭐ Rating: ${product.rating}/5`;
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
