import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { CatalogProduct, CatalogStatus } from './catalog-product.entity';
import { ProductsService } from '../products/products.service';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(CatalogProduct)
    private readonly repo: Repository<CatalogProduct>,
    private readonly productsService: ProductsService,
  ) {}

  // ── List ──────────────────────────────────────────────────────────────────

  async list(
    userId: string,
    page = 1,
    limit = 20,
    status?: string,
    hasPost?: boolean,
    search?: string,
  ) {
    const where: FindOptionsWhere<CatalogProduct> = { user_id: userId };

    if (status && status !== 'all') {
      where.status = status as CatalogStatus;
    }
    if (hasPost !== undefined) {
      where.has_post = hasPost;
    }

    const qb = this.repo.createQueryBuilder('p')
      .where('p.user_id = :userId', { userId });

    if (status && status !== 'all') {
      qb.andWhere('p.status = :status', { status });
    }
    if (hasPost !== undefined) {
      qb.andWhere('p.has_post = :hasPost', { hasPost });
    }
    if (search) {
      qb.andWhere('(p.title ILIKE :s OR p.product_id ILIKE :s OR p.category ILIKE :s)', {
        s: `%${search}%`,
      });
    }

    qb.orderBy('p.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  async stats(userId: string) {
    const [total, approved, pending, rejected, withPost] = await Promise.all([
      this.repo.count({ where: { user_id: userId } }),
      this.repo.count({ where: { user_id: userId, status: 'approved' } }),
      this.repo.count({ where: { user_id: userId, status: 'pending' } }),
      this.repo.count({ where: { user_id: userId, status: 'rejected' } }),
      this.repo.count({ where: { user_id: userId, has_post: true } }),
    ]);

    const categories = await this.repo
      .createQueryBuilder('p')
      .select('COUNT(DISTINCT p.category)', 'cnt')
      .where('p.user_id = :userId', { userId })
      .getRawOne();

    const suppliers = await this.repo
      .createQueryBuilder('p')
      .select('COUNT(DISTINCT p.supplier)', 'cnt')
      .where('p.user_id = :userId', { userId })
      .getRawOne();

    return {
      total,
      approved,
      pending,
      rejected,
      with_post: withPost,
      categories: parseInt(categories?.cnt || '0', 10),
      suppliers: parseInt(suppliers?.cnt || '0', 10),
    };
  }

  // ── Find one ──────────────────────────────────────────────────────────────

  async findOne(userId: string, id: string) {
    const product = await this.repo.findOne({ where: { id, user_id: userId } });
    if (!product) throw new NotFoundException('מוצר לא נמצא');
    return product;
  }

  // ── Import ────────────────────────────────────────────────────────────────

  async importProduct(
    userId: string,
    dto: { url?: string; productId?: string; category?: string },
  ) {
    // Extract product_id
    let productId = dto.productId?.trim();
    if (!productId && dto.url) {
      const match = dto.url.match(/\/item\/(\d+)/);
      if (match) {
        productId = match[1];
      } else {
        const numMatch = dto.url.match(/(\d{10,})/);
        if (numMatch) productId = numMatch[1];
      }
    }
    if (!productId) {
      throw new BadRequestException('לא ניתן לחלץ מזהה מוצר מהקלט');
    }

    // Check duplicates
    const existing = await this.repo.findOne({
      where: { user_id: userId, product_id: productId },
    });
    if (existing) throw new ConflictException('המוצר כבר קיים בקטלוג');

    // Fetch from AliExpress
    const aliProduct = await this.productsService.refreshPrice(userId, productId);

    const product = this.repo.create({
      user_id: userId,
      product_id: productId,
      title: aliProduct?.title || `מוצר ${productId}`,
      original_price: aliProduct?.original_price || 0,
      sale_price: aliProduct?.sale_price || 0,
      currency: aliProduct?.currency || 'ILS',
      discount_percent: aliProduct?.discount_percent || 0,
      image_url: aliProduct?.image_url || '',
      product_url: aliProduct?.product_url || `https://www.aliexpress.com/item/${productId}.html`,
      category: dto.category || aliProduct?.category || '',
      orders_count: aliProduct?.orders_count || 0,
      rating: aliProduct?.rating || 0,
      status: 'approved',
      supplier: 'AliExpress',
      synced_at: new Date(),
    });

    return this.repo.save(product);
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(userId: string, id: string, dto: Partial<{
    title: string;
    description: string;
    original_price: number;
    sale_price: number;
    currency: string;
    discount_percent: number;
    image_url: string;
    affiliate_url: string;
    category: string;
    keyword: string;
    coupon_code: string;
    commission_rate: number;
  }>) {
    const product = await this.findOne(userId, id);
    Object.assign(product, dto);
    return this.repo.save(product);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async remove(userId: string, id: string) {
    const product = await this.findOne(userId, id);
    await this.repo.remove(product);
    return { deleted: true };
  }

  // ── Approve / Reject ──────────────────────────────────────────────────────

  async setStatus(userId: string, id: string, status: CatalogStatus) {
    const product = await this.findOne(userId, id);
    product.status = status;
    return this.repo.save(product);
  }

  // ── Sync ──────────────────────────────────────────────────────────────────

  async sync(userId: string, id: string) {
    const product = await this.findOne(userId, id);
    const aliProduct = await this.productsService.refreshPrice(userId, product.product_id);

    if (aliProduct) {
      product.title = aliProduct.title;
      product.original_price = aliProduct.original_price;
      product.sale_price = aliProduct.sale_price;
      product.currency = aliProduct.currency;
      product.discount_percent = aliProduct.discount_percent;
      product.image_url = aliProduct.image_url;
      product.orders_count = aliProduct.orders_count;
      product.rating = aliProduct.rating;
    }
    product.synced_at = new Date();
    return this.repo.save(product);
  }

  // ── Affiliate link ────────────────────────────────────────────────────────

  async affiliateLink(userId: string, id: string) {
    const product = await this.findOne(userId, id);
    const result = await this.productsService.affiliateLink(userId, product.product_id);

    if (result.url) {
      product.affiliate_url = result.url;
      await this.repo.save(product);
    }
    return result;
  }

  // ── Mark has_post ─────────────────────────────────────────────────────────

  async markHasPost(userId: string, productId: string) {
    await this.repo.update(
      { user_id: userId, product_id: productId },
      { has_post: true },
    );
  }
}
